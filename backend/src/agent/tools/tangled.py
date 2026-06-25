"""Tools for reading AND writing native Tangled data.

Read tools: repos, issues, PRs, file tree, commits.
Write tools: create/close/reopen issues, comment on issues,
             update PR status, comment on PRs.

These complement the governance tools (org, policy, compliance, graph, audit).
"""

from typing import Optional

import httpx
from langchain_core.tools import tool

from ._client import _val, get_client


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_HTTPX_TIMEOUT = 10


def _list_tangled_records(collection: str) -> list[dict]:
    """List records of a Tangled collection from the org's PDS."""
    client = get_client()
    result = client.list_records(collection)
    return result["records"]


def _latest_state(state_records: list[dict], key_field: str) -> dict[str, str]:
    """Build a {uri → latest_state_value} map from state/status records.

    State records (issue.state, pull.status) can have multiple entries per
    issue/PR; we keep only the latest one per key.
    """
    latest: dict[str, str] = {}
    latest_ts: dict[str, str] = {}
    for rec in state_records:
        v = _val(rec)
        key = v.get(key_field, "")
        val = v.get("state") or v.get("status", "")
        ts = v.get("createdAt", "")
        if key and (key not in latest_ts or ts > latest_ts[key]):
            latest[key] = val
            latest_ts[key] = ts
    return latest


def _clean_issue(rec: dict, state: str) -> dict:
    v = _val(rec)
    state_label = "closed" if str(state).endswith(".closed") else "open"
    return {
        "uri": rec.get("uri", ""),
        "rkey": rec.get("uri", "").rsplit("/", 1)[-1],
        "title": v.get("title", ""),
        "body": v.get("body", ""),
        "state": state_label,
        "repo": v.get("repo", ""),
        "createdAt": v.get("createdAt", ""),
        "mentions": v.get("mentions", []),
        "references": v.get("references", []),
    }


def _clean_pull(rec: dict, status: str) -> dict:
    v = _val(rec)
    if str(status).endswith(".merged"):
        status_label = "merged"
    elif str(status).endswith(".closed"):
        status_label = "closed"
    else:
        status_label = "open"
    source = v.get("source", {})
    target = v.get("target", {})
    return {
        "uri": rec.get("uri", ""),
        "rkey": rec.get("uri", "").rsplit("/", 1)[-1],
        "title": v.get("title", ""),
        "body": v.get("body", ""),
        "status": status_label,
        "sourceBranch": source.get("branch", "") if isinstance(source, dict) else str(source),
        "targetBranch": target.get("branch", "") if isinstance(target, dict) else str(target),
        "targetRepo": target.get("repo", "") if isinstance(target, dict) else str(target),
        "rounds": len(v.get("rounds", [])),
        "createdAt": v.get("createdAt", ""),
    }


# ---------------------------------------------------------------------------
# Repo tools
# ---------------------------------------------------------------------------


@tool
def list_repos() -> list[dict]:
    """List all Tangled repositories in the organization.

    Returns each repo's rkey (short name), knot server, repoDid, and whether
    a compliance profile exists. Use this to discover which repos exist before
    querying their issues or PRs.
    """
    client = get_client()
    repos = _list_tangled_records("sh.tangled.repo")
    profiles = _list_tangled_records("sh.tangled.governance.compliance.repoProfile")

    profile_map = {_val(p).get("repo", ""): _val(p) for p in profiles}

    result = []
    for r in repos:
        v = _val(r)
        uri = r.get("uri", "")
        rkey = uri.rsplit("/", 1)[-1]
        profile = profile_map.get(uri, {})
        result.append({
            "rkey": rkey,
            "uri": uri,
            "knot": v.get("knot", ""),
            "repoDid": v.get("repoDid", ""),
            "createdAt": v.get("createdAt", ""),
            "compliance": {
                "dataClassification": profile.get("dataClassification"),
                "riskTier": profile.get("riskTier"),
                "enforcementMode": profile.get("enforcementMode"),
            } if profile else None,
        })
    return result


