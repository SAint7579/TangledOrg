"""Repo-level compliance scan pipeline.

Walks a repository's file tree, reads source files, evaluates them against
bound policy controls using Claude, and raises issues for violations.

Pipeline:
  load_context → collect_files → read_files → evaluate_compliance → check_cross_repo → report_findings → save_scan_record

Usage:
    from src.agent.nodes.scan import scan_graph, ScanState

    result = scan_graph.invoke(ScanState(repo_rkey="auth-service"))
    print(result.summary)
    for f in result.findings:
        print(f["severity"], f["file"], f["title"])
"""

import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Optional

import httpx

try:
    from langchain_anthropic import ChatAnthropic
    from langchain_core.messages import HumanMessage, SystemMessage
    from langgraph.graph import END, START, StateGraph

    _LANGGRAPH_AVAILABLE = True
except ImportError:
    _LANGGRAPH_AVAILABLE = False

from src.agent.tools._client import _val, get_client
from src.config import settings

_HTTPX_TIMEOUT = 15

import re as _re


def _extract_json(text: str) -> dict:
    """Parse JSON from Claude's response, stripping markdown fences if present."""
    text = text.strip()
    # Remove ```json ... ``` or ``` ... ``` wrappers
    m = _re.search(r"```(?:json)?\s*\n?(.*?)```", text, _re.DOTALL)
    if m:
        text = m.group(1).strip()
    return json.loads(text)
_MAX_FILES = 30
_MAX_CONTENT_BYTES = 120_000
_SOURCE_EXTENSIONS = {
    ".c", ".h", ".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs",
    ".java", ".kt", ".rb", ".php", ".cs", ".cpp", ".cc", ".cxx",
    ".swift", ".sh", ".bash", ".yaml", ".yml", ".toml", ".json",
    ".dockerfile", ".tf", ".hcl",
}
_SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv",
    "dist", "build", ".next", "target", ".idea", ".vscode",
}


@dataclass
class ScanState:
    """State passed between scan pipeline nodes."""

    repo_rkey: str = ""

    # From load_context
    repo_uri: str = ""
    repo_profile: Optional[dict] = None
    policy_pack_name: str = ""
    controls: list[dict] = field(default_factory=list)
    knot: str = ""
    owner_did: str = ""

    # From collect_files
    file_paths: list[str] = field(default_factory=list)

    # From read_files
    file_contents: dict[str, str] = field(default_factory=dict)

    # From evaluate_compliance
    findings: list[dict] = field(default_factory=list)
    summary: str = ""
    risk_level: str = "low"
    controls_passed: int = 0
    controls_failed: int = 0
    controls_warning: int = 0
    claude_tokens_in: int = 0
    claude_tokens_out: int = 0

    # From check_cross_repo
    repo_dependencies: list[dict] = field(default_factory=list)
    code_dependencies: list[dict] = field(default_factory=list)
    cross_repo_findings: list[dict] = field(default_factory=list)
    cross_repo_issues_created: list[dict] = field(default_factory=list)

    # From report_findings
    issues_created: list[dict] = field(default_factory=list)
    incidents_created: list[dict] = field(default_factory=list)

    # Metadata
    started: float = field(default_factory=time.time)
    error: Optional[str] = None
    files_scanned: int = 0
    progress_callback: Optional[Callable[[str], None]] = None


# ---------------------------------------------------------------------------
# Node 1: load_context
# ---------------------------------------------------------------------------


def _notify(state, msg: str):
    if state.progress_callback:
        state.progress_callback(msg)


