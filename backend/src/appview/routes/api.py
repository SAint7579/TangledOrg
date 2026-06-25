"""REST API routes serving governance data from ATProto.

All shared org data (repos, policies, members, incidents, etc.) is stored
under the org owner's DID on the PDS.  We use the app-password–based
"org session" for reads *and* writes so that every member of the org sees
(and contributes to) the same dataset.  The OAuth user session is still
checked for authentication — you must be logged in — but the actual PDS
I/O goes through the org owner's credentials.
"""

import time
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx

from src.appview.routes.auth import get_authenticated_session
from src.config import settings

router = APIRouter(prefix="/api", tags=["api"])


# ── Org-owner session (app-password based) ────────────────────────────────────

_org_session_cache: dict | None = None


def _get_org_session() -> dict:
    """Return a session dict for the org owner using the app password.

    This session is used for all shared org data reads and writes so that
    every member sees the same records (stored under the org owner's DID).
    The session is cached and refreshed when the access token expires.
    """
    global _org_session_cache

    if _org_session_cache is not None:
        return _org_session_cache

    pds = settings.pds_host.rstrip("/")
    resp = httpx.post(
        f"{pds}/xrpc/com.atproto.server.createSession",
        json={
            "identifier": settings.handle,
            "password": settings.app_password,
        },
        timeout=15,
    )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Could not authenticate org owner ({settings.handle}): {resp.text}",
        )
    data = resp.json()
    _org_session_cache = {
        "did": data["did"],
        "access_token": data["accessJwt"],
        "refresh_token": data.get("refreshJwt", ""),
        "pds_issuer": pds,
        "handle": data.get("handle", settings.handle),
    }
    return _org_session_cache


def _refresh_org_session() -> dict:
    """Force-refresh the org owner session (e.g. after a 401)."""
    global _org_session_cache
    _org_session_cache = None
    return _get_org_session()


def _list_records(session: dict, collection: str) -> list[dict]:
    """List records from the given session's DID."""

    resp = httpx.get(
        f"{session['pds_issuer']}/xrpc/com.atproto.repo.listRecords",
        params={"repo": session["did"], "collection": collection, "limit": 100},
        headers={"Authorization": f"Bearer {session['access_token']}"},
        timeout=15,
    )
    if resp.status_code == 401:
        refreshed = _refresh_org_session()
        resp = httpx.get(
            f"{refreshed['pds_issuer']}/xrpc/com.atproto.repo.listRecords",
            params={"repo": refreshed["did"], "collection": collection, "limit": 100},
            headers={"Authorization": f"Bearer {refreshed['access_token']}"},
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


def _resolve_did_to_handle(pds_url: str, did: str) -> str:
    """Resolve a DID to its handle via the PDS."""
    try:
        resp = httpx.get(
            f"{pds_url}/xrpc/com.atproto.repo.describeRepo",
            params={"repo": did},
            timeout=5,
        )
        if resp.status_code == 200:
            return resp.json().get("handle", did)
    except Exception:
        pass
    return did


def _resolve_dids_batch(pds_url: str, dids: list[str]) -> dict[str, str]:
    """Resolve multiple DIDs to handles. Returns {did: handle} map."""
    result = {}
    for did in set(dids):
        if did:
            result[did] = _resolve_did_to_handle(pds_url, did)
    return result


def _create_record(session: dict, collection: str, record: dict, rkey: str | None = None) -> dict:
    body: dict = {
        "repo": session["did"],
        "collection": collection,
        "record": {**record, "$type": collection},
    }
    if rkey:
        body["rkey"] = rkey

    resp = httpx.post(
        f"{session['pds_issuer']}/xrpc/com.atproto.repo.createRecord",
        json=body,
        headers={"Authorization": f"Bearer {session['access_token']}"},
        timeout=15,
    )
    if resp.status_code == 401:
        refreshed = _refresh_org_session()
        body["repo"] = refreshed["did"]
        resp = httpx.post(
            f"{refreshed['pds_issuer']}/xrpc/com.atproto.repo.createRecord",
            json=body,
            headers={"Authorization": f"Bearer {refreshed['access_token']}"},
            timeout=15,
        )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


def _delete_record(session: dict, collection: str, rkey: str) -> None:
    resp = httpx.post(
        f"{session['pds_issuer']}/xrpc/com.atproto.repo.deleteRecord",
        json={"repo": session["did"], "collection": collection, "rkey": rkey},
        headers={"Authorization": f"Bearer {session['access_token']}"},
        timeout=15,
    )
    if resp.status_code == 401:
        refreshed = _refresh_org_session()
        resp = httpx.post(
            f"{refreshed['pds_issuer']}/xrpc/com.atproto.repo.deleteRecord",
            json={"repo": refreshed["did"], "collection": collection, "rkey": rkey},
            headers={"Authorization": f"Bearer {refreshed['access_token']}"},
            timeout=15,
        )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=resp.status_code, detail=resp.text)


# ── Organization ─────────────────────────────────────────────────────────────


@router.get("/dashboard")
async def get_dashboard(request: Request):
    """Single endpoint returning all dashboard stats to avoid N+1 API calls."""
    get_authenticated_session(request)
    session = _get_org_session()

    repos = _list_records(session, "sh.tangled.repo")
    pulls = _list_records(session, "sh.tangled.repo.pull")
    pull_statuses = _list_records(session, "sh.tangled.repo.pull.status")
    incidents = _list_records(session, "sh.tangled.governance.compliance.incident")
    policies = _list_records(session, "sh.tangled.governance.policyPack")
    scans = _list_records(session, "sh.tangled.governance.compliance.scanResult")
    repo_deps = _list_records(session, "sh.tangled.governance.graph.repoDependency")
    code_deps = _list_records(session, "sh.tangled.governance.graph.codeDependency")

    # Build pull status map
    status_map: dict[str, str] = {}
    for s in pull_statuses:
        val = s["value"]
        pull_uri = val.get("pull", "")
        raw = val.get("status", "")
        ts = val.get("createdAt", "")
        if pull_uri not in status_map or ts > status_map.get(f"{pull_uri}__ts", ""):
            status_map[pull_uri] = raw
            status_map[f"{pull_uri}__ts"] = ts

    # Per-repo stats
    repo_stats = []
    for r in repos:
        rkey = r["rkey"]
        r_uri = r["uri"]
        repo_did = r["value"].get("repoDid", "")

        # Count pulls for this repo
        open_pulls = 0
        total_pulls = 0
        for p in pulls:
            pv = p["value"]
            target = pv.get("target", {})
            t_repo = target.get("repo", "") if isinstance(target, dict) else str(target)
            if repo_did and repo_did in t_repo:
                total_pulls += 1
                raw_st = status_map.get(p["uri"], "sh.tangled.repo.pull.status.open")
                if not raw_st.endswith(".merged") and not raw_st.endswith(".closed"):
                    open_pulls += 1

        # Count scans for this repo
        scan_count = sum(
            1 for sc in scans
            if sc["value"].get("repo", "") == r_uri
            or sc["value"].get("repoRkey", "") == rkey
        )

        # Count incidents for this repo
        inc_count = sum(1 for i in incidents if rkey in i["value"].get("repo", ""))

        repo_stats.append({
            "rkey": rkey,
            "name": r["value"].get("name", rkey),
            "knot": r["value"].get("knot", ""),
            "openPulls": open_pulls,
            "totalPulls": total_pulls,
            "scanCount": scan_count,
            "incidentCount": inc_count,
        })

    # Incident severity breakdown
    sev_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    open_count = 0
    resolved_count = 0
    for i in incidents:
        iv = i["value"]
        sev = iv.get("severity", "low")
        if sev in sev_counts:
            sev_counts[sev] += 1
        st = iv.get("status", "open")
        if st in ("open", "in-progress"):
            open_count += 1
        elif st in ("resolved", "closed"):
            resolved_count += 1

    return {
        "repoCount": len(repos),
        "repoStats": repo_stats,
        "incidents": {
            "total": len(incidents),
            "open": open_count,
            "resolved": resolved_count,
            "severity": sev_counts,
        },
        "policies": {
            "count": len(policies),
            "totalControls": sum(len(p["value"].get("controls", [])) for p in policies),
            "totalBindings": sum(len(p["value"].get("bindings", [])) for p in policies),
        },
        "pulls": {
            "totalOpen": sum(r["openPulls"] for r in repo_stats),
        },
        "scans": {
            "total": len(scans),
            "reposScanned": sum(1 for r in repo_stats if r["scanCount"] > 0),
        },
        "graph": {
            "repoDeps": len(repo_deps),
            "codeDeps": len(code_deps),
        },
    }