@tool
def get_repo(repo_rkey: str) -> Optional[dict]:
    """Get details for a single repository by its rkey (short name).

    Returns the repo's knot server, repoDid, compliance profile, and bound
    policy pack. Pass the rkey (e.g. 'payments-api') not the full AT-URI.
    Returns None if the repo doesn't exist.
    """
    repos = _list_tangled_records("sh.tangled.repo")
    for r in repos:
        uri = r.get("uri", "")
        rkey = uri.rsplit("/", 1)[-1]
        if rkey == repo_rkey:
            v = _val(r)

            # Fetch profile and binding if they exist
            profiles = _list_tangled_records("sh.tangled.governance.compliance.repoProfile")
            profile = next((_val(p) for p in profiles if _val(p).get("repo") == uri), None)

            bindings = _list_tangled_records("sh.tangled.governance.policy.repoBinding")
            binding = next((_val(b) for b in bindings if _val(b).get("repo") == uri), None)

            return {
                "rkey": rkey,
                "uri": uri,
                "knot": v.get("knot", ""),
                "repoDid": v.get("repoDid", ""),
                "createdAt": v.get("createdAt", ""),
                "profile": profile,
                "policyBinding": binding,
            }
    return None


# ---------------------------------------------------------------------------
# Issue tools
# ---------------------------------------------------------------------------


@tool
def list_issues(repo_rkey: str, state: str = "open") -> list[dict]:
    """List issues for a repository.

    repo_rkey: the short name of the repo (e.g. 'payments-api')
    state: 'open' | 'closed' | 'all'

    Returns each issue's title, body, state, and creation time.
    Use get_issue() for full detail on a specific one.
    """
    # Find the repo's repoDid
    repos = _list_tangled_records("sh.tangled.repo")
    repo_did = ""
    for r in repos:
        uri = r.get("uri", "")
        if uri.rsplit("/", 1)[-1] == repo_rkey:
            repo_did = _val(r).get("repoDid", "")
            break

    if not repo_did:
        return []

    issues = _list_tangled_records("sh.tangled.repo.issue")
    states_recs = _list_tangled_records("sh.tangled.repo.issue.state")
    state_map = _latest_state(states_recs, "issue")

    result = []
    for iss in issues:
        v = _val(iss)
        if v.get("repo") != repo_did:
            continue
        uri = iss.get("uri", "")
        current_state = state_map.get(uri, "sh.tangled.repo.issue.state.open")
        state_label = "closed" if str(current_state).endswith(".closed") else "open"

        if state != "all" and state_label != state:
            continue

        result.append(_clean_issue(iss, current_state))

    result.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return result


@tool
def get_issue(issue_uri: str) -> Optional[dict]:
    """Get full detail for a single issue by its AT-URI.

    The AT-URI looks like: at://did:plc:.../sh.tangled.repo.issue/rkey
    Returns the issue's title, body, current state, mentions, and references.
    Returns None if not found.
    """
    issues = _list_tangled_records("sh.tangled.repo.issue")
    states_recs = _list_tangled_records("sh.tangled.repo.issue.state")
    state_map = _latest_state(states_recs, "issue")

    for iss in issues:
        if iss.get("uri", "") == issue_uri:
            current_state = state_map.get(issue_uri, "sh.tangled.repo.issue.state.open")
            return _clean_issue(iss, current_state)
    return None


