"""Tools for writing and querying audit trail records.

Covers: Evidence, AgentRun, Waiver.

Every agent execution must:
  1. Call `start_agent_run` at the very beginning to open an audit record.
  2. Call `create_evidence` for each scan's output (Semgrep, Gitleaks, OSV).
  3. Call `complete_agent_run` at the end — whether success or failure — to
     close the audit record with final token counts, scan names, and status.

Waivers let authorised users (dpo, security-lead, isms-manager) grant a
time-boxed exemption from a control for a specific repo. The agent should
check `get_active_waiver` before marking a control as failed.
"""

from datetime import datetime, timezone
from typing import Optional

from langchain_core.tools import tool

from src.models import AgentRun, Evidence, Waiver
from src.models.base import AgentRunStatus, WaiverStatus

from ._client import _val, get_client


# ---------------------------------------------------------------------------
# Evidence
# ---------------------------------------------------------------------------


@tool
def create_evidence(
    pr_assessment_uri: str,
    evidence_type: str,
    title: Optional[str] = None,
    summary: Optional[str] = None,
    content: Optional[str] = None,
    findings_count: Optional[int] = None,
) -> dict:
    """Create an Evidence record attaching scan output or reasoning to a PRAssessment.

    Call this once per scan or per piece of supporting material.
    evidence_type: semgrep-report | gitleaks-report | osv-report |
                   claude-reasoning | manual-review | screenshot | log
    title: short label for this evidence (≤200 chars)
    summary: concise description of what was found (≤2000 chars)
    content: full raw output from the tool (≤50 000 chars)
    findings_count: number of issues found (0 = clean scan)
    Returns {"uri": ..., "cid": ...}. Store the URI to link it from
    ControlEvaluation records via the evidence_uris parameter.
    """
    evidence = Evidence(
        pr_assessment=pr_assessment_uri,
        evidence_type=evidence_type,
        title=title,
        summary=summary,
        content=content,
        findings_count=findings_count,
        created_at=datetime.now(timezone.utc),
    )
    return get_client().create_governance_record(evidence)


@tool
def list_evidence_for_assessment(
    pr_assessment_uri: str, did: Optional[str] = None
) -> list[dict]:
    """List all Evidence records attached to a PRAssessment AT-URI.

    Returns each evidence item's type, title, summary, findingsCount, and
    the full content if present.
    """
    result = get_client().list_records(Evidence.COLLECTION, did=did)
    return [
        r
        for r in result["records"]
        if _val(r).get("prAssessment") == pr_assessment_uri
    ]


# ---------------------------------------------------------------------------
# AgentRun
# ---------------------------------------------------------------------------


@tool
def start_agent_run(
    pr_uri: str,
    repo_uri: str,
    agent_version: Optional[str] = None,
) -> dict:
    """Open an AgentRun audit record at the start of a PR evaluation.

    Call this as the very first action of every agent run. The returned URI
    should be passed to create_pr_assessment (as agent_run_uri) and to
    complete_agent_run when the run finishes.

    agent_version: semantic version string of the agent, e.g. "0.1.0"
    Returns {"uri": ..., "cid": ...}.
    """
    run = AgentRun(
        pull_request=pr_uri,
        repo=repo_uri,
        status=AgentRunStatus.RUNNING,
        agent_version=agent_version,
        started_at=datetime.now(timezone.utc),
    )
    return get_client().create_governance_record(run)