@router.get("/org")
async def list_orgs(request: Request):
    get_authenticated_session(request)  # auth check
    session = _get_org_session()
    records = _list_records(session, "sh.tangled.governance.org.organization")
    orgs = []
    for r in records:
        val = r["value"]
        orgs.append({
            "id": r["rkey"], "uri": r["uri"],
            "name": val.get("name", ""),
            "displayName": val.get("displayName", val.get("name", "")),
            "description": val.get("description", ""),
            "ownerDid": val.get("ownerDid", ""),
            "createdAt": val.get("createdAt", ""),
        })
    return {"organizations": orgs}


@router.get("/org/{rkey}/members")
async def list_members(rkey: str, request: Request):
    get_authenticated_session(request)  # auth check
    session = _get_org_session()
    memberships = _list_records(session, "sh.tangled.governance.org.membership")
    roles = _list_records(session, "sh.tangled.governance.org.role")
    teams = _list_records(session, "sh.tangled.governance.org.team")

    org_uri_suffix = f"sh.tangled.governance.org.organization/{rkey}"
    role_map = {r["uri"]: r["value"] for r in roles}
    team_map = {t["uri"]: t["value"] for t in teams}

    filtered = []
    for m in memberships:
        val = m["value"]
        org_uri = val.get("org", "")
        if rkey != "all" and org_uri_suffix not in org_uri:
            continue
        filtered.append(m)

    member_dids = [m["value"].get("memberDid", "") for m in filtered]
    handle_map = _resolve_dids_batch(session["pds_issuer"], member_dids)

    members = []
    for m in filtered:
        val = m["value"]
        did = val.get("memberDid", "")
        role_data = role_map.get(val.get("role", ""), {})
        member_teams = []
        for team_uri in (val.get("teams") or []):
            td = team_map.get(team_uri, {})
            if td:
                member_teams.append({"name": td.get("name", ""), "displayName": td.get("displayName", "")})

        members.append({
            "id": m["rkey"], "uri": m["uri"],
            "did": did,
            "handle": handle_map.get(did, did),
            "role": {"slug": role_data.get("slug", ""), "name": role_data.get("name", "")},
            "teams": member_teams,
            "invitedBy": val.get("invitedBy"),
            "createdAt": val.get("createdAt", ""),
        })

    return {
        "members": members,
        "roles": [{"id": r["rkey"], "uri": r["uri"], **r["value"]} for r in roles],
        "teams": [{"id": t["rkey"], "uri": t["uri"], **t["value"]} for t in teams],
    }


class AddMemberRequest(BaseModel):
    handle: str
    orgUri: str
    roleUri: Optional[str] = None


@router.post("/org/members")
async def add_member(body: AddMemberRequest, request: Request):
    """Add a member to the organization by handle."""
    user_session = get_authenticated_session(request)  # auth check
    session = _get_org_session()

    member_did = ""
    try:
        resp = httpx.get(
            f"{session['pds_issuer']}/xrpc/com.atproto.identity.resolveHandle",
            params={"handle": body.handle},
            timeout=10,
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Could not resolve handle: {body.handle}")
        member_did = resp.json().get("did", "")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail=f"Could not resolve handle: {body.handle}")

    if not member_did:
        raise HTTPException(status_code=400, detail="Could not resolve DID")

    now = datetime.now(timezone.utc).isoformat()
    record = {
        "org": body.orgUri,
        "memberDid": member_did,
        "invitedBy": user_session["did"],
        "createdAt": now,
    }
    if body.roleUri:
        record["role"] = body.roleUri

    result = _create_record(session, "sh.tangled.governance.org.membership", record)
    return {"membership": result, "did": member_did, "handle": body.handle}


# ── Repos ────────────────────────────────────────────────────────────────────


@router.get("/repos")
async def list_repos(request: Request):
    get_authenticated_session(request)  # auth check
    session = _get_org_session()
    repos = _list_records(session, "sh.tangled.repo")
    profiles = _list_records(session, "sh.tangled.governance.compliance.repoProfile")

    profile_map = {}
    for p in profiles:
        repo_uri = p["value"].get("repo", "")
        profile_map[repo_uri] = p["value"]

    result = []
    for r in repos:
        val = r["value"]
        profile = profile_map.get(r["uri"], {})
        result.append({
            "id": r["rkey"], "uri": r["uri"],
            "name": r["rkey"],
            "knot": val.get("knot", ""),
            "repoDid": val.get("repoDid", ""),
            "createdAt": val.get("createdAt", ""),
            "profile": profile if profile else None,
        })
    return {"repos": result}


@router.get("/repos/{rkey}/profile")
async def get_repo_profile(rkey: str, request: Request):
    get_authenticated_session(request)  # auth check
    session = _get_org_session()
    profiles = _list_records(session, "sh.tangled.governance.compliance.repoProfile")
    for p in profiles:
        if rkey in p["value"].get("repo", ""):
            return {"profile": p["value"], "uri": p["uri"], "rkey": p["rkey"]}
    return {"profile": None}


def _get_repo_record(rkey: str) -> dict:
    """Find a repo record by rkey and return its value dict (with knot, repoDid, etc.)."""
    session = _get_org_session()
    repos = _list_records(session, "sh.tangled.repo")
    for r in repos:
        if r["rkey"] == rkey:
            return r
    raise HTTPException(status_code=404, detail=f"Repo '{rkey}' not found")