@tool
def list_all_issues(state: str = "open") -> list[dict]:
    """List all issues across all repositories in the organization.

    state: 'open' | 'closed' | 'all'

    Use this when you want a cross-repo view of open issues rather than
    looking at one repo at a time.
    """
    issues = _list_tangled_records("sh.tangled.repo.issue")
    states_recs = _list_tangled_records("sh.tangled.repo.issue.state")
    state_map = _latest_state(states_recs, "issue")

    # Build repoDid → rkey mapping for context
    repos = _list_tangled_records("sh.tangled.repo")
    repo_did_to_rkey = {}
    for r in repos:
        v = _val(r)
        did = v.get("repoDid", "")
        rkey = r.get("uri", "").rsplit("/", 1)[-1]
        if did:
            repo_did_to_rkey[did] = rkey

    result = []
    for iss in issues:
        v = _val(iss)
        uri = iss.get("uri", "")
        current_state = state_map.get(uri, "sh.tangled.repo.issue.state.open")
        state_label = "closed" if str(current_state).endswith(".closed") else "open"

        if state != "all" and state_label != state:
            continue

        cleaned = _clean_issue(iss, current_state)
        cleaned["repoRkey"] = repo_did_to_rkey.get(v.get("repo", ""), "unknown")
        result.append(cleaned)

    result.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return result


@tool
def search_issues(query: str, state: str = "all") -> list[dict]:
    """Search issues by keyword across all repositories.

    query: text to search for in issue titles and bodies (case-insensitive)
    state: 'open' | 'closed' | 'all'

    Returns matching issues with their repo rkey for context.
    """
    issues = _list_tangled_records("sh.tangled.repo.issue")
    states_recs = _list_tangled_records("sh.tangled.repo.issue.state")
    state_map = _latest_state(states_recs, "issue")

    repos = _list_tangled_records("sh.tangled.repo")
    repo_did_to_rkey = {
        _val(r).get("repoDid", ""): r.get("uri", "").rsplit("/", 1)[-1]
        for r in repos if _val(r).get("repoDid")
    }

    q = query.lower()
    result = []
    for iss in issues:
        v = _val(iss)
        title = v.get("title", "").lower()
        body = v.get("body", "").lower()
        if q not in title and q not in body:
            continue

        uri = iss.get("uri", "")
        current_state = state_map.get(uri, "sh.tangled.repo.issue.state.open")
        state_label = "closed" if str(current_state).endswith(".closed") else "open"

        if state != "all" and state_label != state:
            continue

        cleaned = _clean_issue(iss, current_state)
        cleaned["repoRkey"] = repo_did_to_rkey.get(v.get("repo", ""), "unknown")
        result.append(cleaned)

    result.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return result


# ---------------------------------------------------------------------------
# Pull request tools
# ---------------------------------------------------------------------------


@tool
def list_pulls(repo_rkey: str, status: str = "open") -> list[dict]:
    """List pull requests for a repository.

    repo_rkey: short name of the repo (e.g. 'payments-api')
    status: 'open' | 'merged' | 'closed' | 'all'

    Returns each PR's title, source/target branches, status, and round count.
    """
    repos = _list_tangled_records("sh.tangled.repo")
    repo_did = ""
    for r in repos:
        uri = r.get("uri", "")
        if uri.rsplit("/", 1)[-1] == repo_rkey:
            repo_did = _val(r).get("repoDid", "")
            break

    if not repo_did:
        return []

    pulls = _list_tangled_records("sh.tangled.repo.pull")
    statuses_recs = _list_tangled_records("sh.tangled.repo.pull.status")
    status_map = _latest_state(statuses_recs, "pull")

    result = []
    for pr in pulls:
        v = _val(pr)
        target = v.get("target", {})
        target_repo = target.get("repo", "") if isinstance(target, dict) else str(target)
        if repo_did and repo_did not in target_repo:
            continue

        uri = pr.get("uri", "")
        current_status = status_map.get(uri, "sh.tangled.repo.pull.status.open")
        cleaned = _clean_pull(pr, current_status)

        if status != "all" and cleaned["status"] != status:
            continue

        result.append(cleaned)

    result.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return result


@tool
def get_pull(pull_uri: str) -> Optional[dict]:
    """Get full detail for a single pull request by its AT-URI.

    Returns the PR's title, body, branches, status, and number of review rounds.
    Returns None if not found.
    """
    pulls = _list_tangled_records("sh.tangled.repo.pull")
    statuses_recs = _list_tangled_records("sh.tangled.repo.pull.status")
    status_map = _latest_state(statuses_recs, "pull")

    for pr in pulls:
        if pr.get("uri", "") == pull_uri:
            current_status = status_map.get(pull_uri, "sh.tangled.repo.pull.status.open")
            return _clean_pull(pr, current_status)
    return None