@tool
def complete_agent_run(
    rkey: str,
    status: str,
    duration_ms: Optional[int] = None,
    claude_tokens_in: Optional[int] = None,
    claude_tokens_out: Optional[int] = None,
    scans_run: Optional[str] = None,
    records_written: Optional[int] = None,
    error_message: Optional[str] = None,
) -> dict:
    """Close an AgentRun record at the end of a PR evaluation.

    This must be called regardless of whether the run succeeded or failed.
    Overwrites the existing record with final metrics.

    rkey: the record key from the URI returned by start_agent_run
    status: completed | failed | timed-out
    duration_ms: total wall-clock time of the run in milliseconds
    claude_tokens_in / claude_tokens_out: total tokens used by Claude
    scans_run: comma-separated scan tool names that were executed,
               e.g. "semgrep,gitleaks,osv-scanner"
    records_written: total number of ATProto records created during this run
    error_message: if status is failed, the error message (≤2000 chars)
    Returns {"uri": ..., "cid": ...}.
    """
    # Read the existing record to preserve immutable fields (pullRequest, repo,
    # startedAt) then write an updated version.
    existing = get_client().get_record(AgentRun.COLLECTION, rkey=rkey)
    if existing is None:
        raise ValueError(f"AgentRun record not found for rkey={rkey!r}")

    v = _val(existing)
    run = AgentRun(
        pull_request=v["pullRequest"],
        repo=v["repo"],
        status=status,
        agent_version=v.get("agentVersion"),
        duration_ms=duration_ms,
        claude_tokens_in=claude_tokens_in,
        claude_tokens_out=claude_tokens_out,
        scans_run=scans_run.split(",") if scans_run else None,
        records_written=records_written,
        error_message=error_message,
        started_at=datetime.fromisoformat(v["startedAt"]),
        completed_at=datetime.now(timezone.utc),
    )
    # ATProto createRecord with an explicit rkey overwrites the existing record.
    return get_client().create_governance_record(run, rkey=rkey)


@tool
def get_agent_run(rkey: str, did: Optional[str] = None) -> Optional[dict]:
    """Fetch an AgentRun record by its rkey. Returns None if not found."""
    return get_client().get_record(AgentRun.COLLECTION, rkey=rkey, did=did)


@tool
def list_agent_runs_for_pr(
    pr_uri: str, did: Optional[str] = None
) -> list[dict]:
    """List all AgentRun records for a pull request AT-URI.

    Returns status, duration, token usage, and scans run for each evaluation.
    """
    result = get_client().list_records(AgentRun.COLLECTION, did=did)
    return [
        r for r in result["records"] if _val(r).get("pullRequest") == pr_uri
    ]


# ---------------------------------------------------------------------------
# Waiver
# ---------------------------------------------------------------------------


@tool
def get_active_waiver(
    control_uri: str,
    repo_uri: str,
    did: Optional[str] = None,
) -> Optional[dict]:
    """Check whether an active waiver exists for a control+repo combination.

    Returns the Waiver record if one is active and not expired/revoked,
    or None if the control must be enforced normally.

    Call this before marking any control as `fail` — if an active waiver
    exists, the control should be recorded as `skipped` with the waiver
    URI as context in the reason field.
    """
    result = get_client().list_records(Waiver.COLLECTION, did=did)
    now = datetime.now(timezone.utc)
    for r in result["records"]:
        v = _val(r)
        if (
            v.get("control") == control_uri
            and v.get("repo") == repo_uri
            and v.get("status") == WaiverStatus.ACTIVE
        ):
            expires_raw = v.get("expiresAt")
            if expires_raw:
                try:
                    expires_at = datetime.fromisoformat(str(expires_raw))
                    if expires_at.tzinfo is None:
                        expires_at = expires_at.replace(tzinfo=timezone.utc)
                    if expires_at > now:
                        return r
                except (ValueError, TypeError):
                    pass
    return None


@tool
def list_waivers(
    repo_uri: Optional[str] = None,
    did: Optional[str] = None,
) -> list[dict]:
    """List Waiver records, optionally filtered to a specific repo AT-URI.

    Returns each waiver's control, repo, reason, status, expiresAt, and
    who granted it. Includes expired and revoked waivers.
    """
    result = get_client().list_records(Waiver.COLLECTION, did=did)
    records = result["records"]
    if repo_uri:
        records = [r for r in records if _val(r).get("repo") == repo_uri]
    return records