@router.get("/repos/{rkey}/issues")
async def list_repo_issues(rkey: str, request: Request):
    get_authenticated_session(request)  # auth check
    session = _get_org_session()
    repo_rec = _get_repo_record(rkey)
    repo_did = repo_rec["value"].get("repoDid", "")

    issues = _list_records(session, "sh.tangled.repo.issue")
    states = _list_records(session, "sh.tangled.repo.issue.state")

    state_map: dict[str, str] = {}
    for s in states:
        val = s["value"]
        issue_uri = val.get("issue", "")
        state_val = val.get("state", "")
        created = val.get("createdAt", "")
        if issue_uri not in state_map or created > state_map.get(f"{issue_uri}__ts", ""):
            state_map[issue_uri] = state_val
            state_map[f"{issue_uri}__ts"] = created

    result = []
    for iss in issues:
        val = iss["value"]
        if val.get("repo") != repo_did:
            continue
        uri = iss["uri"]
        raw_state = state_map.get(uri, "sh.tangled.repo.issue.state.open")
        state_label = "closed" if raw_state.endswith(".closed") else "open"
        result.append({
            "id": iss["rkey"],
            "uri": uri,
            "title": val.get("title", ""),
            "body": val.get("body", ""),
            "state": state_label,
            "createdAt": val.get("createdAt", ""),
            "mentions": val.get("mentions", []),
            "references": val.get("references", []),
        })

    result.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return {"issues": result}


@router.get("/repos/{rkey}/pulls")
async def list_repo_pulls(rkey: str, request: Request):
    get_authenticated_session(request)  # auth check
    session = _get_org_session()
    repo_rec = _get_repo_record(rkey)
    repo_did = repo_rec["value"].get("repoDid", "")

    pulls = _list_records(session, "sh.tangled.repo.pull")
    statuses = _list_records(session, "sh.tangled.repo.pull.status")

    status_map: dict[str, str] = {}
    for s in statuses:
        val = s["value"]
        pull_uri = val.get("pull", "")
        status_val = val.get("status", "")
        created = val.get("createdAt", "")
        if pull_uri not in status_map or created > status_map.get(f"{pull_uri}__ts", ""):
            status_map[pull_uri] = status_val
            status_map[f"{pull_uri}__ts"] = created

    result = []
    for pr in pulls:
        val = pr["value"]
        target = val.get("target", {})
        target_repo = target if isinstance(target, str) else target.get("repo", "")
        if repo_did and repo_did not in target_repo:
            continue
        uri = pr["uri"]
        raw_status = status_map.get(uri, "sh.tangled.repo.pull.status.open")
        if raw_status.endswith(".merged"):
            status_label = "merged"
        elif raw_status.endswith(".closed"):
            status_label = "closed"
        else:
            status_label = "open"

        source = val.get("source", {})
        result.append({
            "id": pr["rkey"],
            "uri": uri,
            "title": val.get("title", ""),
            "body": val.get("body", ""),
            "status": status_label,
            "createdAt": val.get("createdAt", ""),
            "sourceBranch": source.get("branch", "") if isinstance(source, dict) else str(source),
            "targetBranch": target.get("branch", "") if isinstance(target, dict) else str(target),
            "rounds": val.get("rounds", []),
        })

    result.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return {"pulls": result}


@router.get("/repos/{rkey}/pulls/{pull_rkey}/assessment")
async def get_pr_assessment(rkey: str, pull_rkey: str, request: Request):
    """Get the compliance assessment for a specific pull request."""
    get_authenticated_session(request)
    session = _get_org_session()

    repo_rec = _get_repo_record(rkey)
    repo_uri = repo_rec["uri"]

    pulls = _list_records(session, "sh.tangled.repo.pull")
    pr_uri = ""
    for p in pulls:
        if p["rkey"] == pull_rkey:
            pr_uri = p["uri"]
            break

    if not pr_uri:
        raise HTTPException(status_code=404, detail="Pull request not found")

    assessments = _list_records(session, "sh.tangled.governance.compliance.prAssessment")
    assessment = None
    for a in assessments:
        v = a["value"]
        if v.get("pullRequest") == pr_uri:
            assessment = a
            break

    if not assessment:
        return {"assessment": None, "gate": None, "controlEvaluations": [], "impact": None}

    assessment_uri = assessment["uri"]
    av = assessment["value"]

    gates = _list_records(session, "sh.tangled.governance.compliance.mergeGate")
    gate = None
    for g in gates:
        if g["value"].get("prAssessment") == assessment_uri:
            gate = g
            break

    evals = _list_records(session, "sh.tangled.governance.compliance.controlEvaluation")
    control_evals = []
    for e in evals:
        if e["value"].get("prAssessment") == assessment_uri:
            ctrl_uri = e["value"].get("control", "")
            ctrl_rkey = ctrl_uri.rsplit("/", 1)[-1] if ctrl_uri else ""
            control_evals.append({
                "id": e["rkey"],
                "control": ctrl_rkey,
                "status": e["value"].get("status", ""),
                "reason": e["value"].get("reason", ""),
            })

    impacts = _list_records(session, "sh.tangled.governance.compliance.impactAssessment")
    impact = None
    for i in impacts:
        if i["value"].get("pullRequest") == pr_uri:
            impact = i
            break

    repos = _list_records(session, "sh.tangled.repo")
    uri_to_name: dict[str, str] = {}
    for r in repos:
        uri_to_name[r["uri"]] = r["rkey"]

    impact_data = None
    if impact:
        iv = impact["value"]
        affected = []
        for edge in iv.get("affectedEdges", []):
            ds_repo = edge.get("downstreamRepo", "")
            affected.append({
                "downstreamRepo": uri_to_name.get(ds_repo, ds_repo),
                "downstreamPath": edge.get("downstreamPath", ""),
                "reason": edge.get("reason", ""),
                "actionRequired": edge.get("actionRequired", ""),
            })
        impact_data = {
            "riskLevel": iv.get("riskLevel", ""),
            "summary": iv.get("summary", ""),
            "affectedEdges": affected,
        }

    return {
        "assessment": {
            "id": assessment["rkey"],
            "uri": assessment_uri,
            "riskLevel": av.get("riskLevel", ""),
            "summary": av.get("summary", ""),
            "changedFiles": av.get("changedFiles", 0),
            "controlsPassed": av.get("controlsPassed", 0),
            "controlsFailed": av.get("controlsFailed", 0),
            "controlsWarning": av.get("controlsWarning", 0),
            "createdAt": av.get("createdAt", ""),
        },
        "gate": {
            "status": gate["value"].get("status", "") if gate else "",
            "reason": gate["value"].get("reason", "") if gate else "",
            "blockedControls": gate["value"].get("blockedControls", []) if gate else [],
        } if gate else None,
        "controlEvaluations": control_evals,
        "impact": impact_data,
    }


def _resolve_pr_uri(session: dict, pull_rkey: str) -> str:
    """Find the AT-URI for a pull request by its rkey."""
    pulls = _list_records(session, "sh.tangled.repo.pull")
    for p in pulls:
        if p["rkey"] == pull_rkey:
            return p["uri"]
    return ""


