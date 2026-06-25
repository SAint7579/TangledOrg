"""REST API routes serving governance data from ATProto.

All shared org data (repos, policies, members, incidents, etc.) is stored
under the org owner's DID on the PDS.  We use the app-password–based
"org session" for reads *and* writes so that every member of the org sees
(and contributes to) the same dataset.  The OAuth user session is still
checked for authentication — you must be logged in — but the actual PDS
I/O goes through the org owner's credentials.
"""

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


@router.get("/repos/{rkey}/tree")
async def get_repo_tree(rkey: str, request: Request, ref: str = "main", path: str = ""):
    get_authenticated_session(request)  # auth check
    repo_rec = _get_repo_record(rkey)
    val = repo_rec["value"]
    knot = val.get("knot", "")
    repo_did = val.get("repoDid", "")

    if not knot:
        raise HTTPException(status_code=400, detail="Repo has no knot server configured")

    params: dict[str, str] = {"repo": f"{repo_did}/{rkey}", "ref": ref}
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
    repo_did = val.get("repoDid", "")

    if not knot:
        raise HTTPException(status_code=400, detail="Repo has no knot server configured")

    params: dict[str, str | int] = {"repo": f"{repo_did}/{rkey}", "ref": ref, "limit": limit}

    try:
        resp = httpx.get(f"https://{knot}/xrpc/sh.tangled.repo.log", params=params, timeout=10)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail=f"Cannot reach knot server: {knot}")


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

    policy_packs = []
    for p in packs:
        val = p["value"]
        pack_uri = p["uri"]

        pack_controls = [
            {"id": c["rkey"], "uri": c["uri"], **c["value"]}
            for c in controls if c["value"].get("policyPack") == pack_uri
        ]
        pack_bindings = [
            {"id": b["rkey"], "uri": b["uri"], **b["value"]}
            for b in bindings if b["value"].get("policyPack") == pack_uri
        ]

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

    sla_map = {}
    for s in sla_trackers:
        sla_map[s["value"].get("incident", "")] = s["value"]

    result = []
    for inc in incidents:
        val = inc["value"]
        result.append({
            "id": inc["rkey"], "uri": inc["uri"], **val,
            "sla": sla_map.get(inc["uri"]),
        })
    return {"incidents": result}


# --- Agent ---


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
    result: ComplianceState = await loop.run_in_executor(None, graph.invoke, state)

    return {
        "gate_status": result.gate_status,
        "gate_reason": result.gate_reason,
        "risk_level": result.risk_level,
        "summary": result.summary,
        "records_written": result.records_written,
        "agent_run_uri": result.agent_run_uri,
        "pr_assessment_uri": result.pr_assessment_uri,
        "error": result.error,
    }


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

    entries = []
    for r in agent_runs:
        entries.append({"id": r["rkey"], "type": "agent-run", "uri": r["uri"], **r["value"]})
    for e in evidence:
        entries.append({"id": e["rkey"], "type": "evidence", "uri": e["uri"], **e["value"]})
    for w in waivers:
        entries.append({"id": w["rkey"], "type": "waiver", "uri": w["uri"], **w["value"]})

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

    return {
        "repos": [{"id": r["rkey"], "uri": r["uri"], "name": r["rkey"], **r["value"]} for r in repos],
        "repoDependencies": [{"id": r["rkey"], "uri": r["uri"], **r["value"]} for r in repo_deps],
        "codeDependencies": [{"id": r["rkey"], "uri": r["uri"], **r["value"]} for r in code_deps],
        "serviceDependencies": [{"id": r["rkey"], "uri": r["uri"], **r["value"]} for r in service_deps],
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
