"""Repo-level compliance scan pipeline.

Walks a repository's file tree, reads source files, evaluates them against
bound policy controls using Claude, and raises issues for violations.

Pipeline:
  load_context → collect_files → read_files → evaluate_compliance → report_findings

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
from typing import Optional

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

    # From report_findings
    issues_created: list[dict] = field(default_factory=list)
    incidents_created: list[dict] = field(default_factory=list)

    # Metadata
    started: float = field(default_factory=time.time)
    error: Optional[str] = None
    files_scanned: int = 0


# ---------------------------------------------------------------------------
# Node 1: load_context
# ---------------------------------------------------------------------------


def load_context(state: ScanState) -> ScanState:
    """Load repo metadata, compliance profile, and bound policy controls."""
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

        parsed = json.loads(raw)
        state.risk_level = parsed.get("risk_level", "medium")
        state.summary = parsed.get("summary", "")
        state.findings = parsed.get("findings", [])
        state.controls_passed = parsed.get("controls_passed", 0)
        state.controls_failed = parsed.get("controls_failed", 0)
        state.controls_warning = parsed.get("controls_warning", 0)

    except json.JSONDecodeError:
        state.summary = raw[:3000] if "raw" in dir() else "Malformed response from Claude."
        state.risk_level = "medium"
    except Exception as exc:  # noqa: BLE001
        state.error = f"evaluate_compliance: {exc}"

    return state


# ---------------------------------------------------------------------------
# Node 5: report_findings
# ---------------------------------------------------------------------------


def report_findings(state: ScanState) -> ScanState:
    """Create issues and incidents for each finding."""
    if state.error and not state.findings:
        return state

    if not state.findings:
        return state

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
# Graph assembly
# ---------------------------------------------------------------------------

if _LANGGRAPH_AVAILABLE:
    _builder = StateGraph(ScanState)

    _builder.add_node("load_context", load_context)
    _builder.add_node("collect_files", collect_files)
    _builder.add_node("read_files", read_files)
    _builder.add_node("evaluate_compliance", evaluate_compliance)
    _builder.add_node("report_findings", report_findings)

    _builder.add_edge(START, "load_context")
    _builder.add_edge("load_context", "collect_files")
    _builder.add_edge("collect_files", "read_files")
    _builder.add_edge("read_files", "evaluate_compliance")
    _builder.add_edge("evaluate_compliance", "report_findings")
    _builder.add_edge("report_findings", END)

    scan_graph = _builder.compile()
else:
    scan_graph = None  # type: ignore[assignment]


__all__ = ["ScanState", "scan_graph"]