@router.post("/repos/{rkey}/pulls/{pull_rkey}/close")
async def close_pull_request(rkey: str, pull_rkey: str, request: Request):
    """Close (delete) a pull request by writing a closed status record."""
    get_authenticated_session(request)
    session = _get_org_session()

    pr_uri = _resolve_pr_uri(session, pull_rkey)
    if not pr_uri:
        raise HTTPException(status_code=404, detail="Pull request not found")

    from datetime import datetime, timezone as tz
    now_iso = datetime.now(tz.utc).isoformat()

    resp = httpx.post(
        f"{session['pds_issuer']}/xrpc/com.atproto.repo.createRecord",
        json={
            "repo": session["did"],
            "collection": "sh.tangled.repo.pull.status",
            "record": {
                "$type": "sh.tangled.repo.pull.status",
                "pull": pr_uri,
                "status": "sh.tangled.repo.pull.status.closed",
                "createdAt": now_iso,
            },
        },
        headers={"Authorization": f"Bearer {session['access_token']}"},
        timeout=15,
    )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    return {"status": "closed", "pullRkey": pull_rkey}


@router.post("/repos/{rkey}/pulls/{pull_rkey}/merge")
async def merge_pull_request(rkey: str, pull_rkey: str, request: Request):
    """Merge a PR: merge on knot, write merged status, materialise incidents."""
    get_authenticated_session(request)
    session = _get_org_session()

    pr_uri = _resolve_pr_uri(session, pull_rkey)
    if not pr_uri:
        raise HTTPException(status_code=404, detail="Pull request not found")

    # Find the PR record to get source/target branches
    pulls = _list_records(session, "sh.tangled.repo.pull")
    pr_record = None
    for p in pulls:
        if p["rkey"] == pull_rkey:
            pr_record = p
            break
    if not pr_record:
        raise HTTPException(status_code=404, detail="Pull request record not found")

    pr_val = pr_record["value"]
    source = pr_val.get("source", {})
    target = pr_val.get("target", {})
    source_branch = source.get("branch", "") if isinstance(source, dict) else str(source)
    target_branch = target.get("branch", "main") if isinstance(target, dict) else "main"

    repo_rec = _get_repo_record(rkey)
    knot = repo_rec["value"].get("knot", "")
    owner_did = session["did"]
    handle = session.get("handle", "")

    from datetime import datetime, timezone as tz
    now_iso = datetime.now(tz.utc).isoformat()

    knot_merged = False
    knot_error = None

    # ── Step 1: Merge on the knot via sh.tangled.repo.merge ──────────
    if knot and source_branch:
        import asyncio
        loop = asyncio.get_event_loop()

        try:
            patch, author_name, author_email = await loop.run_in_executor(
                None, _generate_format_patch, handle, rkey, source_branch, target_branch
            )

            if patch:
                # Get ServiceAuth token for the knot
                knot_did = f"did:web:{knot}"
                sa_resp = httpx.get(
                    f"{session['pds_issuer']}/xrpc/com.atproto.server.getServiceAuth",
                    params={
                        "aud": knot_did,
                        "lxm": "sh.tangled.repo.merge",
                        "exp": str(int(__import__('time').time()) + 60),
                    },
                    headers={"Authorization": f"Bearer {session['access_token']}"},
                    timeout=15,
                )
                if sa_resp.status_code == 200:
                    sa_token = sa_resp.json().get("token", "")

                    merge_resp = httpx.post(
                        f"https://{knot}/xrpc/sh.tangled.repo.merge",
                        json={
                            "did": owner_did,
                            "name": rkey,
                            "patch": patch,
                            "branch": target_branch,
                            "commitMessage": f"Merge {source_branch} into {target_branch}",
                            "commitBody": f"PR: {pr_val.get('title', '')}\n\nMerged via TangledOrg governance platform.",
                            "authorName": author_name,
                            "authorEmail": author_email,
                        },
                        headers={"Authorization": f"Bearer {sa_token}"},
                        timeout=30,
                    )
                    if merge_resp.status_code in (200, 201, 204):
                        knot_merged = True
                    else:
                        knot_error = f"Knot merge failed ({merge_resp.status_code}): {merge_resp.text[:200]}"
                else:
                    knot_error = f"ServiceAuth failed ({sa_resp.status_code}): {sa_resp.text[:200]}"
            else:
                knot_error = "Could not generate format-patch (no diff between branches)"
        except Exception as exc:
            knot_error = f"Knot merge error: {str(exc)[:200]}"

    # ── Step 2: Write merged status to PDS ────────────────────────────
    resp = httpx.post(
        f"{session['pds_issuer']}/xrpc/com.atproto.repo.createRecord",
        json={
            "repo": session["did"],
            "collection": "sh.tangled.repo.pull.status",
            "record": {
                "$type": "sh.tangled.repo.pull.status",
                "pull": pr_uri,
                "status": "sh.tangled.repo.pull.status.merged",
                "createdAt": now_iso,
            },
        },
        headers={"Authorization": f"Bearer {session['access_token']}"},
        timeout=15,
    )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    # ── Step 3: Materialise incidents/issues from assessment ──────────
    materialized = 0
    try:
        from src.appview.pr_watcher import _materialize_on_merge
        materialized = await loop.run_in_executor(
            None, _materialize_on_merge, pr_uri, session
        )
    except ImportError:
        pass
    except Exception as exc:
        import logging
        logging.getLogger("api").exception("Materialisation failed for PR %s: %s", pull_rkey, exc)

    return {
        "status": "merged",
        "pullRkey": pull_rkey,
        "knotMerged": knot_merged,
        "knotError": knot_error,
        "materializedRecords": materialized,
    }


def _generate_format_patch(
    handle: str, rkey: str, source_branch: str, target_branch: str
) -> tuple[str, str, str]:
    """Clone the repo and generate a git format-patch for the merge.

    Returns (patch_text, author_name, author_email).
    """
    import subprocess, tempfile

    clone_url = f"https://tangled.sh/{handle}/{rkey}.git" if handle else ""
    if not clone_url:
        return ("", "", "")

    clone_dir = tempfile.mkdtemp(prefix="tangled_merge_")
    try:
        subprocess.run(
            ["git", "clone", "--depth", "50", clone_url, clone_dir],
            capture_output=True, timeout=60,
        )
        subprocess.run(
            ["git", "fetch", "origin", f"{source_branch}:{source_branch}"],
            capture_output=True, timeout=30, cwd=clone_dir,
        )
        result = subprocess.run(
            ["git", "format-patch", "--stdout", f"{target_branch}...{source_branch}"],
            capture_output=True, text=True, timeout=30, cwd=clone_dir,
        )
        patch = result.stdout

        # Get author info from the last commit on the branch
        author_result = subprocess.run(
            ["git", "log", "-1", "--format=%an|%ae", source_branch],
            capture_output=True, text=True, timeout=10, cwd=clone_dir,
        )
        parts = author_result.stdout.strip().split("|")
        author_name = parts[0] if len(parts) >= 1 else "TangledOrg"
        author_email = parts[1] if len(parts) >= 2 else "noreply@tangled.sh"

        return (patch, author_name, author_email)
    except Exception:
        return ("", "", "")
    finally:
        import shutil
        shutil.rmtree(clone_dir, ignore_errors=True)