def load_context(state: ScanState) -> ScanState:
    """Load repo metadata, compliance profile, and bound policy controls."""
    _notify(state, "Loading repo context...")
    try:
        client = get_client()

        repos = client.list_records("sh.tangled.repo")["records"]
        repo_record = None
        for r in repos:
            uri = r.get("uri", "")
            if uri.rsplit("/", 1)[-1] == state.repo_rkey:
                repo_record = r
                state.repo_uri = uri
                break

        if not repo_record:
            state.error = f"Repo '{state.repo_rkey}' not found"
            return state

        v = _val(repo_record)
        state.knot = v.get("knot", "")
        state.owner_did = client.did

        if not state.knot:
            state.error = f"Repo '{state.repo_rkey}' has no knot server"
            return state

        # Compliance profile
        profiles = client.list_governance_records("compliance.repoProfile")
        for p in profiles["records"]:
            if _val(p).get("repo") == state.repo_uri:
                state.repo_profile = _val(p)
                break

        # Policy binding → pack + controls
        bindings = client.list_governance_records("policy.repoBinding")
        for b in bindings["records"]:
            if _val(b).get("repo") == state.repo_uri:
                pack_uri = _val(b).get("policyPack", "")
                if pack_uri:
                    pack_rkey = pack_uri.rsplit("/", 1)[-1]
                    pack = client.get_record(
                        "sh.tangled.governance.policy.policyPack", rkey=pack_rkey
                    )
                    if pack:
                        pv = _val(pack)
                        state.policy_pack_name = pv.get("displayName") or pv.get("name", "")

                    controls = client.list_governance_records("policy.control")
                    state.controls = [
                        r for r in controls["records"]
                        if _val(r).get("policyPack") == pack_uri
                    ]
                break

        if not state.controls:
            state.error = "No policy controls bound to this repo"
            return state

    except Exception as exc:  # noqa: BLE001
        state.error = f"load_context: {exc}"

    return state


# ---------------------------------------------------------------------------
# Node 2: collect_files
# ---------------------------------------------------------------------------


