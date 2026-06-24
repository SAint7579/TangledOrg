"""REST API routes serving governance data from ATProto."""

from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional

from src.appview.routes.auth import get_authenticated_session

router = APIRouter(prefix="/api", tags=["api"])


def _list_records(session: dict, collection: str) -> list[dict]:
    import httpx

    resp = httpx.get(
        f"{session['pds_issuer']}/xrpc/com.atproto.repo.listRecords",
        params={"repo": session["did"], "collection": collection, "limit": 100},
        headers={"Authorization": f"Bearer {session['access_token']}"},
    )
    if resp.status_code != 200:
        return []

    records = []
    for r in resp.json().get("records", []):
        uri = r.get("uri", "")
        rkey = uri.rsplit("/", 1)[-1] if "/" in uri else ""
        records.append({"uri": uri, "cid": r.get("cid", ""), "rkey": rkey, "value": r.get("value", {})})
    return records


def _create_record(session: dict, collection: str, record: dict, rkey: str | None = None) -> dict:
    import httpx

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
    )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


def _delete_record(session: dict, collection: str, rkey: str) -> None:
    import httpx

    resp = httpx.post(
        f"{session['pds_issuer']}/xrpc/com.atproto.repo.deleteRecord",
        json={"repo": session["did"], "collection": collection, "rkey": rkey},
        headers={"Authorization": f"Bearer {session['access_token']}"},
    )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=resp.status_code, detail=resp.text)


# ── Organization ─────────────────────────────────────────────────────────────


@router.get("/org")
async def list_orgs(request: Request):
    session = get_authenticated_session(request)
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
    session = get_authenticated_session(request)
    memberships = _list_records(session, "sh.tangled.governance.org.membership")
    roles = _list_records(session, "sh.tangled.governance.org.role")
    teams = _list_records(session, "sh.tangled.governance.org.team")

    org_uri_suffix = f"sh.tangled.governance.org.organization/{rkey}"
    role_map = {r["uri"]: r["value"] for r in roles}
    team_map = {t["uri"]: t["value"] for t in teams}

    members = []
    for m in memberships:
        val = m["value"]
        org_uri = val.get("org", "")
        if rkey != "all" and org_uri_suffix not in org_uri:
            continue

        role_data = role_map.get(val.get("role", ""), {})
        member_teams = []
        for team_uri in (val.get("teams") or []):
            td = team_map.get(team_uri, {})
            if td:
                member_teams.append({"name": td.get("name", ""), "displayName": td.get("displayName", "")})

        members.append({
            "id": m["rkey"], "uri": m["uri"],
            "did": val.get("memberDid", ""),
            "handle": "",
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


# ── Repos ────────────────────────────────────────────────────────────────────


@router.get("/repos")
async def list_repos(request: Request):
    session = get_authenticated_session(request)
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
    session = get_authenticated_session(request)
    profiles = _list_records(session, "sh.tangled.governance.compliance.repoProfile")
    for p in profiles:
        if rkey in p["value"].get("repo", ""):
            return {"profile": p["value"], "uri": p["uri"], "rkey": p["rkey"]}
    return {"profile": None}


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
    session = get_authenticated_session(request)
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
    session = get_authenticated_session(request)
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


class PolicyBindingCreate(BaseModel):
    repoUri: str
    policyPackUri: str
    enforcementOverride: Optional[str] = None


@router.post("/policies/bind")
async def create_policy_binding(body: PolicyBindingCreate, request: Request):
    session = get_authenticated_session(request)
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "repo": body.repoUri,
        "policyPack": body.policyPackUri,
        "boundBy": session["did"],
        "createdAt": now,
    }
    if body.enforcementOverride:
        record["enforcementOverride"] = body.enforcementOverride
    return _create_record(session, "sh.tangled.governance.policy.repoBinding", record)


# ── Incidents ────────────────────────────────────────────────────────────────


@router.get("/incidents")
async def list_incidents(request: Request):
    session = get_authenticated_session(request)
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
    session = get_authenticated_session(request)
    now = datetime.now(timezone.utc).isoformat()

    issue_record = {
        "title": body.title,
        "description": body.description,
        "repo": body.repoUri,
        "createdAt": now,
        "createdBy": session["did"],
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
    session = get_authenticated_session(request)
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
    session = get_authenticated_session(request)
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
    session = get_authenticated_session(request)
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
    session = get_authenticated_session(request)
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
    session = get_authenticated_session(request)
    _delete_record(session, body.collection, body.rkey)
    return {"ok": True}