@router.get("/repos/{rkey}/tree")
async def get_repo_tree(rkey: str, request: Request, ref: str = "main", path: str = ""):
    get_authenticated_session(request)  # auth check
    repo_rec = _get_repo_record(rkey)
    val = repo_rec["value"]
    knot = val.get("knot", "")
    owner_did = _get_org_session()["did"]

    if not knot:
        raise HTTPException(status_code=400, detail="Repo has no knot server configured")

    params: dict[str, str] = {"repo": f"{owner_did}/{rkey}", "ref": ref}
    if path:
        params["path"] = path

    try:
        resp = httpx.get(f"https://{knot}/xrpc/sh.tangled.repo.tree", params=params, timeout=10)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail=f"Cannot reach knot server: {knot}")


@router.get("/repos/{rkey}/log")
async def get_repo_log(rkey: str, request: Request, ref: str = "main", limit: int = 20):
    get_authenticated_session(request)  # auth check
    repo_rec = _get_repo_record(rkey)
    val = repo_rec["value"]
    knot = val.get("knot", "")
    owner_did = _get_org_session()["did"]

    if not knot:
        raise HTTPException(status_code=400, detail="Repo has no knot server configured")

    params: dict[str, str | int] = {"repo": f"{owner_did}/{rkey}", "ref": ref, "limit": limit}

    try:
        resp = httpx.get(f"https://{knot}/xrpc/sh.tangled.repo.log", params=params, timeout=10)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail=f"Cannot reach knot server: {knot}")


@router.get("/repos/{rkey}/branches")
async def list_repo_branches(rkey: str, request: Request, limit: int = 50):
    """List branches for a repo from the knot server."""
    get_authenticated_session(request)
    repo_rec = _get_repo_record(rkey)
    val = repo_rec["value"]
    knot = val.get("knot", "")
    owner_did = _get_org_session()["did"]

    if not knot:
        raise HTTPException(status_code=400, detail="Repo has no knot server configured")

    try:
        resp = httpx.get(
            f"https://{knot}/xrpc/sh.tangled.repo.branches",
            params={"repo": f"{owner_did}/{rkey}", "limit": limit},
            timeout=10,
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        raw = resp.json()
        branches = []
        for b in raw.get("branches", []):
            ref = b.get("reference", {})
            branches.append({
                "name": ref.get("name", ""),
                "hash": ref.get("hash", ""),
            })
        return {"branches": branches}
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail=f"Cannot reach knot server: {knot}")


class CreatePullRequest(BaseModel):
    title: str
    body: str = ""
    sourceBranch: str
    targetBranch: str = "main"


@router.post("/repos/{rkey}/pulls")
async def create_pull_request(rkey: str, body: CreatePullRequest, request: Request):
    """Create a pull request and auto-trigger compliance check."""
    get_authenticated_session(request)
    session = _get_org_session()

    repo_rec = _get_repo_record(rkey)
    repo_did = repo_rec["value"].get("repoDid", "")
    repo_uri = repo_rec["uri"]
    knot = repo_rec["value"].get("knot", "")
    owner_did = session["did"]

    if not repo_did:
        raise HTTPException(status_code=400, detail="Repo has no repoDid")

    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()

    pr_record = {
        "$type": "sh.tangled.repo.pull",
        "title": body.title[:200],
        "body": body.body[:5000] if body.body else "",
        "source": {
            "repo": repo_did,
            "branch": body.sourceBranch,
        },
        "target": {
            "repo": repo_did,
            "branch": body.targetBranch,
        },
        "rounds": [],
        "createdAt": now_iso,
    }

    # Write PR record to PDS
    resp = httpx.post(
        f"{session['pds_issuer']}/xrpc/com.atproto.repo.createRecord",
        json={
            "repo": session["did"],
            "collection": "sh.tangled.repo.pull",
            "record": pr_record,
        },
        headers={"Authorization": f"Bearer {session['access_token']}"},
        timeout=15,
    )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    pr_result = resp.json()
    pr_uri = pr_result.get("uri", "")
    pr_rkey = pr_uri.rsplit("/", 1)[-1] if "/" in pr_uri else ""

    # Write initial open status
    status_record = {
        "$type": "sh.tangled.repo.pull.status",
        "pull": pr_uri,
        "status": "sh.tangled.repo.pull.status.open",
        "createdAt": now_iso,
    }
    httpx.post(
        f"{session['pds_issuer']}/xrpc/com.atproto.repo.createRecord",
        json={
            "repo": session["did"],
            "collection": "sh.tangled.repo.pull.status",
            "record": status_record,
        },
        headers={"Authorization": f"Bearer {session['access_token']}"},
        timeout=15,
    )

    # Auto-trigger compliance pipeline
    compliance_result = None
    try:
        from src.agent.nodes import ComplianceState, graph

        if graph is not None and knot:
            import asyncio

            handle = session.get("handle", "")
            clone_url = f"https://tangled.sh/{handle}/{rkey}.git" if handle else f"https://{knot}/{owner_did}/{rkey}.git"
            state = ComplianceState(
                pr_uri=pr_uri,
                repo_uri=repo_uri,
                repo_clone_url=clone_url,
                pr_branch=body.sourceBranch,
                base_branch=body.targetBranch,
            )
            loop = asyncio.get_event_loop()
            raw = await loop.run_in_executor(None, graph.invoke, state)
            r = raw if isinstance(raw, dict) else vars(raw)
            compliance_result = {
                "gate_status": r.get("gate_status", ""),
                "gate_reason": r.get("gate_reason", ""),
                "risk_level": r.get("risk_level", ""),
                "summary": r.get("summary", ""),
                "records_written": r.get("records_written", 0),
                "pr_assessment_uri": r.get("pr_assessment_uri", ""),
            }
    except ImportError:
        pass
    except Exception as exc:
        compliance_result = {"error": str(exc)}

    handle = session.get("handle", "")
    tangled_pr_url = (
        f"https://tangled.org/{handle}/{rkey}/pulls/new"
        f"?source=branch&sourceBranch={body.sourceBranch}&targetBranch={body.targetBranch}"
    ) if handle else None

    return {
        "uri": pr_uri,
        "rkey": pr_rkey,
        "title": body.title,
        "sourceBranch": body.sourceBranch,
        "targetBranch": body.targetBranch,
        "status": "open",
        "compliance": compliance_result,
        "tangledUrl": tangled_pr_url,
    }


class RepoProfileCreate(BaseModel):
    repoUri: str
    orgUri: str
    dataClassification: str
    handlesData: Optional[list[str]] = None
    applicableRegulations: Optional[list[str]] = None
    riskTier: Optional[str] = None
    enforcementMode: Optional[str] = None
    description: Optional[str] = None


@router.post("/repos/{rkey}/profile")
async def create_repo_profile(rkey: str, body: RepoProfileCreate, request: Request):
    get_authenticated_session(request)  # auth check
    session = _get_org_session()
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "org": body.orgUri,
        "repo": body.repoUri,
        "dataClassification": body.dataClassification,
        "createdAt": now,
    }
    if body.handlesData:
        record["handlesData"] = body.handlesData
    if body.applicableRegulations:
        record["applicableRegulations"] = body.applicableRegulations
    if body.riskTier:
        record["riskTier"] = body.riskTier
    if body.enforcementMode:
        record["enforcementMode"] = body.enforcementMode
    if body.description:
        record["description"] = body.description

    result = _create_record(session, "sh.tangled.governance.compliance.repoProfile", record)
    return result


