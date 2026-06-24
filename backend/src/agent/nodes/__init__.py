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

    # Metadata
    agent_run_started: float = field(default_factory=time.time)
    records_written: int = 0
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Node 1: clone_diff
# ---------------------------------------------------------------------------


def clone_diff(state: ComplianceState) -> ComplianceState:
    """Clone the repo and compute the diff between PR branch and base."""
    try:
        clone_dir = tempfile.mkdtemp(prefix="tangled_org_")
        state.clone_dir = clone_dir

        # Shallow clone
        subprocess.run(
            ["git", "clone", "--depth", "50", state.repo_clone_url, clone_dir],
            check=True,
            capture_output=True,
            timeout=120,
        )

        # Fetch the PR branch explicitly (may not be in shallow clone)
        subprocess.run(
            ["git", "fetch", "origin", f"{state.pr_branch}:{state.pr_branch}"],
            check=False,  # best-effort; branch may already be present
            capture_output=True,
            timeout=30,
            cwd=clone_dir,
        )

        # Compute diff
        diff_result = subprocess.run(
            ["git", "diff", f"{state.base_branch}...{state.pr_branch}"],
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=clone_dir,
        )
        state.diff_text = diff_result.stdout[:50_000]  # cap at 50k chars

        # Collect changed file list
        files_result = subprocess.run(
            ["git", "diff", "--name-only", f"{state.base_branch}...{state.pr_branch}"],
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=clone_dir,
        )
        state.changed_files = [f for f in files_result.stdout.strip().split("\n") if f]

    except FileNotFoundError:
        # git not installed — proceed without diff (advisory mode)
        state.diff_text = ""
        state.changed_files = []
    except subprocess.TimeoutExpired as exc:
        state.error = f"clone_diff timed out: {exc}"
    except subprocess.CalledProcessError as exc:
        state.error = f"clone_diff git error: {exc.stderr.decode(errors='replace')[:500]}"
    except Exception as exc:  # noqa: BLE001
        state.error = f"clone_diff unexpected error: {exc}"

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
    """Walk the code dependency graph to find downstream impact."""
    try:
        affected_edges = []
        downstream_repo_set: set[str] = set()

        for changed_file in state.changed_files:
            for dep in state.code_dependencies:
                v = _val(dep)
                # We care about edges where this repo is the target (upstream)
                # and the changed file matches the target path
                if v.get("targetRepo") != state.repo_uri:
                    continue
                target_path = v.get("targetPath", "")
                if not target_path:
                    continue
                # Exact match or directory prefix
                if changed_file == target_path or changed_file.startswith(target_path.rstrip("/") + "/"):
                    dep_uri = dep.get("uri", "")
                    source_repo = v.get("sourceRepo", "")
                    if source_repo and source_repo != state.repo_uri:
                        downstream_repo_set.add(source_repo)
                        affected_edges.append({
                            "codeDependency": dep_uri,
                            "downstreamRepo": source_repo,
                            "reason": f"Changed path '{changed_file}' is depended on by {source_repo}",
                            "downstreamPath": v.get("sourcePath"),
                            "actionRequired": "review-recommended",
                        })

        state.affected_edges = affected_edges
        state.downstream_repos = sorted(downstream_repo_set)

        # Determine impact risk level based on count and downstream complexity
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
]