@tool
def list_all_pulls(status: str = "open") -> list[dict]:
    """List all pull requests across all repositories in the organization.

    status: 'open' | 'merged' | 'closed' | 'all'

    Use this for a cross-repo view of open PRs, e.g. to find all PRs
    awaiting review or to check what's in flight across the org.
    """
    pulls = _list_tangled_records("sh.tangled.repo.pull")
    statuses_recs = _list_tangled_records("sh.tangled.repo.pull.status")
    status_map = _latest_state(statuses_recs, "pull")

    repos = _list_tangled_records("sh.tangled.repo")
    repo_did_to_rkey = {
        _val(r).get("repoDid", ""): r.get("uri", "").rsplit("/", 1)[-1]
        for r in repos if _val(r).get("repoDid")
    }

    result = []
    for pr in pulls:
        uri = pr.get("uri", "")
        current_status = status_map.get(uri, "sh.tangled.repo.pull.status.open")
        cleaned = _clean_pull(pr, current_status)

        if status != "all" and cleaned["status"] != status:
            continue

        # Resolve which repo this PR targets
        target_repo_did = cleaned.get("targetRepo", "")
        cleaned["repoRkey"] = repo_did_to_rkey.get(target_repo_did, "unknown")
        result.append(cleaned)

    result.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return result


# ---------------------------------------------------------------------------
# Repo filesystem / git tools (via knot server)
# ---------------------------------------------------------------------------


def _get_repo_knot(repo_rkey: str) -> tuple[str, str]:
    """Return (knot, repoDid) for a repo rkey. Raises ValueError if not found."""
    repos = _list_tangled_records("sh.tangled.repo")
    for r in repos:
        uri = r.get("uri", "")
        if uri.rsplit("/", 1)[-1] == repo_rkey:
            v = _val(r)
            knot = v.get("knot", "")
            repo_did = v.get("repoDid", "")
            if not knot:
                raise ValueError(f"Repo '{repo_rkey}' has no knot server configured")
            return knot, repo_did
    raise ValueError(f"Repo '{repo_rkey}' not found")


@tool
def get_repo_tree(repo_rkey: str, ref: str = "main", path: str = "") -> dict:
    """Browse the file/directory tree of a repository.

    repo_rkey: short name of the repo (e.g. 'payments-api')
    ref: git ref — branch name, tag, or commit SHA (default: 'main')
    path: subdirectory path to browse (default: repo root)

    Returns the directory listing with file names, types, and sizes.
    Use this to explore what files a repo contains before diving into issues.
    """
    try:
        knot, repo_did = _get_repo_knot(repo_rkey)
        params: dict = {"repo": f"{repo_did}/{repo_rkey}", "ref": ref}
        if path:
            params["path"] = path
        resp = httpx.get(
            f"https://{knot}/xrpc/sh.tangled.repo.tree",
            params=params,
            timeout=_HTTPX_TIMEOUT,
        )
        if resp.status_code != 200:
            return {"error": f"Knot server returned {resp.status_code}", "entries": []}
        return resp.json()
    except ValueError as exc:
        return {"error": str(exc), "entries": []}
    except httpx.ConnectError:
        return {"error": f"Cannot reach knot server for '{repo_rkey}'", "entries": []}
    except Exception as exc:  # noqa: BLE001
        return {"error": str(exc), "entries": []}