# ── Policies ─────────────────────────────────────────────────────────────────


@router.get("/policies")
async def list_policies(request: Request):
    get_authenticated_session(request)  # auth check
    session = _get_org_session()
    packs = _list_records(session, "sh.tangled.governance.policy.policyPack")
    controls = _list_records(session, "sh.tangled.governance.policy.control")
    bindings = _list_records(session, "sh.tangled.governance.policy.repoBinding")
    repos = _list_records(session, "sh.tangled.repo")

    repo_uri_to_name: dict[str, str] = {}
    for r in repos:
        repo_uri_to_name[r["uri"]] = r["rkey"]

    policy_packs = []
    for p in packs:
        val = p["value"]
        pack_uri = p["uri"]

        pack_controls = [
            {"id": c["rkey"], "uri": c["uri"], **c["value"]}
            for c in controls if c["value"].get("policyPack") == pack_uri
        ]
        pack_bindings = []
        for b in bindings:
            if b["value"].get("policyPack") == pack_uri:
                repo_at_uri = b["value"].get("repo", "")
                repo_name = repo_uri_to_name.get(repo_at_uri, repo_at_uri.rsplit("/", 1)[-1] if "/" in repo_at_uri else "")
                pack_bindings.append({
                    "id": b["rkey"], "uri": b["uri"], **b["value"],
                    "repoSlug": repo_name,
                })

        policy_packs.append({
            "id": p["rkey"], "uri": pack_uri,
            "name": val.get("name", ""),
            "displayName": val.get("displayName", val.get("name", "")),
            "description": val.get("description", ""),
            "framework": val.get("framework"),
            "version": val.get("version", ""),
            "controls": pack_controls,
            "controlCount": len(pack_controls),
            "bindings": pack_bindings,
            "bindingCount": len(pack_bindings),
        })

    return {"policyPacks": policy_packs}


class PolicyPackCreate(BaseModel):
    orgUri: str
    name: str
    description: Optional[str] = None
    framework: str = "custom"
    version: str = "1.0"
    controls: Optional[list[dict]] = None


@router.post("/policies")
async def create_policy_pack(body: PolicyPackCreate, request: Request):
    """Create a new policy pack and optionally its controls."""
    get_authenticated_session(request)  # auth check
    session = _get_org_session()
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "org": body.orgUri,
        "name": body.name,
        "displayName": body.name,
        "framework": body.framework,
        "version": body.version,
        "createdAt": now,
    }
    if body.description:
        record["description"] = body.description

    pack_result = _create_record(session, "sh.tangled.governance.policy.policyPack", record)
    pack_uri = pack_result.get("uri", "")

    created_controls = []
    for ctrl in (body.controls or []):
        ctrl_record = {
            "policyPack": pack_uri,
            "controlId": ctrl.get("controlId", ""),
            "name": ctrl.get("name", ""),
            "description": ctrl.get("description", ""),
            "checkType": ctrl.get("checkType", "automated"),
            "enforcement": ctrl.get("enforcement", "warn"),
            "severity": ctrl.get("severity", "medium"),
        }
        if ctrl.get("scanTool"):
            ctrl_record["scanTool"] = ctrl["scanTool"]
        if ctrl.get("isoReference"):
            ctrl_record["isoReference"] = ctrl["isoReference"]
        result = _create_record(session, "sh.tangled.governance.policy.control", ctrl_record)
        created_controls.append(result)

    return {"pack": pack_result, "controls": created_controls}


class PolicyBindingCreate(BaseModel):
    repoUri: str
    policyPackUri: str
    enforcementOverride: Optional[str] = None


@router.post("/policies/bind")
async def create_policy_binding(body: PolicyBindingCreate, request: Request):
    user_session = get_authenticated_session(request)  # auth check
    session = _get_org_session()
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "repo": body.repoUri,
        "policyPack": body.policyPackUri,
        "boundBy": user_session["did"],
        "createdAt": now,
    }
    if body.enforcementOverride:
        record["enforcementOverride"] = body.enforcementOverride
    return _create_record(session, "sh.tangled.governance.policy.repoBinding", record)


# ── Incidents ────────────────────────────────────────────────────────────────


@router.get("/incidents")
async def list_incidents(request: Request):
    get_authenticated_session(request)  # auth check
    session = _get_org_session()
    incidents = _list_records(session, "sh.tangled.governance.compliance.incident")
    sla_trackers = _list_records(session, "sh.tangled.governance.compliance.slaTracker")

    # Resolve linked issues (include createdBy DID for assignee resolution)
    issues = _list_records(session, "sh.tangled.repo.issue")
    issue_map: dict[str, dict] = {}
    for iss in issues:
        issue_map[iss["uri"]] = {
            "uri": iss["uri"],
            "title": iss["value"].get("title", ""),
            "body": iss["value"].get("body", ""),
            "createdAt": iss["value"].get("createdAt", ""),
            "createdBy": iss["value"].get("createdBy", ""),
        }

    # Resolve repo names
    repos = _list_records(session, "sh.tangled.repo")
    repo_uri_to_name: dict[str, str] = {}
    for r in repos:
        repo_uri_to_name[r["uri"]] = r["rkey"]

    sla_map = {}
    for s in sla_trackers:
        sla_map[s["value"].get("incident", "")] = s["value"]

    # Build DID→handle map from membership records for assignee resolution
    memberships = _list_records(session, "sh.tangled.governance.org.membership")
    member_dids = list({m["value"].get("memberDid", "") for m in memberships if m["value"].get("memberDid")})
    did_to_handle: dict[str, str] = {}
    if member_dids:
        did_to_handle = _resolve_dids_batch(session["pds_issuer"], member_dids)

    # Find the default org-owner handle as fallback assignee
    roles = _list_records(session, "sh.tangled.governance.org.role")
    role_map = {r["uri"]: r["value"] for r in roles}
    owner_handle: str = ""
    for m in memberships:
        val_m = m["value"]
        role_data = role_map.get(val_m.get("role", ""), {})
        if role_data.get("slug", "") in ("owner", "admin"):
            did = val_m.get("memberDid", "")
            owner_handle = did_to_handle.get(did, did)
            break

    result = []
    for inc in incidents:
        val = inc["value"]
        issue_uri = val.get("issue", "")
        repo_uri = val.get("repo", "")
        linked_issue = issue_map.get(issue_uri)

        # Resolve assignee: prefer issue creator → org owner fallback
        created_by_did = (linked_issue or {}).get("createdBy", "") or val.get("createdBy", "")
        assignee_handle = did_to_handle.get(created_by_did, "") or owner_handle

        result.append({
            "id": inc["rkey"], "uri": inc["uri"], **val,
            "sla": sla_map.get(inc["uri"]),
            "linkedIssue": linked_issue,
            "repoName": repo_uri_to_name.get(repo_uri, ""),
            "assignedTo": assignee_handle,
        })
    return {"incidents": result}


# ── Agent ────────────────────────────────────────────────────────────────────


class ChatRequest(BaseModel):
    message: str
    history: Optional[list[dict]] = None  # [{"role": "human"|"assistant", "content": str}]