def _walk_tree(knot: str, owner_did: str, repo_rkey: str, path: str = "") -> list[dict]:
    """Recursively walk the knot tree endpoint to collect all file entries."""
    params: dict[str, str] = {"repo": f"{owner_did}/{repo_rkey}", "ref": "main"}
    if path:
        params["path"] = path

    try:
        resp = httpx.get(
            f"https://{knot}/xrpc/sh.tangled.repo.tree",
            params=params,
            timeout=_HTTPX_TIMEOUT,
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        return data.get("files", [])
    except Exception:  # noqa: BLE001
        return []


def _is_source_file(name: str) -> bool:
    """Check if a filename has a recognised source code extension."""
    lower = name.lower()
    if lower in ("makefile", "dockerfile", "cmakelists.txt", ".gitignore"):
        return True
    dot = lower.rfind(".")
    if dot == -1:
        return False
    return lower[dot:] in _SOURCE_EXTENSIONS


def collect_files(state: ScanState) -> ScanState:
    """Walk the repo tree and collect source file paths."""
    if state.error:
        return state
    _notify(state, "Collecting files...")
    try:
        all_files: list[str] = []
        dirs_to_visit = [""]

        while dirs_to_visit and len(all_files) < _MAX_FILES * 3:
            current_path = dirs_to_visit.pop(0)
            entries = _walk_tree(state.knot, state.owner_did, state.repo_rkey, current_path)

            for entry in entries:
                name = entry.get("name", "")
                mode = entry.get("mode", "")

                if "040000" in mode:
                    if name not in _SKIP_DIRS:
                        full = f"{current_path}/{name}" if current_path else name
                        dirs_to_visit.append(full)
                else:
                    if _is_source_file(name):
                        full = f"{current_path}/{name}" if current_path else name
                        all_files.append(full)

        state.file_paths = all_files[:_MAX_FILES]
    except Exception as exc:  # noqa: BLE001
        state.error = f"collect_files: {exc}"

    return state


# ---------------------------------------------------------------------------
# Node 3: read_files
# ---------------------------------------------------------------------------


def read_files(state: ScanState) -> ScanState:
    """Read file contents from the knot blob endpoint."""
    if state.error:
        return state
    _notify(state, "Reading source files...")
    total_bytes = 0
    contents: dict[str, str] = {}

    for fpath in state.file_paths:
        if total_bytes >= _MAX_CONTENT_BYTES:
            break
        try:
            resp = httpx.get(
                f"https://{state.knot}/xrpc/sh.tangled.repo.blob",
                params={
                    "repo": f"{state.owner_did}/{state.repo_rkey}",
                    "ref": "main",
                    "path": fpath,
                },
                timeout=_HTTPX_TIMEOUT,
            )
            if resp.status_code != 200:
                continue
            data = resp.json()
            if data.get("isBinary"):
                continue
            content = data.get("content", "")
            if len(content) > 30_000:
                content = content[:30_000] + "\n... (truncated)"
            contents[fpath] = content
            total_bytes += len(content)
        except Exception:  # noqa: BLE001
            continue

    state.file_contents = contents
    state.files_scanned = len(contents)
    return state


# ---------------------------------------------------------------------------
# Node 4: evaluate_compliance
# ---------------------------------------------------------------------------

_SYSTEM = """You are a compliance auditor reviewing source code against organizational policy controls.

For each file, evaluate it against every applicable control. Be specific: cite the exact line or pattern that violates or satisfies each control. Not every control applies to every file — skip controls that are clearly irrelevant to a given file's language or purpose.

Respond ONLY with valid JSON matching the schema below. No markdown fences."""

_RESPONSE_SCHEMA = {
    "risk_level": "critical|high|medium|low",
    "summary": "2-4 sentence overall assessment of the repo's compliance posture",
    "controls_passed": 0,
    "controls_failed": 0,
    "controls_warning": 0,
    "findings": [
        {
            "file": "path/to/file.c",
            "line": 42,
            "severity": "critical|high|medium|low",
            "control_id": "MISRA-1",
            "control_name": "Name of violated control",
            "title": "Short title (max 120 chars)",
            "description": "Detailed explanation of the violation and how to fix it (max 500 chars)",
            "category": "vulnerability|misconfiguration|data-leak|supply-chain|other",
        }
    ],
}


def _build_scan_prompt(state: ScanState) -> str:
    profile = state.repo_profile or {}
    controls_text = "\n".join(
        f"- **{_val(c).get('controlId', '?')}**: {_val(c).get('name', 'Unnamed')}\n"
        f"  Description: {_val(c).get('description', 'N/A')}\n"
        f"  Check type: {_val(c).get('checkType', '?')}, "
        f"  Enforcement: {_val(c).get('enforcement', '?')}, "
        f"  Severity threshold: {_val(c).get('severityThreshold', 'N/A')}"
        for c in state.controls
    )

    files_text = ""
    for fpath, content in state.file_contents.items():
        files_text += f"\n### {fpath}\n```\n{content}\n```\n"

    return f"""## Repository: {state.repo_rkey}

## Compliance Profile
- Data Classification: {profile.get('dataClassification', 'unknown')}
- Handles Data: {', '.join(profile.get('handlesData', [])) or 'unknown'}
- Applicable Regulations: {', '.join(profile.get('applicableRegulations', [])) or 'none'}
- Risk Tier: {profile.get('riskTier', 'unknown')}

## Policy Pack: {state.policy_pack_name}

## Controls to Evaluate Against
{controls_text}

## Source Files ({state.files_scanned} files)
{files_text}

---

Evaluate each source file against every applicable control. Return JSON matching:
{json.dumps(_RESPONSE_SCHEMA, indent=2)}

IMPORTANT:
- Only report actual violations you can see in the code. Do not guess.
- For each finding, cite the specific file and approximate line number.
- Include the control_id from the controls listed above.
- Be thorough but precise — false positives undermine trust."""


def evaluate_compliance(state: ScanState) -> ScanState:
    """Send code + controls to Claude for structured compliance evaluation."""
    if state.error:
        return state
    _notify(state, "Evaluating compliance (this may take 30-60s)...")
    if not state.file_contents:
        state.summary = "No source files found to scan."
        return state

    if not _LANGGRAPH_AVAILABLE:
        state.error = "langchain-anthropic not installed"
        return state

    api_key = settings.anthropic_api_key
    if not api_key:
        state.error = "TANGLED_ORG_ANTHROPIC_API_KEY not set"
        return state

    try:
        llm = ChatAnthropic(
            model="claude-sonnet-4-6",
            api_key=api_key,
            max_tokens=8192,
        )
        prompt = _build_scan_prompt(state)
        response = llm.invoke([
            SystemMessage(content=_SYSTEM),
            HumanMessage(content=prompt),
        ])
        raw = response.content if hasattr(response, "content") else str(response)

        if hasattr(response, "usage_metadata") and response.usage_metadata:
            state.claude_tokens_in = response.usage_metadata.get("input_tokens", 0)
            state.claude_tokens_out = response.usage_metadata.get("output_tokens", 0)

        parsed = _extract_json(raw)
        state.risk_level = parsed.get("risk_level", "medium")
        state.summary = parsed.get("summary", "")
        state.findings = parsed.get("findings", [])
        state.controls_passed = parsed.get("controls_passed", 0)
        state.controls_failed = parsed.get("controls_failed", 0)
        state.controls_warning = parsed.get("controls_warning", 0)

    except (json.JSONDecodeError, ValueError):
        state.summary = raw[:3000] if "raw" in dir() else "Malformed response from Claude."
        state.risk_level = "medium"
    except Exception as exc:  # noqa: BLE001
        state.error = f"evaluate_compliance: {exc}"

    return state


# ---------------------------------------------------------------------------
# Node 5: check_cross_repo
# ---------------------------------------------------------------------------

_CROSS_REPO_SYSTEM = """You are a dependency analyst. Given a repository's source code, its dependency graph edges, and compliance findings, identify cross-repo discrepancies.

Look for:
1. API contract violations — this repo exposes an API that downstream consumers depend on, and the code has issues that would break consumers.
2. Shared model/schema changes — data structures used across repos are inconsistent.
3. Missing or outdated dependency declarations — the code imports/calls something not declared in the graph.
4. Security issues that propagate — e.g. a vulnerable dependency used by downstream services.

Respond ONLY with valid JSON. No markdown fences."""

_CROSS_REPO_SCHEMA = {
    "cross_repo_findings": [
        {
            "downstream_repo_uri": "AT-URI of the downstream repo that needs to change",
            "severity": "critical|high|medium|low",
            "title": "Short title (max 120 chars)",
            "description": "What needs to change in the downstream repo and why (max 500 chars)",
            "source_file": "file in THIS repo that causes the issue",
            "dependency_type": "api-call|import|shared-model|event-consumer|database-shared|config-ref",
        }
    ],
}


def check_cross_repo(state: ScanState) -> ScanState:
    """Analyze dependency graph for cross-repo discrepancies and create issues in downstream repos."""
    if state.error and not state.findings:
        return state
    _notify(state, "Checking cross-repo dependencies...")
    try:
        client = get_client()
        from src.models import RepoDependency, CodeDependency

        repo_deps = client.list_governance_records("graph.repoDependency")
        code_deps = client.list_governance_records("graph.codeDependency")

        state.repo_dependencies = [
            r for r in repo_deps.get("records", [])
            if _val(r).get("sourceRepo") == state.repo_uri
            or _val(r).get("targetRepo") == state.repo_uri
        ]
        state.code_dependencies = [
            r for r in code_deps.get("records", [])
            if _val(r).get("sourceRepo") == state.repo_uri
            or _val(r).get("targetRepo") == state.repo_uri
        ]

        if not state.repo_dependencies and not state.code_dependencies:
            return state

        if not _LANGGRAPH_AVAILABLE or not state.file_contents:
            return state

        api_key = settings.anthropic_api_key
        if not api_key:
            return state

        repos = client.list_records("sh.tangled.repo")["records"]
        uri_to_rkey: dict[str, str] = {}
        for r in repos:
            uri_to_rkey[r.get("uri", "")] = r.get("uri", "").rsplit("/", 1)[-1]

        dep_text = "### Repo-level dependencies\n"
        for d in state.repo_dependencies:
            v = _val(d)
            src = uri_to_rkey.get(v.get("sourceRepo", ""), v.get("sourceRepo", ""))
            tgt = uri_to_rkey.get(v.get("targetRepo", ""), v.get("targetRepo", ""))
            dep_text += f"- {src} → {tgt} ({v.get('dependencyType', '?')})\n"

        dep_text += "\n### Code-level dependencies\n"
        for d in state.code_dependencies:
            v = _val(d)
            src_repo = uri_to_rkey.get(v.get("sourceRepo", ""), "?")
            tgt_repo = uri_to_rkey.get(v.get("targetRepo", ""), "?")
            dep_text += (
                f"- {src_repo}:{v.get('sourcePath', '?')} → "
                f"{tgt_repo}:{v.get('targetPath', '?')} "
                f"({v.get('dependencyType', '?')})\n"
            )

        findings_text = ""
        if state.findings:
            findings_text = "\n### Existing compliance findings in this repo\n"
            for f in state.findings[:15]:
                findings_text += f"- [{f.get('severity', '?')}] {f.get('file', '?')}: {f.get('title', '?')}\n"

        files_summary = "\n### Key source files\n"
        for fpath, content in list(state.file_contents.items())[:10]:
            preview = content[:1500] + ("\n...(truncated)" if len(content) > 1500 else "")
            files_summary += f"\n#### {fpath}\n```\n{preview}\n```\n"

        prompt = f"""## Repository: {state.repo_rkey} ({state.repo_uri})

## Dependency Graph
{dep_text}
{findings_text}
{files_summary}

---

Identify cross-repo discrepancies. For each issue, specify the `downstream_repo_uri` (the AT-URI of the repo that needs to change).

Available repo URIs:
{json.dumps({rkey: uri for uri, rkey in uri_to_rkey.items()}, indent=2)}

Return JSON matching:
{json.dumps(_CROSS_REPO_SCHEMA, indent=2)}

If there are no cross-repo issues, return {{"cross_repo_findings": []}}"""

        llm = ChatAnthropic(
            model="claude-sonnet-4-6",
            api_key=api_key,
            max_tokens=4096,
        )
        response = llm.invoke([
            SystemMessage(content=_CROSS_REPO_SYSTEM),
            HumanMessage(content=prompt),
        ])
        raw = response.content if hasattr(response, "content") else str(response)

        if hasattr(response, "usage_metadata") and response.usage_metadata:
            state.claude_tokens_in += response.usage_metadata.get("input_tokens", 0)
            state.claude_tokens_out += response.usage_metadata.get("output_tokens", 0)

        parsed = _extract_json(raw)
        cross_findings = parsed.get("cross_repo_findings", [])

        if not cross_findings:
            return state

        state.cross_repo_findings = cross_findings

        from src.agent.tools.tangled import _create_native_record

        rkey_to_did: dict[str, str] = {}
        for r in repos:
            rk = r.get("uri", "").rsplit("/", 1)[-1]
            rkey_to_did[rk] = _val(r).get("repoDid", "")

        now = datetime.now(timezone.utc)
        for finding in cross_findings[:10]:
            ds_uri = finding.get("downstream_repo_uri", "")
            ds_rkey = uri_to_rkey.get(ds_uri, "")
            ds_did = rkey_to_did.get(ds_rkey, "")

            if not ds_did:
                continue

            title = f"[Upstream: {state.repo_rkey}] {finding.get('title', 'Dependency discrepancy')}"
            sev = finding.get("severity", "medium")
            body = (
                f"**Severity:** {sev.upper()}\n"
                f"**Source repo:** `{state.repo_rkey}`\n"
                f"**Source file:** `{finding.get('source_file', '?')}`\n"
                f"**Dependency type:** {finding.get('dependency_type', '?')}\n\n"
                f"### Description\n{finding.get('description', 'No details.')}\n\n"
                f"---\n*Created by cross-repo dependency analysis at {now.strftime('%Y-%m-%d %H:%M UTC')}*"
            )

            issue_result = _create_native_record(
                "sh.tangled.repo.issue",
                {
                    "repo": ds_did,
                    "title": title[:200],
                    "body": body,
                    "createdAt": now.isoformat(),
                },
            )

            # Also create an incident linked to this cross-repo issue
            category = finding.get("dependency_type", "other")
            if category not in (
                "data-leak", "vulnerability", "unauthorized-access",
                "supply-chain", "misconfiguration", "other",
            ):
                category = "other"

            from src.models import Incident
            incident = Incident(
                issue=issue_result["uri"],
                repo=ds_uri,
                severity=sev if sev in ("critical", "high", "medium", "low") else "medium",
                category=category,
                description=f"[Cross-repo from {state.repo_rkey}] {finding.get('description', '')}"[:2000],
                status="open",
                created_at=now,
            )
            client.create_governance_record(incident)

            state.cross_repo_issues_created.append({
                "uri": issue_result["uri"],
                "downstream_repo": ds_rkey,
                "title": title,
                "severity": sev,
            })

    except json.JSONDecodeError:
        pass
    except Exception as exc:  # noqa: BLE001
        if not state.error:
            state.error = f"check_cross_repo: {exc}"

    return state


# ---------------------------------------------------------------------------
# Node 6: report_findings
# ---------------------------------------------------------------------------


def report_findings(state: ScanState) -> ScanState:
    """Create issues and incidents for each finding."""
    if state.error and not state.findings:
        return state

    if not state.findings:
        return state
    _notify(state, "Creating issues and incidents...")
    try:
        from src.agent.tools.tangled import _repo_did_for_rkey, _create_native_record

        repo_did = _repo_did_for_rkey(state.repo_rkey)
        client = get_client()
        now = datetime.now(timezone.utc)

        # Deduplicate: group findings by (file, control_id) to avoid spamming
        seen = set()
        unique_findings = []
        for f in state.findings:
            key = (f.get("file", ""), f.get("control_id", ""))
            if key not in seen:
                seen.add(key)
                unique_findings.append(f)

        for finding in unique_findings[:20]:
            title = f"[{finding.get('control_id', 'SCAN')}] {finding.get('title', 'Compliance finding')}"
            sev = finding.get("severity", "medium")
            sev_badge = {"critical": "CRITICAL", "high": "HIGH", "medium": "MEDIUM", "low": "LOW"}.get(sev, "INFO")

            line_ref = f" (line ~{finding['line']})" if finding.get("line") else ""
            body = (
                f"**Severity:** {sev_badge}\n"
                f"**File:** `{finding.get('file', '?')}`{line_ref}\n"
                f"**Control:** {finding.get('control_id', '?')} — {finding.get('control_name', '')}\n"
                f"**Policy Pack:** {state.policy_pack_name}\n\n"
                f"### Description\n{finding.get('description', 'No details.')}\n\n"
                f"---\n*Found by automated compliance scan at {now.strftime('%Y-%m-%d %H:%M UTC')}*"
            )

            issue_result = _create_native_record(
                "sh.tangled.repo.issue",
                {
                    "repo": repo_did,
                    "title": title[:200],
                    "body": body,
                    "createdAt": now.isoformat(),
                },
            )
            state.issues_created.append({
                "uri": issue_result["uri"],
                "title": title,
                "severity": sev,
                "file": finding.get("file", ""),
            })

            category = finding.get("category", "other")
            if category not in (
                "data-leak", "vulnerability", "unauthorized-access",
                "supply-chain", "misconfiguration", "other",
            ):
                category = "other"

            from src.models import Incident
            incident = Incident(
                issue=issue_result["uri"],
                repo=state.repo_uri,
                severity=sev if sev in ("critical", "high", "medium", "low") else "medium",
                category=category,
                description=finding.get("description", "")[:2000],
                status="open",
                created_at=now,
            )
            inc_result = client.create_governance_record(incident)
            state.incidents_created.append({
                "uri": inc_result["uri"],
                "issue_uri": issue_result["uri"],
                "severity": sev,
            })

    except Exception as exc:  # noqa: BLE001
        state.error = f"report_findings: {exc}"

    return state


# ---------------------------------------------------------------------------
# Node 6: save_scan_record
# ---------------------------------------------------------------------------


def save_scan_record(state: ScanState) -> ScanState:
    """Persist the scan results as a ScanRecord for history/audit."""
    _notify(state, "Saving scan record...")
    try:
        from src.models import ScanRecord

        client = get_client()
        duration_ms = int((time.time() - state.started) * 1000)
        risk = state.risk_level if state.risk_level in ("critical", "high", "medium", "low") else "low"

        record = ScanRecord(
            repo=state.repo_uri,
            risk_level=risk,
            summary=state.summary[:5000] if state.summary else "Scan completed.",
            policy_pack=state.policy_pack_name or "Unknown",
            files_scanned=state.files_scanned,
            controls_passed=state.controls_passed,
            controls_failed=state.controls_failed,
            controls_warning=state.controls_warning,
            findings_count=len(state.findings),
            findings_json=json.dumps(state.findings[:50], default=str)[:50000] if state.findings else None,
            issues_created=len(state.issues_created),
            cross_repo_issues=len(state.cross_repo_issues_created),
            duration_ms=duration_ms,
            error=state.error,
            created_at=datetime.now(timezone.utc),
        )
        client.create_governance_record(record)
    except Exception as exc:  # noqa: BLE001
        if not state.error:
            state.error = f"save_scan_record: {exc}"

    return state


# ---------------------------------------------------------------------------
# Graph assembly
# ---------------------------------------------------------------------------

if _LANGGRAPH_AVAILABLE:
    _builder = StateGraph(ScanState)

    _builder.add_node("load_context", load_context)
    _builder.add_node("collect_files", collect_files)
    _builder.add_node("read_files", read_files)
    _builder.add_node("evaluate_compliance", evaluate_compliance)
    _builder.add_node("check_cross_repo", check_cross_repo)
    _builder.add_node("report_findings", report_findings)
    _builder.add_node("save_scan_record", save_scan_record)

    _builder.add_edge(START, "load_context")
    _builder.add_edge("load_context", "collect_files")
    _builder.add_edge("collect_files", "read_files")
    _builder.add_edge("read_files", "evaluate_compliance")
    _builder.add_edge("evaluate_compliance", "check_cross_repo")
    _builder.add_edge("check_cross_repo", "report_findings")
    _builder.add_edge("report_findings", "save_scan_record")
    _builder.add_edge("save_scan_record", END)

    scan_graph = _builder.compile()
else:
    scan_graph = None  # type: ignore[assignment]


__all__ = ["ScanState", "scan_graph"]