@tool
def get_repo_log(repo_rkey: str, ref: str = "main", limit: int = 20) -> dict:
    """Get the commit history for a repository.

    repo_rkey: short name of the repo (e.g. 'payments-api')
    ref: git ref — branch name, tag, or commit SHA (default: 'main')
    limit: max commits to return (default: 20, max: 100)

    Returns commits in reverse chronological order with author, message, and hash.
    Use this to understand recent activity or to find when a specific change landed.
    """
    try:
        knot, repo_did = _get_repo_knot(repo_rkey)
        params: dict = {
            "repo": f"{repo_did}/{repo_rkey}",
            "ref": ref,
            "limit": min(limit, 100),
        }
        resp = httpx.get(
            f"https://{knot}/xrpc/sh.tangled.repo.log",
            params=params,
            timeout=_HTTPX_TIMEOUT,
        )
        if resp.status_code != 200:
            return {"error": f"Knot server returned {resp.status_code}", "commits": []}
        return resp.json()
    except ValueError as exc:
        return {"error": str(exc), "commits": []}
    except httpx.ConnectError:
        return {"error": f"Cannot reach knot server for '{repo_rkey}'", "commits": []}
    except Exception as exc:  # noqa: BLE001
        return {"error": str(exc), "commits": []}


# ---------------------------------------------------------------------------
# Write helpers
# ---------------------------------------------------------------------------


def _create_native_record(collection: str, record: dict) -> dict:
    """Write a native Tangled record to the org's PDS.

    Unlike governance records, native Tangled records (issues, PRs, etc.)
    have no Pydantic model, so we call the SDK directly with a plain dict.
    Returns {"uri": ..., "cid": ...}.
    """
    from atproto import models as _atmodels

    client = get_client()
    data = {**record, "$type": collection}
    response = client.client.com.atproto.repo.create_record(
        _atmodels.ComAtprotoRepoCreateRecord.Data(
            repo=client.did,
            collection=collection,
            record=data,
        )
    )
    return {"uri": response.uri, "cid": response.cid}


def _repo_did_for_rkey(repo_rkey: str) -> str:
    """Return the repoDid for a given repo rkey. Raises ValueError if not found."""
    repos = _list_tangled_records("sh.tangled.repo")
    for r in repos:
        uri = r.get("uri", "")
        if uri.rsplit("/", 1)[-1] == repo_rkey:
            repo_did = _val(r).get("repoDid", "")
            if not repo_did:
                raise ValueError(f"Repo '{repo_rkey}' has no repoDid")
            return repo_did
    raise ValueError(f"Repo '{repo_rkey}' not found")


# ---------------------------------------------------------------------------
# Issue write tools
# ---------------------------------------------------------------------------


@tool
def create_issue(repo_rkey: str, title: str, body: str) -> dict:
    """Create a new issue in a repository.

    repo_rkey: short name of the repo (e.g. 'payments-api')
    title: issue title (required)
    body: issue body / description (required)

    Returns {"uri": ..., "cid": ...} of the created issue record.
    The issue will be open by default.
    """
    from datetime import datetime, timezone

    repo_did = _repo_did_for_rkey(repo_rkey)
    return _create_native_record(
        "sh.tangled.repo.issue",
        {
            "repo": repo_did,
            "title": title,
            "body": body,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        },
    )


@tool
def close_issue(issue_uri: str) -> dict:
    """Close an open issue.

    issue_uri: the AT-URI of the issue (e.g. at://did:plc:.../sh.tangled.repo.issue/rkey)

    Creates a sh.tangled.repo.issue.state record marking the issue closed.
    Returns {"uri": ..., "cid": ...} of the state record.
    """
    from datetime import datetime, timezone

    return _create_native_record(
        "sh.tangled.repo.issue.state",
        {
            "issue": issue_uri,
            "state": "sh.tangled.repo.issue.state.closed",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        },
    )


@tool
def reopen_issue(issue_uri: str) -> dict:
    """Reopen a closed issue.

    issue_uri: the AT-URI of the issue

    Creates a sh.tangled.repo.issue.state record marking the issue open.
    Returns {"uri": ..., "cid": ...} of the state record.
    """
    from datetime import datetime, timezone

    return _create_native_record(
        "sh.tangled.repo.issue.state",
        {
            "issue": issue_uri,
            "state": "sh.tangled.repo.issue.state.open",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        },
    )


