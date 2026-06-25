"""Background PR watcher that polls for new pull requests and auto-triggers compliance checks.

Since ATProto / Tangled does not support webhooks, this module polls for new
open PRs at a configurable interval and invokes the PR compliance pipeline for
each unprocessed PR.
"""

import asyncio
import logging
import time
from typing import Optional

import httpx

from src.config import settings

logger = logging.getLogger("pr_watcher")

_POLL_INTERVAL_S = 60
_processed_prs: set[str] = set()
_watcher_task: Optional[asyncio.Task] = None


def _get_org_session_sync() -> dict:
    """Create a PDS session using the org owner's app password."""
    resp = httpx.post(
        f"{settings.pds_host}/xrpc/com.atproto.server.createSession",
        json={"identifier": settings.handle, "password": settings.app_password},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    return {
        "did": data["did"],
        "access_token": data["accessJwt"],
        "pds_issuer": settings.pds_host,
    }


def _list_records_sync(session: dict, collection: str) -> list[dict]:
    """List ATProto records for the org owner."""
    resp = httpx.get(
        f"{session['pds_issuer']}/xrpc/com.atproto.repo.listRecords",
        params={"repo": session["did"], "collection": collection, "limit": 100},
        headers={"Authorization": f"Bearer {session['access_token']}"},
        timeout=15,
    )
    if resp.status_code != 200:
        return []
    records = []
    for r in resp.json().get("records", []):
        uri = r.get("uri", "")
        rkey = uri.rsplit("/", 1)[-1] if "/" in uri else ""
        records.append({"uri": uri, "cid": r.get("cid", ""), "rkey": rkey, "value": r.get("value", {})})
    return records


def _resolve_clone_url(repo_record: dict, owner_did: str) -> str:
    """Build a git clone URL from a repo record's knot server."""
    val = repo_record.get("value", {})
    knot = val.get("knot", "")
    rkey = repo_record.get("uri", "").rsplit("/", 1)[-1]
    if knot:
        return f"https://{knot}/{owner_did}/{rkey}.git"
    return ""


def _run_pr_pipeline(pr: dict, repo_record: dict, owner_did: str) -> Optional[dict]:
    """Run the compliance pipeline for a single PR. Returns result dict or None on failure."""
    try:
        from src.agent.nodes import ComplianceState, graph
    except ImportError:
        logger.warning("Agent dependencies not installed, skipping PR check")
        return None

    if graph is None:
        logger.warning("LangGraph not available, skipping PR check")
        return None

    val = pr["value"]
    source = val.get("source", {})
    target = val.get("target", {})
    pr_branch = source.get("branch", "") if isinstance(source, dict) else str(source)
    base_branch = target.get("branch", "main") if isinstance(target, dict) else "main"
    clone_url = _resolve_clone_url(repo_record, owner_did)

    if not clone_url or not pr_branch:
        logger.warning("Cannot resolve clone URL or branch for PR %s", pr["uri"])
        return None

    repo_uri = repo_record.get("uri", "")

    state = ComplianceState(
        pr_uri=pr["uri"],
        repo_uri=repo_uri,
        repo_clone_url=clone_url,
        pr_branch=pr_branch,
        base_branch=base_branch,
    )

    try:
        raw = graph.invoke(state)
        r = raw if isinstance(raw, dict) else vars(raw)
        logger.info(
            "PR %s checked: gate=%s risk=%s records=%d",
            pr["uri"],
            r.get("gate_status", "?"),
            r.get("risk_level", "?"),
            r.get("records_written", 0),
        )
        return r
    except Exception:
        logger.exception("Failed to run compliance pipeline for PR %s", pr["uri"])
        return None


async def _poll_once() -> int:
    """Poll for new PRs and run compliance checks. Returns count of PRs processed."""
    try:
        session = _get_org_session_sync()
    except Exception:
        logger.exception("Failed to create PDS session for PR polling")
        return 0

    pulls = _list_records_sync(session, "sh.tangled.repo.pull")
    statuses = _list_records_sync(session, "sh.tangled.repo.pull.status")
    repos = _list_records_sync(session, "sh.tangled.repo")

    status_map: dict[str, str] = {}
    for s in statuses:
        val = s["value"]
        pull_uri = val.get("pull", "")
        status_val = val.get("status", "")
        created = val.get("createdAt", "")
        if pull_uri not in status_map or created > status_map.get(f"{pull_uri}__ts", ""):
            status_map[pull_uri] = status_val
            status_map[f"{pull_uri}__ts"] = created

    repo_map: dict[str, dict] = {}
    for r in repos:
        repo_map[r["uri"]] = r
        did = r["value"].get("repoDid", "")
        if did:
            repo_map[did] = r

    processed = 0
    for pr in pulls:
        uri = pr["uri"]
        if uri in _processed_prs:
            continue

        raw_status = status_map.get(uri, "sh.tangled.repo.pull.status.open")
        if not raw_status.endswith(".open"):
            _processed_prs.add(uri)
            continue

        val = pr["value"]
        target = val.get("target", {})
        target_repo = target if isinstance(target, str) else target.get("repo", "")

        repo_record = None
        for r_uri, r_rec in repo_map.items():
            if target_repo and target_repo in r_uri:
                repo_record = r_rec
                break

        if not repo_record:
            _processed_prs.add(uri)
            continue

        logger.info("New open PR detected: %s (%s)", uri, val.get("title", ""))

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, _run_pr_pipeline, pr, repo_record, session["did"]
        )
        _processed_prs.add(uri)
        if result is not None:
            processed += 1

    return processed


async def _watcher_loop():
    """Main polling loop."""
    logger.info("PR watcher started (interval=%ds)", _POLL_INTERVAL_S)

    while True:
        try:
            count = await _poll_once()
            if count:
                logger.info("Processed %d new PR(s)", count)
        except asyncio.CancelledError:
            logger.info("PR watcher cancelled")
            break
        except Exception:
            logger.exception("PR watcher iteration failed")

        await asyncio.sleep(_POLL_INTERVAL_S)


def start_pr_watcher():
    """Start the PR watcher as a background asyncio task. Safe to call multiple times."""
    global _watcher_task

    if not settings.handle or not settings.app_password:
        logger.warning("PR watcher not started: missing handle or app_password")
        return

    if not settings.anthropic_api_key:
        logger.warning("PR watcher not started: missing anthropic_api_key (agent won't work)")
        return

    if _watcher_task is not None and not _watcher_task.done():
        return

    _watcher_task = asyncio.create_task(_watcher_loop())
    logger.info("PR watcher background task created")


def stop_pr_watcher():
    """Cancel the watcher task if running."""
    global _watcher_task
    if _watcher_task and not _watcher_task.done():
        _watcher_task.cancel()
        _watcher_task = None