@router.post("/agent/chat")
async def agent_chat(body: ChatRequest, request: Request):
    """Chat with the Tangled Org AI assistant.

    The agent has access to all tools — repos, issues, PRs, compliance,
    policies, audit logs, and dependency graphs.

    Requires: pip install 'tangled-org[agent]' and TANGLED_ORG_ANTHROPIC_API_KEY
    """
    get_authenticated_session(request)  # auth check

    try:
        from src.agent.chat import run_chat
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Agent dependencies not installed. Run: pip install 'tangled-org[agent]'",
        )

    import asyncio

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None, run_chat, body.message, body.history
        )
        return {"response": response}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Agent error: {exc}")


class AgentRunRequest(BaseModel):
    pr_uri: str
    repo_uri: str
    repo_clone_url: str
    pr_branch: str
    base_branch: str = "main"


@router.post("/agent/run")
async def run_agent(body: AgentRunRequest, request: Request):
    """Trigger a compliance agent run for a pull request.

    Requires the [agent] optional dependencies:
      pip install 'tangled-org[agent]'
    """
    get_authenticated_session(request)  # auth check

    try:
        from src.agent.nodes import ComplianceState, graph  # lazy import
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Agent dependencies not installed. Run: pip install 'tangled-org[agent]'",
        )

    if graph is None:
        raise HTTPException(
            status_code=503,
            detail="LangGraph not available. Run: pip install 'tangled-org[agent]'",
        )

    import asyncio

    state = ComplianceState(
        pr_uri=body.pr_uri,
        repo_uri=body.repo_uri,
        repo_clone_url=body.repo_clone_url,
        pr_branch=body.pr_branch,
        base_branch=body.base_branch,
    )

    # Run synchronous graph in a thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    raw = await loop.run_in_executor(None, graph.invoke, state)

    r = raw if isinstance(raw, dict) else vars(raw)
    return {
        "gate_status": r.get("gate_status", ""),
        "gate_reason": r.get("gate_reason", ""),
        "risk_level": r.get("risk_level", ""),
        "summary": r.get("summary", ""),
        "records_written": r.get("records_written", 0),
        "agent_run_uri": r.get("agent_run_uri", ""),
        "pr_assessment_uri": r.get("pr_assessment_uri", ""),
        "downstream_issues": r.get("downstream_issues_created", []),
        "error": r.get("error"),
    }


class ScanRequest(BaseModel):
    repo_rkey: str


@router.post("/agent/scan")
async def run_scan(body: ScanRequest, request: Request):
    """Trigger a compliance scan on a repository's source code.

    Reads the repo's bound policy pack and controls, fetches source files
    from the knot server, evaluates them with Claude, and creates issues
    for any violations found.
    """
    get_authenticated_session(request)  # auth check

    try:
        from src.agent.nodes.scan import ScanState, scan_graph
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Agent dependencies not installed. Run: pip install 'tangled-org[agent]'",
        )

    if scan_graph is None:
        raise HTTPException(
            status_code=503,
            detail="LangGraph not available. Run: pip install 'tangled-org[agent]'",
        )

    import asyncio

    initial = ScanState(repo_rkey=body.repo_rkey)
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, scan_graph.invoke, initial)

    # LangGraph returns a dict keyed by field name
    r = result if isinstance(result, dict) else vars(result)
    return {
        "repo": r.get("repo_rkey", body.repo_rkey),
        "risk_level": r.get("risk_level", "low"),
        "summary": r.get("summary", ""),
        "policy_pack": r.get("policy_pack_name", ""),
        "files_scanned": r.get("files_scanned", 0),
        "controls_passed": r.get("controls_passed", 0),
        "controls_failed": r.get("controls_failed", 0),
        "controls_warning": r.get("controls_warning", 0),
        "findings": r.get("findings", []),
        "issues_created": r.get("issues_created", []),
        "incidents_created": r.get("incidents_created", []),
        "cross_repo_findings": r.get("cross_repo_findings", []),
        "cross_repo_issues_created": r.get("cross_repo_issues_created", []),
        "duration_ms": int((time.time() - r.get("started", time.time())) * 1000),
        "error": r.get("error"),
    }


@router.get("/repos/{rkey}/scans")
async def list_repo_scans(rkey: str, request: Request):
    """List scan history for a repo, most recent first."""
    get_authenticated_session(request)
    session = _get_org_session()
    scans = _list_records(session, "sh.tangled.governance.compliance.scanResult")
    repos = _list_records(session, "sh.tangled.repo")

    repo_uri = ""
    for r in repos:
        if r["rkey"] == rkey:
            repo_uri = r["uri"]
            break

    result = []
    for s in scans:
        val = s["value"]
        if val.get("repo") != repo_uri:
            continue
        findings = []
        if val.get("findingsJson"):
            try:
                findings = __import__("json").loads(val["findingsJson"])
            except Exception:
                pass
        result.append({
            "id": s["rkey"],
            "uri": s["uri"],
            "riskLevel": val.get("riskLevel", "low"),
            "summary": val.get("summary", ""),
            "policyPack": val.get("policyPack", ""),
            "filesScanned": val.get("filesScanned", 0),
            "controlsPassed": val.get("controlsPassed", 0),
            "controlsFailed": val.get("controlsFailed", 0),
            "controlsWarning": val.get("controlsWarning", 0),
            "findingsCount": val.get("findingsCount", 0),
            "findings": findings,
            "issuesCreated": val.get("issuesCreated", 0),
            "durationMs": val.get("durationMs"),
            "error": val.get("error"),
            "createdAt": val.get("createdAt", ""),
        })

    result.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return {"scans": result}


class IncidentCreate(BaseModel):
    title: str
    description: str
    repoUri: str
    orgUri: Optional[str] = None
    severity: str
    category: str
    affectedPackage: Optional[str] = None
    cveIds: Optional[list[str]] = None
    linkedPR: Optional[str] = None


@router.post("/incidents")
async def create_incident(body: IncidentCreate, request: Request):
    user_session = get_authenticated_session(request)  # auth check
    session = _get_org_session()
    now = datetime.now(timezone.utc).isoformat()

    issue_record = {
        "title": body.title,
        "description": body.description,
        "repo": body.repoUri,
        "createdAt": now,
        "createdBy": user_session["did"],
    }
    issue_result = _create_record(session, "sh.tangled.issue", issue_record)

    incident_record = {
        "issue": issue_result.get("uri", ""),
        "repo": body.repoUri,
        "severity": body.severity,
        "category": body.category,
        "description": body.description,
        "status": "open",
        "createdAt": now,
    }
    if body.orgUri:
        incident_record["org"] = body.orgUri
    if body.affectedPackage:
        incident_record["affectedPackage"] = body.affectedPackage
    if body.cveIds:
        incident_record["cveIds"] = body.cveIds
    if body.linkedPR:
        incident_record["linkedPR"] = body.linkedPR

    return _create_record(session, "sh.tangled.governance.compliance.incident", incident_record)


# ── Audit ────────────────────────────────────────────────────────────────────


