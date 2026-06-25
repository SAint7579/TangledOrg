"""Background PR watcher that polls for new pull requests and auto-triggers compliance checks.

Since ATProto / Tangled does not support webhooks, this module polls for new
open PRs at a configurable interval and invokes the PR compliance pipeline for
each unprocessed PR.

On merge detection, the watcher materialises potential incidents into real
issues and incidents based on the stored PRAssessment and ImpactAssessment.
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Optional

import httpx

from src.config import settings

logger = logging.getLogger("pr_watcher")

_POLL_INTERVAL_S = 60

# uri -> last known status label ("open" | "closed" | "merged")
_pr_status_cache: dict[str, str] = {}
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
    rkey = repo_record.get("uri", "").rsplit("/", 1)[-1]
    handle = settings.handle
    if handle:
        return f"https://tangled.sh/{handle}/{rkey}.git"
    knot = val.get("knot", "")
    if knot:
        return f"https://{knot}/{owner_did}/{rkey}.git"
    return ""


def _resolve_status_label(raw: str) -> str:
    if raw.endswith(".merged"):
        return "merged"
    if raw.endswith(".closed"):
        return "closed"
    return "open"


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


# ---------------------------------------------------------------------------
# Merge materialisation: create real issues + incidents from assessment data
# ---------------------------------------------------------------------------


_materialized_prs: set[str] = set()


def _materialize_on_merge(pr_uri: str, session: dict) -> int:
    """When a PR is merged, create issues and incidents from its assessment.

    Reads the PRAssessment, failed ControlEvaluations, and ImpactAssessment
    for this PR and turns them into concrete issues (in the source repo and
    any affected downstream repos) plus linked compliance incidents.

    Guarded against duplicate runs -- skips if already materialized for this PR.
    Returns the number of records created.
    """
    global _materialized_prs

    if pr_uri in _materialized_prs:
        logger.info("PR %s already materialized, skipping", pr_uri)
        return 0
    _materialized_prs.add(pr_uri)

    from src.agent.tools._client import _val, get_client
    from src.agent.tools.tangled import _create_native_record
    from src.models import Incident

    client = get_client()
    created = 0

    assessments = _list_records_sync(session, "sh.tangled.governance.compliance.prAssessment")
    assessment = None
    for a in assessments:
        if a["value"].get("pullRequest") == pr_uri:
            assessment = a
            break

    if not assessment:
        logger.info("No assessment found for merged PR %s, skipping materialisation", pr_uri)
        return 0

    # Check if issues already exist for this assessment (cross-deploy dedup)
    existing_issues = _list_records_sync(session, "sh.tangled.repo.issue")
    assessment_uri = assessment["uri"]
    for issue in existing_issues:
        if assessment_uri in issue["value"].get("body", ""):
            logger.info("Issues already exist for assessment %s, skipping", assessment_uri)
            return 0

    av = assessment["value"]
    assessment_uri = assessment["uri"]
    repo_uri = av.get("repo", "")

    repos = _list_records_sync(session, "sh.tangled.repo")
    uri_to_rkey: dict[str, str] = {}
    uri_to_did: dict[str, str] = {}
    for r in repos:
        r_uri = r.get("uri", "")
        uri_to_rkey[r_uri] = r_uri.rsplit("/", 1)[-1]
        uri_to_did[r_uri] = r["value"].get("repoDid", "")

    source_rkey = uri_to_rkey.get(repo_uri, "unknown")
    source_did = uri_to_did.get(repo_uri, "")
    now = datetime.now(timezone.utc)

    # 1. Create issues + incidents for failed control evaluations
    evals = _list_records_sync(session, "sh.tangled.governance.compliance.controlEvaluation")
    for ev in evals:
        evv = ev["value"]
        if evv.get("prAssessment") != assessment_uri:
            continue
        if evv.get("status") not in ("fail", "warning"):
            continue

        ctrl_rkey = (evv.get("control", "")).rsplit("/", 1)[-1]
        sev = "high" if evv.get("status") == "fail" else "medium"
        title = f"[PR Merged] {ctrl_rkey}: {evv.get('reason', 'Control violation')[:120]}"
        body = (
            f"**Severity:** {sev.upper()}\n"
            f"**Control:** `{ctrl_rkey}`\n"
            f"**PR Assessment:** `{assessment_uri}`\n"
            f"**Status:** {evv.get('status', '?')}\n\n"
            f"### Reason\n{evv.get('reason', 'No details.')}\n\n"
            f"---\n*Materialised from PR compliance check on merge at {now.strftime('%Y-%m-%d %H:%M UTC')}*"
        )

        if not source_did:
            continue

        try:
            issue_result = _create_native_record(
                "sh.tangled.repo.issue",
                {
                    "repo": source_did,
                    "title": title[:200],
                    "body": body,
                    "createdAt": now.isoformat(),
                },
            )
            created += 1

            incident = Incident(
                issue=issue_result["uri"],
                repo=repo_uri,
                severity=sev,
                category="other",
                description=evv.get("reason", "")[:2000],
                status="open",
                created_at=now,
            )
            client.create_governance_record(incident)
            created += 1
        except Exception:
            logger.exception("Failed to create issue/incident for control %s", ctrl_rkey)

    # 2. Create issues in downstream repos from ImpactAssessment
    impacts = _list_records_sync(session, "sh.tangled.governance.compliance.impactAssessment")
    for imp in impacts:
        iv = imp["value"]
        if iv.get("pullRequest") != pr_uri:
            continue

        for edge in iv.get("affectedEdges", []):
            ds_repo = edge.get("downstreamRepo", "")
            ds_did = uri_to_did.get(ds_repo, "")
            ds_rkey = uri_to_rkey.get(ds_repo, ds_repo)

            if not ds_did:
                continue

            title = f"[Upstream Merged: {source_rkey}] {edge.get('reason', 'Upstream change may affect this repo')[:120]}"
            body = (
                f"**Upstream repo:** `{source_rkey}`\n"
                f"**Affected path:** `{edge.get('downstreamPath', '?')}`\n"
                f"**Action:** {edge.get('actionRequired', 'review-recommended')}\n\n"
                f"### Reason\n{edge.get('reason', 'Upstream change affects this repo.')}\n\n"
                f"### Recommended Action\n"
                f"Review whether this repo needs updates to accommodate the merged upstream change.\n\n"
                f"---\n*Created on upstream PR merge at {now.strftime('%Y-%m-%d %H:%M UTC')}*"
            )

            try:
                _create_native_record(
                    "sh.tangled.repo.issue",
                    {
                        "repo": ds_did,
                        "title": title[:200],
                        "body": body,
                        "createdAt": now.isoformat(),
                    },
                )
                created += 1
            except Exception:
                logger.exception("Failed to create downstream issue in %s", ds_rkey)

    logger.info("Materialised %d records for merged PR %s", created, pr_uri)
    return created


# ---------------------------------------------------------------------------
# Polling loop
# ---------------------------------------------------------------------------


def _build_status_map(statuses: list[dict]) -> dict[str, str]:
    """Build a map of pull URI -> latest raw status string."""
    status_map: dict[str, str] = {}
    for s in statuses:
        val = s["value"]
        pull_uri = val.get("pull", "")
        status_val = val.get("status", "")
        created = val.get("createdAt", "")
        if pull_uri not in status_map or created > status_map.get(f"{pull_uri}__ts", ""):
            status_map[pull_uri] = status_val
            status_map[f"{pull_uri}__ts"] = created
    return status_map


def _find_repo_for_pr(pr: dict, repo_map: dict[str, dict]) -> Optional[dict]:
    """Resolve which repo record a PR belongs to."""
    val = pr["value"]
    target = val.get("target", {})
    target_repo = target if isinstance(target, str) else target.get("repo", "")
    for r_uri, r_rec in repo_map.items():
        if target_repo and target_repo in r_uri:
            return r_rec
    return None


async def _poll_once() -> int:
    """Poll for new/changed PRs. Runs checks on new open PRs, materialises on merge."""
    try:
        session = _get_org_session_sync()
    except Exception:
        logger.exception("Failed to create PDS session for PR polling")
        return 0

    pulls = _list_records_sync(session, "sh.tangled.repo.pull")
    statuses = _list_records_sync(session, "sh.tangled.repo.pull.status")
    repos = _list_records_sync(session, "sh.tangled.repo")

    status_map = _build_status_map(statuses)

    repo_map: dict[str, dict] = {}
    for r in repos:
        repo_map[r["uri"]] = r
        did = r["value"].get("repoDid", "")
        if did:
            repo_map[did] = r

    processed = 0
    for pr in pulls:
        uri = pr["uri"]
        raw_status = status_map.get(uri, "sh.tangled.repo.pull.status.open")
        current_label = _resolve_status_label(raw_status)
        previous_label = _pr_status_cache.get(uri)

        if previous_label == current_label:
            continue

        # New PR or status change detected
        if previous_label is None and current_label == "open":
            # Brand-new open PR → run compliance check
            repo_record = _find_repo_for_pr(pr, repo_map)
            if repo_record:
                logger.info("New open PR detected: %s (%s)", uri, pr["value"].get("title", ""))
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    None, _run_pr_pipeline, pr, repo_record, session["did"]
                )
                if result is not None:
                    processed += 1

        elif current_label == "merged" and previous_label in (None, "open"):
            # PR merged → just log it; the merge endpoint triggers the scan
            logger.info("PR merged (detected by watcher): %s (%s)", uri, pr["value"].get("title", ""))

        _pr_status_cache[uri] = current_label

    return processed


async def _watcher_loop():
    """Main polling loop."""
    logger.info("PR watcher started (interval=%ds)", _POLL_INTERVAL_S)

    while True:
        try:
            count = await _poll_once()
            if count:
                logger.info("Processed %d PR event(s)", count)
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