@tool
def comment_on_issue(issue_uri: str, body: str) -> dict:
    """Post a comment on an issue.

    issue_uri: the AT-URI of the issue
    body: comment text (markdown supported)

    Creates a sh.tangled.repo.issue.comment record.
    Returns {"uri": ..., "cid": ...} of the comment record.
    """
    from datetime import datetime, timezone

    return _create_native_record(
        "sh.tangled.repo.issue.comment",
        {
            "issue": issue_uri,
            "body": body,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        },
    )


# ---------------------------------------------------------------------------
# Pull request write tools
# ---------------------------------------------------------------------------


@tool
def close_pull(pull_uri: str) -> dict:
    """Close a pull request without merging.

    pull_uri: the AT-URI of the pull request

    Creates a sh.tangled.repo.pull.status record with status 'closed'.
    Returns {"uri": ..., "cid": ...} of the status record.
    """
    from datetime import datetime, timezone

    return _create_native_record(
        "sh.tangled.repo.pull.status",
        {
            "pull": pull_uri,
            "status": "sh.tangled.repo.pull.status.closed",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        },
    )


@tool
def merge_pull(pull_uri: str) -> dict:
    """Mark a pull request as merged.

    pull_uri: the AT-URI of the pull request

    Creates a sh.tangled.repo.pull.status record with status 'merged'.
    Note: this only updates the Tangled record — it does NOT perform a git merge.
    Returns {"uri": ..., "cid": ...} of the status record.
    """
    from datetime import datetime, timezone

    return _create_native_record(
        "sh.tangled.repo.pull.status",
        {
            "pull": pull_uri,
            "status": "sh.tangled.repo.pull.status.merged",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        },
    )


@tool
def comment_on_pull(pull_uri: str, body: str) -> dict:
    """Post a comment on a pull request.

    pull_uri: the AT-URI of the pull request
    body: comment text (markdown supported)

    Creates a sh.tangled.repo.pull.comment record.
    Returns {"uri": ..., "cid": ...} of the comment record.
    """
    from datetime import datetime, timezone

    return _create_native_record(
        "sh.tangled.repo.pull.comment",
        {
            "pull": pull_uri,
            "body": body,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        },
    )


# ---------------------------------------------------------------------------
# Cross-cutting summary tools
# ---------------------------------------------------------------------------


@tool
def get_org_summary() -> dict:
    """Return a high-level summary of the organization's current state.

    Includes: total repos, open issues, open PRs, policy packs, active incidents,
    and a count of compliance profiles in place.

    Use this as a starting point when asked general questions about the org
    like "what's going on?" or "give me a status overview".
    """
    repos = _list_tangled_records("sh.tangled.repo")
    issues = _list_tangled_records("sh.tangled.repo.issue")
    issue_states = _list_tangled_records("sh.tangled.repo.issue.state")
    pulls = _list_tangled_records("sh.tangled.repo.pull")
    pull_statuses = _list_tangled_records("sh.tangled.repo.pull.status")
    policies = _list_tangled_records("sh.tangled.governance.policy.policyPack")
    incidents = _list_tangled_records("sh.tangled.governance.compliance.incident")
    profiles = _list_tangled_records("sh.tangled.governance.compliance.repoProfile")
    members = _list_tangled_records("sh.tangled.governance.org.membership")

    state_map = _latest_state(issue_states, "issue")
    status_map = _latest_state(pull_statuses, "pull")

    open_issues = sum(
        1 for iss in issues
        if not str(state_map.get(iss.get("uri", ""), "")).endswith(".closed")
    )
    open_prs = sum(
        1 for pr in pulls
        if not str(status_map.get(pr.get("uri", ""), "")).endswith((".closed", ".merged"))
    )
    open_incidents = sum(
        1 for inc in incidents
        if _val(inc).get("status") in ("open", "in-progress")
    )

    return {
        "repos": len(repos),
        "openIssues": open_issues,
        "openPullRequests": open_prs,
        "policyPacks": len(policies),
        "openIncidents": open_incidents,
        "reposWithComplianceProfile": len(profiles),
        "members": len(members),
    }