@router.get("/audit")
async def list_audit(request: Request):
    get_authenticated_session(request)  # auth check
    session = _get_org_session()
    agent_runs = _list_records(session, "sh.tangled.governance.audit.agentRun")
    evidence = _list_records(session, "sh.tangled.governance.audit.evidence")
    waivers = _list_records(session, "sh.tangled.governance.audit.waiver")
    incidents = _list_records(session, "sh.tangled.governance.compliance.incident")
    scan_records = _list_records(session, "sh.tangled.governance.compliance.scanResult")

    repos = _list_records(session, "sh.tangled.repo")
    repo_uri_to_name: dict[str, str] = {}
    for r in repos:
        repo_uri_to_name[r["uri"]] = r["rkey"]

    issues = _list_records(session, "sh.tangled.repo.issue")
    issue_uri_to_title: dict[str, str] = {}
    for iss in issues:
        issue_uri_to_title[iss["uri"]] = iss["value"].get("title", "")

    entries = []
    for r in agent_runs:
        v = r["value"]
        repo_name = repo_uri_to_name.get(v.get("repo", ""), "")
        entries.append({
            "id": r["rkey"], "type": "agent-run", "uri": r["uri"],
            "description": f"Agent run on {repo_name or 'repo'}: {v.get('status', 'unknown')}",
            "targetLabel": repo_name,
            "createdAt": v.get("startedAt", v.get("completedAt", "")),
            "metadata": {
                "status": v.get("status", ""),
                "duration": f"{v.get('durationMs', 0)}ms" if v.get("durationMs") else None,
                "records": v.get("recordsWritten"),
            },
            **v,
        })
    for e in evidence:
        v = e["value"]
        entries.append({
            "id": e["rkey"], "type": "evidence", "uri": e["uri"],
            "description": v.get("title", v.get("summary", "Evidence record")),
            "targetLabel": v.get("evidenceType", ""),
            "createdAt": v.get("createdAt", ""),
            "metadata": {
                "findings": v.get("findingsCount"),
                "type": v.get("evidenceType", ""),
            },
            **v,
        })
    for w in waivers:
        v = w["value"]
        entries.append({
            "id": w["rkey"], "type": "waiver", "uri": w["uri"],
            "description": v.get("reason", "Waiver granted"),
            "targetLabel": repo_uri_to_name.get(v.get("repo", ""), ""),
            "createdAt": v.get("createdAt", ""),
            "metadata": {
                "status": v.get("status", ""),
                "expires": v.get("expiresAt", ""),
            },
            **v,
        })
    for inc in incidents:
        v = inc["value"]
        repo_name = repo_uri_to_name.get(v.get("repo", ""), "")
        issue_title = issue_uri_to_title.get(v.get("issue", ""), "")
        entries.append({
            "id": inc["rkey"], "type": "incident", "uri": inc["uri"],
            "description": issue_title or v.get("description", "Compliance incident"),
            "targetLabel": repo_name,
            "createdAt": v.get("createdAt", ""),
            "metadata": {
                "severity": v.get("severity", ""),
                "category": v.get("category", ""),
                "status": v.get("status", ""),
            },
            **v,
        })

    for sc in scan_records:
        v = sc["value"]
        repo_name = repo_uri_to_name.get(v.get("repo", ""), "")
        risk = v.get("riskLevel", "low")
        passed = v.get("controlsPassed", 0)
        failed = v.get("controlsFailed", 0)
        warning = v.get("controlsWarning", 0)
        entries.append({
            "id": sc["rkey"], "type": "scan", "uri": sc["uri"],
            "description": f"AI code review on {repo_name}: {v.get('findingsCount', 0)} findings, risk {risk}",
            "targetLabel": repo_name,
            "createdAt": v.get("createdAt", ""),
            "metadata": {
                "risk": risk,
                "passed": passed,
                "failed": failed,
                "warning": warning,
                "files": v.get("filesScanned", 0),
                "issues": v.get("issuesCreated", 0),
                "duration": f"{v.get('durationMs', 0)}ms" if v.get("durationMs") else None,
            },
            **v,
        })

    entries.sort(key=lambda x: x.get("createdAt", x.get("startedAt", "")), reverse=True)
    return {"entries": entries}


# ── Dependency Graph ─────────────────────────────────────────────────────────


@router.get("/graph")
async def list_graph(request: Request):
    get_authenticated_session(request)  # auth check
    session = _get_org_session()
    repos = _list_records(session, "sh.tangled.repo")
    repo_deps = _list_records(session, "sh.tangled.governance.graph.repoDependency")
    code_deps = _list_records(session, "sh.tangled.governance.graph.codeDependency")
    service_deps = _list_records(session, "sh.tangled.governance.graph.serviceDependency")
    profiles = _list_records(session, "sh.tangled.governance.compliance.repoProfile")

    profile_map = {}
    for p in profiles:
        repo_uri = p["value"].get("repo", "")
        profile_map[repo_uri] = p["value"]

    return {
        "repos": [{"id": r["rkey"], "uri": r["uri"], "name": r["rkey"], **r["value"]} for r in repos],
        "repoDependencies": [{"id": r["rkey"], "uri": r["uri"], **r["value"]} for r in repo_deps],
        "codeDependencies": [{"id": r["rkey"], "uri": r["uri"], **r["value"]} for r in code_deps],
        "serviceDependencies": [{"id": r["rkey"], "uri": r["uri"], **r["value"]} for r in service_deps],
        "repoProfiles": profile_map,
    }


class RepoDependencyCreate(BaseModel):
    sourceRepo: str
    targetRepo: str
    dependencyType: str
    description: Optional[str] = None


@router.post("/graph/repo-dependency")
async def create_repo_dependency(body: RepoDependencyCreate, request: Request):
    get_authenticated_session(request)  # auth check
    session = _get_org_session()
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "sourceRepo": body.sourceRepo,
        "targetRepo": body.targetRepo,
        "dependencyType": body.dependencyType,
        "createdAt": now,
    }
    if body.description:
        record["description"] = body.description
    return _create_record(session, "sh.tangled.governance.graph.repoDependency", record)


class CodeDependencyCreate(BaseModel):
    sourceRepo: str
    sourcePath: str
    sourceLabel: Optional[str] = None
    targetRepo: str
    targetPath: str
    targetLabel: Optional[str] = None
    dependencyType: str
    description: Optional[str] = None


@router.post("/graph/code-dependency")
async def create_code_dependency(body: CodeDependencyCreate, request: Request):
    get_authenticated_session(request)  # auth check
    session = _get_org_session()
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "sourceRepo": body.sourceRepo,
        "sourcePath": body.sourcePath,
        "targetRepo": body.targetRepo,
        "targetPath": body.targetPath,
        "dependencyType": body.dependencyType,
        "createdAt": now,
    }
    if body.sourceLabel:
        record["sourceLabel"] = body.sourceLabel
    if body.targetLabel:
        record["targetLabel"] = body.targetLabel
    if body.description:
        record["description"] = body.description
    return _create_record(session, "sh.tangled.governance.graph.codeDependency", record)


class DeleteRecord(BaseModel):
    collection: str
    rkey: str


@router.post("/graph/delete")
async def delete_graph_edge(body: DeleteRecord, request: Request):
    get_authenticated_session(request)  # auth check
    session = _get_org_session()
    _delete_record(session, body.collection, body.rkey)
    return {"ok": True}
