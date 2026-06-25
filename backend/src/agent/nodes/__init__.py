"""LangGraph agent graph nodes for compliance assessment.

Implements the 8-node pipeline:
  clone_diff → load_profile → map_owners → run_scans →
  check_deps → claude_reason → decide_gate → write_records

Usage:
    from src.agent.nodes import graph, ComplianceState

    result = graph.invoke(ComplianceState(
        pr_uri="at://did:plc:.../sh.tangled.pr/...",
        repo_uri="at://did:plc:.../sh.tangled.repo/...",
        repo_clone_url="https://tngl.sh/user/repo.git",
        pr_branch="feature/my-change",
        base_branch="main",
    ))
"""

import fnmatch
import json
import os
import shutil
import subprocess
import tempfile
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

try:
    from langchain_anthropic import ChatAnthropic
    from langchain_core.messages import HumanMessage, SystemMessage
    from langgraph.graph import END, START, StateGraph

    _LANGGRAPH_AVAILABLE = True
except ImportError:
    _LANGGRAPH_AVAILABLE = False

from src.agent.tools._client import _val, get_client
from src.config import settings
from src.models import (
    AgentRun,
    ControlEvaluation,
    Evidence,
    ImpactAssessment,
    MergeGate,
    PRAssessment,
    RequiredApproval,
)
from src.models.base import (
    AgentRunStatus,
    ApprovalStatus,
    GateStatus,
)
from src.models.compliance import AffectedEdge


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------


@dataclass
class ComplianceState:
    """State passed between agent nodes."""

    # Input (required)
    pr_uri: str = ""
    repo_uri: str = ""
    repo_clone_url: str = ""
    pr_branch: str = ""
    base_branch: str = ""

    # From clone_diff
    diff_text: str = ""
    changed_files: list[str] = field(default_factory=list)
    clone_dir: str = ""  # temp dir, cleaned up after write_records

    # From load_profile
    repo_profile: Optional[dict] = None
    policy_packs: list[dict] = field(default_factory=list)
    controls: list[dict] = field(default_factory=list)
    code_owners: list[dict] = field(default_factory=list)
    code_dependencies: list[dict] = field(default_factory=list)
    org_memberships: list[dict] = field(default_factory=list)

    # From map_owners
    file_owner_map: dict = field(default_factory=dict)
    affected_owners: list[str] = field(default_factory=list)
    affected_teams: list[str] = field(default_factory=list)

    # From run_scans
    semgrep_results: list[dict] = field(default_factory=list)
    gitleaks_results: list[dict] = field(default_factory=list)
    osv_results: list[dict] = field(default_factory=list)

    # From check_deps
    affected_edges: list[dict] = field(default_factory=list)
    downstream_repos: list[str] = field(default_factory=list)
    impact_risk_level: str = "none"

    # From claude_reason
    risk_level: str = "low"
    summary: str = ""
    control_evaluations: list[dict] = field(default_factory=list)
    required_approvals: list[dict] = field(default_factory=list)
    claude_tokens_in: int = 0
    claude_tokens_out: int = 0

    # From decide_gate
    gate_status: str = GateStatus.PASS
    gate_reason: str = ""
    blocked_controls: list[str] = field(default_factory=list)
    post_merge_actions: list[dict] = field(default_factory=list)

    # Written record URIs (populated in write_records)
    agent_run_uri: str = ""
    agent_run_rkey: str = ""
    pr_assessment_uri: str = ""
    evidence_uris: list[str] = field(default_factory=list)
    downstream_issues_created: list[dict] = field(default_factory=list)

    # Metadata
    agent_run_started: float = field(default_factory=time.time)
    records_written: int = 0
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Node 1: clone_diff
# ---------------------------------------------------------------------------


def clone_diff(state: ComplianceState) -> ComplianceState:
    """Clone the repo and compute the diff between PR branch and base.

    If repo_clone_url uses a DID-based path that fails, falls back to
    fetching file trees from the knot XRPC API to build the diff.
    """
    import logging
    log = logging.getLogger("clone_diff")

    clone_url = state.repo_clone_url
    log.info("clone_diff: url=%s branch=%s base=%s", clone_url, state.pr_branch, state.base_branch)

    try:
        clone_dir = tempfile.mkdtemp(prefix="tangled_org_")
        state.clone_dir = clone_dir

        clone_result = subprocess.run(
            ["git", "clone", "--depth", "50", clone_url, clone_dir],
            capture_output=True,
            timeout=120,
        )
        if clone_result.returncode != 0:
            stderr = clone_result.stderr.decode(errors="replace")[:300]
            log.warning("git clone failed (rc=%d): %s", clone_result.returncode, stderr)
            # Fall back to XRPC-based diff
            return _xrpc_diff_fallback(state)

        fetch_result = subprocess.run(
            ["git", "fetch", "origin", f"{state.pr_branch}:{state.pr_branch}"],
            capture_output=True,
            timeout=30,
            cwd=clone_dir,
        )
        if fetch_result.returncode != 0:
            log.warning("fetch branch failed: %s", fetch_result.stderr.decode(errors="replace")[:200])

        diff_result = subprocess.run(
            ["git", "diff", f"{state.base_branch}...{state.pr_branch}"],
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=clone_dir,
        )
        state.diff_text = diff_result.stdout[:50_000]

        files_result = subprocess.run(
            ["git", "diff", "--name-only", f"{state.base_branch}...{state.pr_branch}"],
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=clone_dir,
        )
        state.changed_files = [f for f in files_result.stdout.strip().split("\n") if f]

        if not state.changed_files:
            log.warning("git diff returned 0 files — trying XRPC fallback")
            return _xrpc_diff_fallback(state)

    except FileNotFoundError:
        log.warning("git binary not found — using XRPC fallback")
        return _xrpc_diff_fallback(state)
    except subprocess.TimeoutExpired as exc:
        state.error = f"clone_diff timed out: {exc}"
    except subprocess.CalledProcessError as exc:
        state.error = f"clone_diff git error: {exc.stderr.decode(errors='replace')[:500]}"
        return _xrpc_diff_fallback(state)
    except Exception as exc:  # noqa: BLE001
        state.error = f"clone_diff unexpected error: {exc}"
        return _xrpc_diff_fallback(state)

    return state


