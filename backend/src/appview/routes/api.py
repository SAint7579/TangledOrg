"""REST API routes serving governance data from ATProto."""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

from atproto import Client, models

from src.appview.routes.auth import get_authenticated_session

router = APIRouter(prefix="/api", tags=["api"])


def _get_pds_client(session: dict) -> Client:
    """Create an ATProto client from session credentials."""
    client = Client(base_url=session["pds_issuer"])
    client.login(session["handle"], password=None)
    client._session = type("S", (), {
        "access_jwt": session["access_token"],
        "refresh_jwt": session["refresh_token"],
        "did": session["did"],
        "handle": session["handle"],
    })()
    return client


def _list_records(session: dict, collection: str) -> list[dict]:
    """List records from the user's PDS using their session token."""
    import httpx

    resp = httpx.get(
        f"{session['pds_issuer']}/xrpc/com.atproto.repo.listRecords",
        params={
            "repo": session["did"],
            "collection": collection,
            "limit": 100,
        },
        headers={"Authorization": f"Bearer {session['access_token']}"},
    )
    if resp.status_code != 200:
        return []

    data = resp.json()
    records = []
    for r in data.get("records", []):
        uri = r.get("uri", "")
        rkey = uri.rsplit("/", 1)[-1] if "/" in uri else ""
        records.append({
            "uri": uri,
            "cid": r.get("cid", ""),
            "rkey": rkey,
            "value": r.get("value", {}),
        })
    return records


# --- Organization ---


@router.get("/org")
async def list_orgs(request: Request):
    session = get_authenticated_session(request)
    records = _list_records(session, "sh.tangled.governance.org.organization")
    orgs = []
    for r in records:
        val = r["value"]
        orgs.append({
            "id": r["rkey"],
            "uri": r["uri"],
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

    org_uri_suffix = f"sh.tangled.governance.org.organization/{rkey}"

    role_map = {}
    for r in roles:
        role_map[r["uri"]] = r["value"]

    members = []
    for m in memberships:
        val = m["value"]
        org_uri = val.get("org", "")
        if rkey != "all" and org_uri_suffix not in org_uri:
            continue

        role_uri = val.get("role", "")
        role_data = role_map.get(role_uri, {})

        members.append({
            "id": m["rkey"],
            "uri": m["uri"],
            "did": val.get("memberDid", ""),
            "handle": "",
            "role": {
                "slug": role_data.get("slug", ""),
                "name": role_data.get("name", ""),
            },
            "invitedBy": val.get("invitedBy"),
            "createdAt": val.get("createdAt", ""),
        })

    return {"members": members, "roles": [r["value"] for r in roles]}


# --- Repos ---


@router.get("/repos")
async def list_repos(request: Request):
    session = get_authenticated_session(request)
    records = _list_records(session, "sh.tangled.repo")

    repos = []
    for r in records:
        val = r["value"]
        repos.append({
            "id": r["rkey"],
            "uri": r["uri"],
            "name": r["rkey"],
            "knot": val.get("knot", ""),
            "repoDid": val.get("repoDid", ""),
            "createdAt": val.get("createdAt", ""),
        })
    return {"repos": repos}


@router.get("/repos/{rkey}/profile")
async def get_repo_profile(rkey: str, request: Request):
    session = get_authenticated_session(request)
    profiles = _list_records(session, "sh.tangled.governance.compliance.repoProfile")

    for p in profiles:
        repo_uri = p["value"].get("repo", "")
        if rkey in repo_uri:
            return {"profile": p["value"], "uri": p["uri"]}

    return {"profile": None}


# --- Policies ---


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
            c["value"] for c in controls
            if c["value"].get("policyPack") == pack_uri
        ]
        pack_bindings = [
            b["value"] for b in bindings
            if b["value"].get("policyPack") == pack_uri
        ]

        policy_packs.append({
            "id": p["rkey"],
            "uri": pack_uri,
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


# --- Audit ---


@router.get("/audit")
async def list_audit(request: Request):
    session = get_authenticated_session(request)

    agent_runs = _list_records(session, "sh.tangled.governance.audit.agentRun")
    evidence = _list_records(session, "sh.tangled.governance.audit.evidence")
    waivers = _list_records(session, "sh.tangled.governance.audit.waiver")

    entries = []
    for r in agent_runs:
        val = r["value"]
        entries.append({
            "id": r["rkey"],
            "type": "AGENT_RUN",
            "uri": r["uri"],
            **val,
        })
    for e in evidence:
        val = e["value"]
        entries.append({
            "id": e["rkey"],
            "type": "EVIDENCE",
            "uri": e["uri"],
            **val,
        })
    for w in waivers:
        val = w["value"]
        entries.append({
            "id": w["rkey"],
            "type": "WAIVER",
            "uri": w["uri"],
            **val,
        })

    entries.sort(key=lambda x: x.get("createdAt", x.get("startedAt", "")), reverse=True)
    return {"entries": entries}


# --- Dependency Graph ---


@router.get("/graph")
async def list_graph(request: Request):
    session = get_authenticated_session(request)

    repo_deps = _list_records(session, "sh.tangled.governance.graph.repoDependency")
    code_deps = _list_records(session, "sh.tangled.governance.graph.codeDependency")
    service_deps = _list_records(session, "sh.tangled.governance.graph.serviceDependency")

    return {
        "repoDependencies": [{"id": r["rkey"], "uri": r["uri"], **r["value"]} for r in repo_deps],
        "codeDependencies": [{"id": r["rkey"], "uri": r["uri"], **r["value"]} for r in code_deps],
        "serviceDependencies": [{"id": r["rkey"], "uri": r["uri"], **r["value"]} for r in service_deps],
    }


# --- Incidents ---


@router.get("/incidents")
async def list_incidents(request: Request):
    session = get_authenticated_session(request)
    incidents = _list_records(session, "sh.tangled.governance.compliance.incident")
    sla_trackers = _list_records(session, "sh.tangled.governance.compliance.slaTracker")

    sla_map = {}
    for s in sla_trackers:
        incident_uri = s["value"].get("incident", "")
        sla_map[incident_uri] = s["value"]

    result = []
    for inc in incidents:
        val = inc["value"]
        result.append({
            "id": inc["rkey"],
            "uri": inc["uri"],
            **val,
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