def _xrpc_diff_fallback(state: ComplianceState) -> ComplianceState:
    """Build a diff by comparing file trees from the knot XRPC API.

    When git clone isn't possible, fetches the tree for both branches
    and computes a text diff from the file contents.
    """
    import logging
    import httpx as _httpx
    log = logging.getLogger("clone_diff")

    repo_uri = state.repo_uri
    rkey = repo_uri.rsplit("/", 1)[-1] if "/" in repo_uri else ""
    if not rkey:
        state.error = "XRPC fallback: cannot resolve repo rkey"
        return state

    try:
        from src.appview.routes.api import _get_repo_record, _get_org_session
        repo_rec = _get_repo_record(rkey)
        val = repo_rec["value"]
        knot = val.get("knot", "")
        owner_did = _get_org_session()["did"]
    except Exception as exc:
        state.error = f"XRPC fallback: cannot resolve repo/knot: {exc}"
        return state

    if not knot:
        state.error = "XRPC fallback: no knot server"
        return state

    repo_param = f"{owner_did}/{rkey}"
    log.info("XRPC fallback: knot=%s repo=%s base=%s head=%s", knot, repo_param, state.base_branch, state.pr_branch)

    def _get_tree(ref: str, path: str = "") -> list[dict]:
        """Recursively fetch file tree from the knot server."""
        params: dict = {"repo": repo_param, "ref": ref}
        if path:
            params["path"] = path
        resp = _httpx.get(
            f"https://{knot}/xrpc/sh.tangled.repo.tree",
            params=params,
            timeout=15,
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        entries = data.get("files", data.get("entries", data.get("tree", [])))
        result = []
        for entry in entries:
            name = entry.get("name", entry.get("path", ""))
            mode = entry.get("mode", "")
            full_path = f"{path}/{name}" if path else name
            if mode.startswith("004"):
                result.extend(_get_tree(ref, full_path))
            else:
                entry["_full_path"] = full_path
                result.append(entry)
        return result

    def _get_blob(ref: str, path: str) -> str:
        resp = _httpx.get(
            f"https://{knot}/xrpc/sh.tangled.repo.blob",
            params={"repo": repo_param, "ref": ref, "path": path},
            timeout=15,
        )
        if resp.status_code != 200:
            return ""
        data = resp.json()
        return data.get("content", data.get("data", ""))

    try:
        base_files = _get_tree(state.base_branch)
        head_files = _get_tree(state.pr_branch)

        base_names = {f.get("_full_path", f.get("name", "")): f for f in base_files}
        head_names = {f.get("_full_path", f.get("name", "")): f for f in head_files}

        all_files = set(base_names.keys()) | set(head_names.keys())
        changed = []
        diff_parts = []

        for fname in sorted(all_files):
            in_base = fname in base_names
            in_head = fname in head_names

            if in_base and in_head:
                base_size = base_names[fname].get("size", -1)
                head_size = head_names[fname].get("size", -2)
                base_hash = base_names[fname].get("hash", "")
                head_hash = head_names[fname].get("hash", "")
                if base_hash and head_hash and base_hash == head_hash:
                    continue
                if base_size == head_size and not base_hash:
                    base_c = _get_blob(state.base_branch, fname)
                    head_c = _get_blob(state.pr_branch, fname)
                    if base_c == head_c:
                        continue

            changed.append(fname)

            base_content = _get_blob(state.base_branch, fname) if in_base else ""
            head_content = _get_blob(state.pr_branch, fname) if in_head else ""

            if not in_base:
                diff_parts.append(f"--- /dev/null\n+++ b/{fname}\n" +
                                  "\n".join(f"+{line}" for line in head_content.splitlines()[:200]))
            elif not in_head:
                diff_parts.append(f"--- a/{fname}\n+++ /dev/null\n" +
                                  "\n".join(f"-{line}" for line in base_content.splitlines()[:200]))
            else:
                import difflib
                base_lines = base_content.splitlines(keepends=True)
                head_lines = head_content.splitlines(keepends=True)
                udiff = difflib.unified_diff(base_lines, head_lines,
                                             fromfile=f"a/{fname}", tofile=f"b/{fname}")
                diff_parts.append("".join(udiff)[:5000])

        state.changed_files = changed
        state.diff_text = "\n".join(diff_parts)[:50_000]
        log.info("XRPC fallback: found %d changed files", len(changed))

    except Exception as exc:
        state.error = f"XRPC fallback error: {exc}"
        log.exception("XRPC fallback failed")

    return state


# ---------------------------------------------------------------------------
# Node 2: load_profile
# ---------------------------------------------------------------------------


def load_profile(state: ComplianceState) -> ComplianceState:
    """Read governance records from ATProto for this repo."""
    try:
        client = get_client()
        repo_uri = state.repo_uri

        # Repo compliance profile
        profiles = client.list_governance_records("compliance.repoProfile")
        for r in profiles["records"]:
            if _val(r).get("repo") == repo_uri:
                state.repo_profile = r
                break

        # Policy binding → packs + controls
        bindings = client.list_governance_records("policy.repoBinding")
        for b in bindings["records"]:
            if _val(b).get("repo") == repo_uri:
                pack_uri = _val(b).get("policyPack", "")
                if pack_uri:
                    # Resolve rkey from AT-URI (last segment)
                    pack_rkey = pack_uri.rsplit("/", 1)[-1]
                    pack = client.get_record("sh.tangled.governance.policy.policyPack", rkey=pack_rkey)
                    if pack:
                        state.policy_packs.append(pack)

                    # Load controls for this pack
                    controls_result = client.list_governance_records("policy.control")
                    pack_controls = [
                        r for r in controls_result["records"]
                        if _val(r).get("policyPack") == pack_uri
                    ]
                    state.controls.extend(pack_controls)
                break

        # Code owners
        owners_result = client.list_governance_records("compliance.codeOwner")
        state.code_owners = [
            r for r in owners_result["records"]
            if _val(r).get("repo") == repo_uri
        ]

        # Code dependencies (both directions)
        deps_result = client.list_governance_records("graph.codeDependency")
        state.code_dependencies = [
            r for r in deps_result["records"]
            if _val(r).get("sourceRepo") == repo_uri
            or _val(r).get("targetRepo") == repo_uri
        ]

        # Org memberships (to resolve approver roles)
        if state.repo_profile:
            org_uri = _val(state.repo_profile).get("org", "")
            if org_uri:
                memberships_result = client.list_governance_records("org.membership")
                state.org_memberships = [
                    r for r in memberships_result["records"]
                    if _val(r).get("org") == org_uri
                ]

    except Exception as exc:  # noqa: BLE001
        state.error = f"load_profile error: {exc}"

    return state


# ---------------------------------------------------------------------------
# Node 3: map_owners
# ---------------------------------------------------------------------------


def map_owners(state: ComplianceState) -> ComplianceState:
    """Match changed files to code owner glob patterns."""
    try:
        file_owner_map: dict[str, list[dict]] = {}
        owner_dids: set[str] = set()
        team_uris: set[str] = set()

        for changed_file in state.changed_files:
            matched_owners = []
            for owner_record in state.code_owners:
                v = _val(owner_record)
                pattern = v.get("pattern", "")
                if not pattern:
                    continue
                if fnmatch.fnmatch(changed_file, pattern):
                    matched_owners.append(v)
                    if v.get("ownerDid"):
                        owner_dids.add(v["ownerDid"])
                    if v.get("ownerTeam"):
                        team_uris.add(v["ownerTeam"])
            if matched_owners:
                file_owner_map[changed_file] = matched_owners

        state.file_owner_map = file_owner_map
        state.affected_owners = sorted(owner_dids)
        state.affected_teams = sorted(team_uris)

    except Exception as exc:  # noqa: BLE001
        state.error = f"map_owners error: {exc}"

    return state


# ---------------------------------------------------------------------------
# Node 4: run_scans
# ---------------------------------------------------------------------------


def _run_semgrep(scan_dir: str) -> list[dict]:
    """Run semgrep and return parsed findings. Returns [] if not installed."""
    try:
        result = subprocess.run(
            ["semgrep", "--config=auto", "--json", scan_dir],
            capture_output=True,
            text=True,
            timeout=180,
        )
        data = json.loads(result.stdout or "{}")
        return data.get("results", [])
    except FileNotFoundError:
        return []
    except Exception:  # noqa: BLE001
        return []


def _run_gitleaks(scan_dir: str) -> list[dict]:
    """Run gitleaks and return parsed findings. Returns [] if not installed."""
    try:
        report_path = os.path.join(tempfile.mkdtemp(), "gitleaks.json")
        subprocess.run(
            [
                "gitleaks",
                "detect",
                "--source",
                scan_dir,
                "--report-format",
                "json",
                "--report-path",
                report_path,
                "--no-git",
            ],
            capture_output=True,
            timeout=120,
        )
        if os.path.exists(report_path):
            with open(report_path) as f:
                data = json.load(f)
            return data if isinstance(data, list) else []
        return []
    except FileNotFoundError:
        return []
    except Exception:  # noqa: BLE001
        return []


def _run_osv_scanner(scan_dir: str) -> list[dict]:
    """Run osv-scanner and return parsed findings. Returns [] if not installed."""
    try:
        result = subprocess.run(
            ["osv-scanner", "--json", scan_dir],
            capture_output=True,
            text=True,
            timeout=120,
        )
        data = json.loads(result.stdout or "{}")
        results = data.get("results", [])
        findings = []
        for r in results:
            for pkg in r.get("packages", []):
                for vuln in pkg.get("vulnerabilities", []):
                    findings.append({"package": pkg.get("package", {}), "vulnerability": vuln})
        return findings
    except FileNotFoundError:
        return []
    except Exception:  # noqa: BLE001
        return []


def run_scans(state: ComplianceState) -> ComplianceState:
    """Run security scanning tools against the cloned repo."""
    scan_dir = state.clone_dir
    if not scan_dir or not os.path.isdir(scan_dir):
        # No clone available — skip scans
        return state

    try:
        state.semgrep_results = _run_semgrep(scan_dir)
        state.gitleaks_results = _run_gitleaks(scan_dir)
        state.osv_results = _run_osv_scanner(scan_dir)
    except Exception as exc:  # noqa: BLE001
        # Scan failures are non-fatal; log but continue
        state.error = f"run_scans partial error: {exc}"

    return state


# ---------------------------------------------------------------------------
# Node 5: check_deps
# ---------------------------------------------------------------------------

def check_deps(state: ComplianceState) -> ComplianceState:
    """Walk the dependency graph, fetch downstream code, and use AI to explain impact."""
    try:
        affected_edges: list[dict] = []
        downstream_repo_set: set[str] = set()
        edges_for_analysis: list[dict] = []

        client = get_client()
        repos = client.list_records("sh.tangled.repo").get("records", [])
        uri_to_rkey: dict[str, str] = {}
        for r in repos:
            uri_to_rkey[r.get("uri", "")] = r.get("uri", "").rsplit("/", 1)[-1]

        for changed_file in state.changed_files:
            for dep in state.code_dependencies:
                v = _val(dep)
                if v.get("targetRepo") != state.repo_uri:
                    continue
                target_path = v.get("targetPath", "")
                if not target_path:
                    continue
                if changed_file == target_path or changed_file.startswith(target_path.rstrip("/") + "/"):
                    dep_uri = dep.get("uri", "")
                    source_repo = v.get("sourceRepo", "")
                    if source_repo and source_repo != state.repo_uri:
                        downstream_repo_set.add(source_repo)
                        ds_path = v.get("sourcePath", "")
                        edges_for_analysis.append({
                            "codeDependency": dep_uri,
                            "downstreamRepo": source_repo,
                            "downstreamRepoRkey": uri_to_rkey.get(source_repo, source_repo),
                            "downstreamPath": ds_path,
                            "changedFile": changed_file,
                            "depType": v.get("dependencyType", "unknown"),
                        })

        if not edges_for_analysis:
            state.impact_risk_level = "none"
            return state

        # Fetch actual code: the changed upstream file + each downstream file
        from src.agent.tools.tangled import get_file_content
        upstream_rkey = uri_to_rkey.get(state.repo_uri, "")

        code_context = ""
        for edge in edges_for_analysis[:8]:
            upstream_blob = get_file_content(upstream_rkey, edge["changedFile"], state.pr_branch or "main")
            upstream_code = upstream_blob.get("content", "")[:3000]

            ds_rkey = edge["downstreamRepoRkey"]
            ds_path = edge["downstreamPath"] or ""
            ds_code = ""
            if ds_path and ds_rkey:
                ds_blob = get_file_content(ds_rkey, ds_path)
                ds_code = ds_blob.get("content", "")[:3000]

            code_context += (
                f"\n---\n### Changed upstream file: {upstream_rkey}/{edge['changedFile']}\n"
                f"```\n{upstream_code}\n```\n"
                f"### Downstream file that depends on it: {ds_rkey}/{ds_path}\n"
                f"```\n{ds_code}\n```\n"
                f"Dependency type: {edge['depType']}\n"
            )

        # Also include the diff so the AI knows what specifically changed
        diff_snippet = (state.diff_text or "")[:4000]

        api_key = settings.anthropic_api_key
        if api_key and _LANGGRAPH_AVAILABLE:
            prompt = f"""## PR Dependency Impact Analysis

A pull request in repo `{upstream_rkey}` changes these files: {', '.join(state.changed_files)}

### Diff (what changed)
```
{diff_snippet}
```

### Upstream ↔ Downstream Code
{code_context}

---

For each affected downstream file, analyze:
1. What specifically could break or become inconsistent
2. What action the downstream repo owner should take
3. Severity: critical / high / medium / low

Return JSON:
{{
  "edges": [
    {{
      "downstream_repo": "repo name",
      "downstream_path": "file path",
      "reason": "Specific explanation of what breaks and why (2-3 sentences)",
      "action_required": "What needs to change in the downstream repo",
      "severity": "critical|high|medium|low"
    }}
  ]
}}

If nothing would actually break, return {{"edges": []}}."""

            llm = ChatAnthropic(model="claude-sonnet-4-6", api_key=api_key, max_tokens=2048)
            response = llm.invoke([
                SystemMessage(content="You are a dependency impact analyst. Analyze actual code to determine if upstream changes break downstream consumers. Be specific about what breaks. If the change is backward-compatible, say so. Return ONLY valid JSON."),
                HumanMessage(content=prompt),
            ])
            raw = response.content if hasattr(response, "content") else str(response)

            if hasattr(response, "usage_metadata") and response.usage_metadata:
                state.claude_tokens_in += response.usage_metadata.get("input_tokens", 0)
                state.claude_tokens_out += response.usage_metadata.get("output_tokens", 0)

            try:
                parsed = json.loads(raw)
                ai_edges = parsed.get("edges", [])
            except json.JSONDecodeError:
                ai_edges = []

            edge_lookup = {(e["downstreamRepoRkey"], e.get("downstreamPath", "")): e for e in edges_for_analysis}
            for ai_edge in ai_edges:
                ds_name = ai_edge.get("downstream_repo", "")
                ds_path = ai_edge.get("downstream_path", "")
                matched = edge_lookup.get((ds_name, ds_path))
                if not matched:
                    for key, val in edge_lookup.items():
                        if key[0] == ds_name:
                            matched = val
                            break
                if matched:
                    severity = ai_edge.get("severity", "medium")
                    action = ai_edge.get("action_required", "review-recommended")
                    affected_edges.append({
                        "codeDependency": matched["codeDependency"],
                        "downstreamRepo": matched["downstreamRepo"],
                        "reason": ai_edge.get("reason", "Potential impact detected"),
                        "downstreamPath": ds_path or matched.get("downstreamPath"),
                        "actionRequired": action,
                    })
        else:
            for edge in edges_for_analysis:
                affected_edges.append({
                    "codeDependency": edge["codeDependency"],
                    "downstreamRepo": edge["downstreamRepo"],
                    "reason": f"Changed '{edge['changedFile']}' is depended on by {edge['downstreamRepoRkey']}",
                    "downstreamPath": edge.get("downstreamPath"),
                    "actionRequired": "review-recommended",
                })

        state.affected_edges = affected_edges
        state.downstream_repos = sorted(downstream_repo_set)

        count = len(downstream_repo_set)
        if count == 0:
            state.impact_risk_level = "none"
        elif count == 1:
            state.impact_risk_level = "low"
        elif count <= 3:
            state.impact_risk_level = "medium"
        elif count <= 7:
            state.impact_risk_level = "high"
        else:
            state.impact_risk_level = "critical"

    except Exception as exc:  # noqa: BLE001
        state.error = f"check_deps error: {exc}"

    return state


# ---------------------------------------------------------------------------
# Node 6: claude_reason
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are a compliance analyst reviewing a pull request against organizational policies.
Evaluate each control carefully and respond ONLY with valid JSON matching the schema provided.
Do not include markdown fences or any text outside the JSON object."""

_RESPONSE_SCHEMA = {
    "risk_level": "critical|high|medium|low|none",
    "summary": "2-3 sentence human-readable assessment",
    "control_evaluations": [
        {
            "control_uri": "AT-URI of the control record",
            "status": "pass|fail|warning|skipped",
            "reason": "brief explanation (max 200 chars)",
        }
    ],
    "required_approvals": [
        {
            "approver_did": "optional DID of specific approver",
            "approver_role_uri": "optional AT-URI of role that can approve",
            "approver_team_uri": "optional AT-URI of team that can approve",
            "reason": "why this approval is required (max 200 chars)",
            "policy_ref": "optional AT-URI of the control requiring this approval",
        }
    ],
}


def _build_claude_prompt(state: ComplianceState) -> str:
    profile_data = _val(state.repo_profile) if state.repo_profile else {}
    controls_text = "\n".join(
        f"- {_val(c).get('controlId', '?')}: {_val(c).get('name', 'Unnamed')}\n"
        f"  Check type: {_val(c).get('checkType', '?')}, "
        f"Enforcement: {_val(c).get('enforcement', '?')}\n"
        f"  Control URI: {c.get('uri', '')}"
        for c in state.controls
    ) or "  (no controls configured)"

    semgrep_summary = (
        f"{len(state.semgrep_results)} findings" if state.semgrep_results else "not run / no findings"
    )
    gitleaks_summary = (
        f"{len(state.gitleaks_results)} findings" if state.gitleaks_results else "not run / no findings"
    )
    osv_summary = (
        f"{len(state.osv_results)} vulnerabilities" if state.osv_results else "not run / no findings"
    )

    owner_lines = []
    for fpath, owners in (state.file_owner_map or {}).items():
        owners_str = ", ".join(
            o.get("ownerDid", o.get("ownerTeam", "?")) for o in owners
        )
        owner_lines.append(f"  {fpath} → {owners_str}")
    owners_text = "\n".join(owner_lines) or "  (no code owner rules matched)"

    dep_text = (
        f"  {len(state.downstream_repos)} downstream repo(s) affected, "
        f"impact level: {state.impact_risk_level}"
        if state.downstream_repos
        else "  none"
    )

    diff_preview = state.diff_text[:3000] + ("\n...(truncated)" if len(state.diff_text) > 3000 else "")

    return f"""## Repository Profile
- Data Classification: {profile_data.get('dataClassification', 'unknown')}
- Handles Data: {', '.join(profile_data.get('handlesData', [])) or 'unknown'}
- Applicable Regulations: {', '.join(profile_data.get('applicableRegulations', [])) or 'none'}
- Risk Tier: {profile_data.get('riskTier', 'unknown')}
- Enforcement Mode: {profile_data.get('enforcementMode', 'advisory')}

## Pull Request
- Changed Files ({len(state.changed_files)}):
{chr(10).join('  - ' + f for f in state.changed_files[:30]) or '  (none)'}
- Diff Preview:
{diff_preview}

## Applicable Controls
{controls_text}

## Scan Results
### Semgrep (SAST): {semgrep_summary}
### Gitleaks (Secrets): {gitleaks_summary}
### OSV-Scanner (Dependencies): {osv_summary}

## Code Owners Affected
{owners_text}

## Downstream Dependencies
{dep_text}

---

Evaluate this PR against each applicable control. Respond with JSON matching exactly:
{json.dumps(_RESPONSE_SCHEMA, indent=2)}"""


def claude_reason(state: ComplianceState) -> ComplianceState:
    """Send context to Claude for policy reasoning and structured evaluation."""
    if not _LANGGRAPH_AVAILABLE:
        state.summary = "Claude reasoning skipped: langchain-anthropic not installed."
        state.risk_level = "medium"
        return state

    api_key = settings.anthropic_api_key
    if not api_key:
        state.summary = "Claude reasoning skipped: TANGLED_ORG_ANTHROPIC_API_KEY not set."
        state.risk_level = "medium"
        return state

    try:
        llm = ChatAnthropic(
            model="claude-sonnet-4-6",
            api_key=api_key,
            max_tokens=4096,
        )
        prompt = _build_claude_prompt(state)
        messages = [
            SystemMessage(content=_SYSTEM_PROMPT),
            HumanMessage(content=prompt),
        ]
        response = llm.invoke(messages)
        raw = response.content if hasattr(response, "content") else str(response)

        # Track token usage if available
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            state.claude_tokens_in = response.usage_metadata.get("input_tokens", 0)
            state.claude_tokens_out = response.usage_metadata.get("output_tokens", 0)

        # Parse structured JSON response
        parsed = json.loads(raw)
        raw_level = parsed.get("risk_level", "medium")
        # Severity enum doesn't include "none"; map it to "low"
        state.risk_level = raw_level if raw_level in ("critical", "high", "medium", "low") else "low"
        state.summary = parsed.get("summary", "")
        state.control_evaluations = parsed.get("control_evaluations", [])
        state.required_approvals = parsed.get("required_approvals", [])

    except json.JSONDecodeError:
        # Claude didn't return valid JSON — record raw response as summary
        state.summary = raw[:2000] if "raw" in dir() else "Malformed Claude response."
        state.risk_level = "medium"
    except Exception as exc:  # noqa: BLE001
        state.error = f"claude_reason error: {exc}"
        state.summary = f"Reasoning failed: {exc}"
        state.risk_level = "medium"

    return state


# ---------------------------------------------------------------------------
# Node 7: decide_gate
# ---------------------------------------------------------------------------

def decide_gate(state: ComplianceState) -> ComplianceState:
    """Aggregate control results into final merge gate verdict."""
    try:
        # Build a map of control URI → evaluation for quick lookup
        eval_by_uri = {e.get("control_uri", ""): e for e in state.control_evaluations}

        blocked_controls: list[str] = []
        pending_approval_uris: list[str] = []
        has_warning = False

        for control_record in state.controls:
            ctrl_uri = control_record.get("uri", "")
            cv = _val(control_record)
            enforcement = cv.get("enforcement", "advisory")
            check_type = cv.get("checkType", "gate")

            evaluation = eval_by_uri.get(ctrl_uri)
            if not evaluation:
                continue

            status = evaluation.get("status", "skipped")

            if status == "fail":
                if enforcement == "hard":
                    blocked_controls.append(ctrl_uri)
                elif enforcement == "soft":
                    has_warning = True
            elif status == "warning":
                has_warning = True

            # Approval-type controls that aren't satisfied yet
            if check_type == "approval" and status not in ("pass", "skipped"):
                pending_approval_uris.append(ctrl_uri)

        # Also flag required_approvals from Claude as needing human review
        if state.required_approvals:
            pending_approval_uris.extend(
                a.get("policy_ref", "") for a in state.required_approvals if a.get("policy_ref")
            )
            pending_approval_uris = [u for u in pending_approval_uris if u]  # remove empty

        # Determine gate status
        if blocked_controls:
            gate_status = GateStatus.BLOCKED
            gate_reason = (
                f"Blocked by {len(blocked_controls)} hard-enforcement control(s) that failed."
            )
        elif pending_approval_uris:
            gate_status = GateStatus.NEEDS_HUMAN_REVIEW
            gate_reason = f"Requires human approval for {len(pending_approval_uris)} control(s)."
        elif has_warning:
            gate_status = GateStatus.WARNING
            gate_reason = "Soft-enforcement controls raised warnings."
        else:
            gate_status = GateStatus.PASS
            gate_reason = "All controls passed or were waived."

        state.gate_status = gate_status
        state.gate_reason = gate_reason
        state.blocked_controls = blocked_controls

        # Post-merge actions
        actions = []
        if state.downstream_repos:
            actions.append({"type": "propagate-issues", "repos": state.downstream_repos})
        if state.affected_owners:
            actions.append({"type": "notify-owners", "dids": state.affected_owners})
        state.post_merge_actions = actions

    except Exception as exc:  # noqa: BLE001
        state.error = f"decide_gate error: {exc}"
        state.gate_status = GateStatus.NEEDS_HUMAN_REVIEW
        state.gate_reason = f"Gate decision failed: {exc}"

    return state


# ---------------------------------------------------------------------------
# Node 8: write_records
# ---------------------------------------------------------------------------


def write_records(state: ComplianceState) -> ComplianceState:
    """Write all assessment records to ATProto and close the agent run."""
    client = get_client()
    start_time = state.agent_run_started
    records_written = 0
    agent_run_rkey: Optional[str] = None

    try:
        # 1. AgentRun — opened first so we can reference it in prAssessment
        run = AgentRun(
            pull_request=state.pr_uri,
            repo=state.repo_uri,
            status=AgentRunStatus.RUNNING,
            agent_version="0.1.0",
            started_at=datetime.fromtimestamp(start_time, tz=timezone.utc),
        )
        run_result = client.create_governance_record(run)
        records_written += 1
        state.agent_run_uri = run_result["uri"]
        agent_run_rkey = run_result["uri"].rsplit("/", 1)[-1]
        state.agent_run_rkey = agent_run_rkey

        # 2. PRAssessment
        cv_stats = _count_control_statuses(state.control_evaluations)
        assessment = PRAssessment(
            pull_request=state.pr_uri,
            repo=state.repo_uri,
            risk_level=state.risk_level,
            summary=state.summary[:5000] if state.summary else "",
            changed_files=len(state.changed_files),
            affected_owners=state.affected_owners or None,
            affected_teams=state.affected_teams or None,
            controls_passed=cv_stats["pass"],
            controls_failed=cv_stats["fail"],
            controls_warning=cv_stats["warning"],
            agent_run=state.agent_run_uri,
            created_at=datetime.now(timezone.utc),
        )
        assessment_result = client.create_governance_record(assessment)
        records_written += 1
        assessment_uri = assessment_result["uri"]
        state.pr_assessment_uri = assessment_uri

        # 3. Evidence — one per scan tool + Claude reasoning
        evidence_uris: list[str] = []

        if state.semgrep_results or state.semgrep_results == []:  # ran but maybe 0 findings
            ev = Evidence(
                pr_assessment=assessment_uri,
                evidence_type="semgrep-report",
                title="Semgrep SAST Scan",
                summary=f"{len(state.semgrep_results)} finding(s)",
                content=json.dumps(state.semgrep_results[:50], default=str)[:50_000],
                findings_count=len(state.semgrep_results),
                created_at=datetime.now(timezone.utc),
            )
            ev_result = client.create_governance_record(ev)
            evidence_uris.append(ev_result["uri"])
            records_written += 1

        if state.gitleaks_results or state.gitleaks_results == []:
            ev = Evidence(
                pr_assessment=assessment_uri,
                evidence_type="gitleaks-report",
                title="Gitleaks Secrets Scan",
                summary=f"{len(state.gitleaks_results)} finding(s)",
                content=json.dumps(state.gitleaks_results[:50], default=str)[:50_000],
                findings_count=len(state.gitleaks_results),
                created_at=datetime.now(timezone.utc),
            )
            ev_result = client.create_governance_record(ev)
            evidence_uris.append(ev_result["uri"])
            records_written += 1

        if state.osv_results or state.osv_results == []:
            ev = Evidence(
                pr_assessment=assessment_uri,
                evidence_type="osv-report",
                title="OSV-Scanner Dependency Scan",
                summary=f"{len(state.osv_results)} vulnerability/ies",
                content=json.dumps(state.osv_results[:50], default=str)[:50_000],
                findings_count=len(state.osv_results),
                created_at=datetime.now(timezone.utc),
            )
            ev_result = client.create_governance_record(ev)
            evidence_uris.append(ev_result["uri"])
            records_written += 1

        if state.summary:
            ev = Evidence(
                pr_assessment=assessment_uri,
                evidence_type="claude-reasoning",
                title="Claude Compliance Reasoning",
                summary=state.summary[:2000],
                content=state.summary[:50_000],
                findings_count=None,
                created_at=datetime.now(timezone.utc),
            )
            ev_result = client.create_governance_record(ev)
            evidence_uris.append(ev_result["uri"])
            records_written += 1

        state.evidence_uris = evidence_uris

        # 4. ControlEvaluation — one per control
        for ce in state.control_evaluations:
            ctrl_uri = ce.get("control_uri", "")
            if not ctrl_uri:
                continue
            evaluation = ControlEvaluation(
                pr_assessment=assessment_uri,
                control=ctrl_uri,
                status=ce.get("status", "skipped"),
                reason=ce.get("reason", "")[:2000],
                evidence=evidence_uris or None,
                created_at=datetime.now(timezone.utc),
            )
            client.create_governance_record(evaluation)
            records_written += 1

        # 5. RequiredApproval — one per approval requirement from Claude
        approval_uris: list[str] = []
        for ra in state.required_approvals:
            approval = RequiredApproval(
                pr_assessment=assessment_uri,
                approver_did=ra.get("approver_did"),
                approver_role=ra.get("approver_role_uri"),
                approver_team=ra.get("approver_team_uri"),
                reason=ra.get("reason", "Required approval")[:1000],
                policy_ref=ra.get("policy_ref"),
                status=ApprovalStatus.PENDING,
                created_at=datetime.now(timezone.utc),
            )
            approval_result = client.create_governance_record(approval)
            approval_uris.append(approval_result["uri"])
            records_written += 1

        # 6. ImpactAssessment — only if downstream repos affected
        if state.affected_edges:
            edges = []
            for e in state.affected_edges:
                edges.append(
                    AffectedEdge(
                        code_dependency=e["codeDependency"],
                        downstream_repo=e["downstreamRepo"],
                        reason=e.get("reason", "")[:500],
                        downstream_path=e.get("downstreamPath"),
                        action_required=e.get("actionRequired", "review-recommended"),
                    )
                )
            impact = ImpactAssessment(
                pull_request=state.pr_uri,
                repo=state.repo_uri,
                affected_edges=edges,
                risk_level=state.impact_risk_level if state.impact_risk_level != "none" else "low",
                summary=f"{len(state.downstream_repos)} downstream repo(s) affected.",
                created_at=datetime.now(timezone.utc),
            )
            client.create_governance_record(impact)
            records_written += 1

        # NOTE: Issues and incidents are NOT created here. Control evaluations
        # and impact assessments are advisory ("potential incidents") until the
        # PR is merged. The pr_watcher materialises them on merge.

        # 7. MergeGate — final verdict
        gate = MergeGate(
            pull_request=state.pr_uri,
            pr_assessment=assessment_uri,
            status=state.gate_status,
            reason=state.gate_reason[:2000],
            blocked_controls=state.blocked_controls or None,
            pending_approvals=approval_uris or None,
            created_at=datetime.now(timezone.utc),
        )
        client.create_governance_record(gate)
        records_written += 1

        state.records_written = records_written

        # 8. Close AgentRun with final metrics
        duration_ms = int((time.time() - start_time) * 1000)
        scans_run = ",".join(
            t
            for t, results in [
                ("semgrep", state.semgrep_results),
                ("gitleaks", state.gitleaks_results),
                ("osv-scanner", state.osv_results),
            ]
            if results is not None
        )
        _update_agent_run(
            client=client,
            rkey=agent_run_rkey,
            pr_uri=state.pr_uri,
            repo_uri=state.repo_uri,
            status=AgentRunStatus.COMPLETED,
            duration_ms=duration_ms,
            claude_tokens_in=state.claude_tokens_in,
            claude_tokens_out=state.claude_tokens_out,
            scans_run=scans_run or None,
            records_written=records_written,
            error_message=None,
        )

    except Exception as exc:  # noqa: BLE001
        err_msg = f"write_records error: {exc}"
        state.error = err_msg
        # Best-effort: close AgentRun as failed
        if agent_run_rkey:
            try:
                duration_ms = int((time.time() - start_time) * 1000)
                _update_agent_run(
                    client=client,
                    rkey=agent_run_rkey,
                    pr_uri=state.pr_uri,
                    repo_uri=state.repo_uri,
                    status=AgentRunStatus.FAILED,
                    duration_ms=duration_ms,
                    error_message=err_msg[:2000],
                )
            except Exception:  # noqa: BLE001
                pass

    finally:
        # Clean up cloned repo
        if state.clone_dir and os.path.isdir(state.clone_dir):
            shutil.rmtree(state.clone_dir, ignore_errors=True)
            state.clone_dir = ""

    return state


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _count_control_statuses(evaluations: list[dict]) -> dict[str, int]:
    counts = {"pass": 0, "fail": 0, "warning": 0, "skipped": 0}
    for e in evaluations:
        s = e.get("status", "skipped")
        if s in counts:
            counts[s] += 1
    return counts


def _update_agent_run(
    client,
    rkey: str,
    pr_uri: str,
    repo_uri: str,
    status: str,
    duration_ms: Optional[int] = None,
    claude_tokens_in: Optional[int] = None,
    claude_tokens_out: Optional[int] = None,
    scans_run: Optional[str] = None,
    records_written: Optional[int] = None,
    error_message: Optional[str] = None,
) -> None:
    """Overwrite the AgentRun record (same rkey) with final metrics."""
    existing = client.get_record("sh.tangled.governance.audit.agentRun", rkey=rkey)
    if existing is None:
        return
    v = _val(existing)
    run = AgentRun(
        pull_request=v.get("pullRequest", pr_uri),
        repo=v.get("repo", repo_uri),
        status=status,
        agent_version=v.get("agentVersion"),
        duration_ms=duration_ms,
        claude_tokens_in=claude_tokens_in,
        claude_tokens_out=claude_tokens_out,
        scans_run=scans_run.split(",") if scans_run else None,
        records_written=records_written,
        error_message=error_message,
        started_at=datetime.fromisoformat(v["startedAt"]) if v.get("startedAt") else datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
    )
    client.create_governance_record(run, rkey=rkey)


# ---------------------------------------------------------------------------
# LangGraph graph assembly
# ---------------------------------------------------------------------------

if _LANGGRAPH_AVAILABLE:
    _builder = StateGraph(ComplianceState)

    _builder.add_node("clone_diff", clone_diff)
    _builder.add_node("load_profile", load_profile)
    _builder.add_node("map_owners", map_owners)
    _builder.add_node("run_scans", run_scans)
    _builder.add_node("check_deps", check_deps)
    _builder.add_node("claude_reason", claude_reason)
    _builder.add_node("decide_gate", decide_gate)
    _builder.add_node("write_records", write_records)

    _builder.add_edge(START, "clone_diff")
    _builder.add_edge("clone_diff", "load_profile")
    _builder.add_edge("load_profile", "map_owners")
    _builder.add_edge("map_owners", "run_scans")
    _builder.add_edge("run_scans", "check_deps")
    _builder.add_edge("check_deps", "claude_reason")
    _builder.add_edge("claude_reason", "decide_gate")
    _builder.add_edge("decide_gate", "write_records")
    _builder.add_edge("write_records", END)

    graph = _builder.compile()
    """Compiled LangGraph agent. Call graph.invoke(ComplianceState(...)) to run."""
else:
    graph = None  # type: ignore[assignment]
    """None when langgraph is not installed (install with: pip install 'tangled-org[agent]')"""


from src.agent.nodes.scan import ScanState, scan_graph  # noqa: E402

__all__ = [
    "ComplianceState",
    "clone_diff",
    "load_profile",
    "map_owners",
    "run_scans",
    "check_deps",
    "claude_reason",
    "decide_gate",
    "write_records",
    "graph",
    "ScanState",
    "scan_graph",
]
