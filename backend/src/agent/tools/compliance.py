"""Tools for querying and creating compliance and assessment records.

Covers: RepoProfile, CodeOwner, Incident, SLATracker, PRAssessment,
        ControlEvaluation, RequiredApproval, MergeGate, ImpactAssessment,
        Propagation.

Typical agent workflow:
  1. get_repo_profile       → understand data classification + regulations
  2. list_code_owners       → find who must approve based on changed paths
  3. list_incidents_for_repo → check existing open incidents
  4. create_pr_assessment   → write the main assessment record
  5. create_control_evaluation (×N) → record result of each control
  6. create_required_approval (×N) → flag human approvals needed
  7. create_merge_gate      → set the final pass/block decision
"""

import json
from datetime import datetime, timezone
from typing import Optional

from langchain_core.tools import tool

from src.models import (
    CodeOwner,
    ControlEvaluation,
    ImpactAssessment,
    Incident,
    MergeGate,
    PRAssessment,
    Propagation,
    RequiredApproval,
    RepoProfile,
    SLATracker,
)
from src.models.base import ApprovalStatus, IncidentStatus, SLAStatus
from src.models.compliance import AffectedEdge, DownstreamAction

from ._client import _val, get_client


# ---------------------------------------------------------------------------
# RepoProfile
# ---------------------------------------------------------------------------


@tool
def get_repo_profile(repo_uri: str, did: Optional[str] = None) -> Optional[dict]:
    """Fetch the compliance profile for a repository by its AT-URI.

    Returns data_classification (public/internal/confidential/restricted),
    applicable_regulations (gdpr, hipaa, soc2 …), enforcement_mode, risk_tier,
    and the list of data types the repo handles.

    This is the first tool to call when assessing a PR — it determines which
    regulations apply and how strictly controls are enforced.
    Returns None if no profile exists for this repo.
    """
    result = get_client().list_records(RepoProfile.COLLECTION, did=did)
    for r in result["records"]:
        if _val(r).get("repo") == repo_uri:
            return r
    return None


@tool
def list_repo_profiles(did: Optional[str] = None) -> list[dict]:
    """List all RepoProfile records on the PDS."""
    result = get_client().list_records(RepoProfile.COLLECTION, did=did)
    return result["records"]


@tool
def create_repo_profile(
    org_uri: str,
    repo_uri: str,
    data_classification: str,
    handles_data: Optional[str] = None,
    applicable_regulations: Optional[str] = None,
    risk_tier: Optional[str] = None,
    enforcement_mode: Optional[str] = None,
    description: Optional[str] = None,
) -> dict:
    """Create a RepoProfile compliance record for a repository.

    data_classification: public | internal | confidential | restricted
    handles_data: comma-separated data types — pii, phi, financial, credentials,
                  ml-training-data, public-data
    applicable_regulations: comma-separated — iso-27001, gdpr, eu-ai-act, soc2,
                             hipaa, pci-dss, custom
    risk_tier: critical | high | medium | low
    enforcement_mode: advisory | soft | hard
    Returns {"uri": ..., "cid": ...}.
    """
    now = datetime.now(timezone.utc)
    profile = RepoProfile(
        org=org_uri,
        repo=repo_uri,
        data_classification=data_classification,
        handles_data=handles_data.split(",") if handles_data else None,
        applicable_regulations=(
            applicable_regulations.split(",") if applicable_regulations else None
        ),
        risk_tier=risk_tier,
        enforcement_mode=enforcement_mode,
        description=description,
        created_at=now,
    )
    return get_client().create_governance_record(profile)


# ---------------------------------------------------------------------------
# CodeOwner
# ---------------------------------------------------------------------------


@tool
def list_code_owners(repo_uri: str, did: Optional[str] = None) -> list[dict]:
    """List CodeOwner records for a repository AT-URI.

    Each record has a glob pattern (e.g. `api/**`) and either an ownerDid or
    ownerTeam AT-URI indicating who must approve changes to matching paths.
    Use this to determine which people or teams need to be added as required
    approvers for a PR based on which files it touches.
    """
    result = get_client().list_records(CodeOwner.COLLECTION, did=did)
    return [r for r in result["records"] if _val(r).get("repo") == repo_uri]


# ---------------------------------------------------------------------------
# Incident
# ---------------------------------------------------------------------------


@tool
def list_incidents_for_repo(
    repo_uri: str,
    status: Optional[str] = None,
    did: Optional[str] = None,
) -> list[dict]:
    """List Incident records for a repository AT-URI.

    Optionally filter by status: open | in-progress | resolved | closed
    Use this to check for existing open incidents before creating new ones,
    and to link a PR to an ongoing incident.
    """
    result = get_client().list_records(Incident.COLLECTION, did=did)
    records = [r for r in result["records"] if _val(r).get("repo") == repo_uri]
    if status:
        records = [r for r in records if _val(r).get("status") == status]
    return records


@tool
def get_incident(rkey: str, did: Optional[str] = None) -> Optional[dict]:
    """Fetch a single Incident record by its rkey. Returns None if not found."""
    return get_client().get_record(Incident.COLLECTION, rkey=rkey, did=did)


@tool
def create_incident(
    issue_uri: str,
    repo_uri: str,
    severity: str,
    category: str,
    description: Optional[str] = None,
    org_uri: Optional[str] = None,
    affected_package: Optional[str] = None,
    cve_ids: Optional[str] = None,
    linked_pr: Optional[str] = None,
) -> dict:
    """Create an Incident record when a scan finds a security or compliance problem.

    issue_uri: AT-URI of the sh.tangled.issue record tracking this incident
    severity: critical | high | medium | low
    category: data-leak | vulnerability | unauthorized-access | supply-chain |
              misconfiguration | other
    cve_ids: comma-separated CVE IDs, e.g. "CVE-2024-1234,CVE-2024-5678"
    linked_pr: AT-URI of the pull request that introduced the issue
    Returns {"uri": ..., "cid": ...}.
    """
    incident = Incident(
        issue=issue_uri,
        repo=repo_uri,
        org=org_uri,
        severity=severity,
        category=category,
        description=description,
        affected_package=affected_package,
        cve_ids=cve_ids.split(",") if cve_ids else None,
        linked_pr=linked_pr,
        status=IncidentStatus.OPEN,
        created_at=datetime.now(timezone.utc),
    )
    return get_client().create_governance_record(incident)


# ---------------------------------------------------------------------------
# SLATracker
# ---------------------------------------------------------------------------


@tool
def list_sla_trackers_for_incident(
    incident_uri: str, did: Optional[str] = None
) -> list[dict]:
    """List SLATracker records for an incident AT-URI.

    Shows the resolution deadline, current SLA status (open/at-risk/breached/
    resolved), and who resolved it. Use this to check whether an incident is
    at risk of breaching its SLA before closing a PR.
    """
    result = get_client().list_records(SLATracker.COLLECTION, did=did)
    return [
        r for r in result["records"] if _val(r).get("incident") == incident_uri
    ]


@tool
def create_sla_tracker(
    incident_uri: str,
    sla_rule_uri: str,
    deadline_iso: str,
) -> dict:
    """Create an SLATracker to monitor resolution of an incident against an SLA rule.

    deadline_iso: ISO 8601 datetime string for the resolution deadline,
                  e.g. "2025-01-15T14:00:00Z". Compute from the incident
                  creation time + maxResolutionHours from the matching SLARule.
    Returns {"uri": ..., "cid": ...}.
    """
    tracker = SLATracker(
        incident=incident_uri,
        sla_rule=sla_rule_uri,
        deadline=datetime.fromisoformat(deadline_iso),
        status=SLAStatus.OPEN,
    )
    return get_client().create_governance_record(tracker)


# ---------------------------------------------------------------------------
# PRAssessment
# ---------------------------------------------------------------------------


@tool
def list_pr_assessments_for_pr(
    pr_uri: str, did: Optional[str] = None
) -> list[dict]:
    """List PRAssessment records for a pull request AT-URI.

    A PR may have multiple assessments if it was re-evaluated after changes.
    """
    result = get_client().list_records(PRAssessment.COLLECTION, did=did)
    return [
        r for r in result["records"] if _val(r).get("pullRequest") == pr_uri
    ]


@tool
def get_pr_assessment(rkey: str, did: Optional[str] = None) -> Optional[dict]:
    """Fetch a single PRAssessment record by its rkey. Returns None if not found."""
    return get_client().get_record(PRAssessment.COLLECTION, rkey=rkey, did=did)


@tool
def create_pr_assessment(
    pr_uri: str,
    repo_uri: str,
    risk_level: str,
    summary: str,
    changed_files: Optional[int] = None,
    affected_owners: Optional[str] = None,
    affected_teams: Optional[str] = None,
    controls_passed: Optional[int] = None,
    controls_failed: Optional[int] = None,
    controls_warning: Optional[int] = None,
    agent_run_uri: Optional[str] = None,
    incident_uri: Optional[str] = None,
) -> dict:
    """Create a PRAssessment record summarising the compliance evaluation of a PR.

    risk_level: critical | high | medium | low
    summary: human-readable explanation of findings (up to 5000 chars)
    affected_owners: comma-separated DIDs of people whose code is touched
    affected_teams: comma-separated AT-URIs of teams whose code is touched
    controls_passed / controls_failed / controls_warning: tally counts
    agent_run_uri: AT-URI of the AgentRun record for this evaluation
    incident_uri: AT-URI of a linked Incident if one was created or found
    Returns {"uri": ..., "cid": ...}.
    """
    assessment = PRAssessment(
        pull_request=pr_uri,
        repo=repo_uri,
        incident=incident_uri,
        risk_level=risk_level,
        summary=summary,
        changed_files=changed_files,
        affected_owners=affected_owners.split(",") if affected_owners else None,
        affected_teams=affected_teams.split(",") if affected_teams else None,
        controls_passed=controls_passed,
        controls_failed=controls_failed,
        controls_warning=controls_warning,
        agent_run=agent_run_uri,
        created_at=datetime.now(timezone.utc),
    )
    return get_client().create_governance_record(assessment)


# ---------------------------------------------------------------------------
# ControlEvaluation
# ---------------------------------------------------------------------------


@tool
def create_control_evaluation(
    pr_assessment_uri: str,
    control_uri: str,
    status: str,
    reason: Optional[str] = None,
    evidence_uris: Optional[str] = None,
) -> dict:
    """Create a ControlEvaluation recording the result of a single control check.

    Call this once per control after evaluating it against the PR.
    status: pass | fail | warning | skipped
    reason: explanation of the verdict (up to 2000 chars)
    evidence_uris: comma-separated AT-URIs of Evidence records that support
                   this evaluation (e.g. the Semgrep scan output)
    Returns {"uri": ..., "cid": ...}.
    """
    evaluation = ControlEvaluation(
        pr_assessment=pr_assessment_uri,
        control=control_uri,
        status=status,
        reason=reason,
        evidence=evidence_uris.split(",") if evidence_uris else None,
        created_at=datetime.now(timezone.utc),
    )
    return get_client().create_governance_record(evaluation)


@tool
def list_control_evaluations_for_assessment(
    pr_assessment_uri: str, did: Optional[str] = None
) -> list[dict]:
    """List all ControlEvaluation records for a PRAssessment AT-URI.

    Returns one entry per control evaluated, each with status (pass/fail/
    warning/skipped) and reasoning. Use this to build the final tally before
    creating the MergeGate.
    """
    result = get_client().list_records(ControlEvaluation.COLLECTION, did=did)
    return [
        r
        for r in result["records"]
        if _val(r).get("prAssessment") == pr_assessment_uri
    ]


# ---------------------------------------------------------------------------
# RequiredApproval
# ---------------------------------------------------------------------------


@tool
def create_required_approval(
    pr_assessment_uri: str,
    reason: str,
    approver_did: Optional[str] = None,
    approver_role_uri: Optional[str] = None,
    approver_team_uri: Optional[str] = None,
    policy_ref: Optional[str] = None,
) -> dict:
    """Create a RequiredApproval record flagging that a specific person or role
    must approve the PR before it can merge.

    Provide at least one of approver_did, approver_role_uri, or approver_team_uri.
    reason: why this approval is required (up to 1000 chars)
    approver_did: DID of the specific person who must approve
    approver_role_uri: AT-URI of a Role — any member with this role may approve
    approver_team_uri: AT-URI of a Team — the team lead or any member may approve
    policy_ref: AT-URI of the Control record that mandates this approval
    Returns {"uri": ..., "cid": ...}.
    """
    approval = RequiredApproval(
        pr_assessment=pr_assessment_uri,
        approver_did=approver_did,
        approver_role=approver_role_uri,
        approver_team=approver_team_uri,
        reason=reason,
        policy_ref=policy_ref,
        status=ApprovalStatus.PENDING,
        created_at=datetime.now(timezone.utc),
    )
    return get_client().create_governance_record(approval)


@tool
def list_required_approvals_for_assessment(
    pr_assessment_uri: str, did: Optional[str] = None
) -> list[dict]:
    """List all RequiredApproval records for a PRAssessment AT-URI.

    Returns each pending approval with who is required to sign off and why.
    Use this to populate the pendingApprovals list when creating a MergeGate.
    """
    result = get_client().list_records(RequiredApproval.COLLECTION, did=did)
    return [
        r
        for r in result["records"]
        if _val(r).get("prAssessment") == pr_assessment_uri
    ]


# ---------------------------------------------------------------------------
# MergeGate
# ---------------------------------------------------------------------------


@tool
def get_merge_gate(pr_uri: str, did: Optional[str] = None) -> Optional[dict]:
    """Fetch the MergeGate record for a pull request AT-URI.

    Returns the gate status (pass/warning/needs-human-review/blocked),
    the reason, and lists of blockedControls and pendingApprovals.
    Returns None if no gate record exists yet.
    """
    result = get_client().list_records(MergeGate.COLLECTION, did=did)
    for r in result["records"]:
        if _val(r).get("pullRequest") == pr_uri:
            return r
    return None


@tool
def create_merge_gate(
    pr_uri: str,
    pr_assessment_uri: str,
    status: str,
    reason: Optional[str] = None,
    blocked_controls: Optional[str] = None,
    pending_approvals: Optional[str] = None,
) -> dict:
    """Create a MergeGate record — the final decision on whether a PR can merge.

    This is the last record the agent writes for each PR evaluation. External
    tooling reads this to enforce the gate (e.g. a GitHub Status Check).

    status: pass | warning | needs-human-review | blocked
    reason: explanation of the decision (up to 2000 chars)
    blocked_controls: comma-separated AT-URIs of Control records that failed
                      and are blocking the merge
    pending_approvals: comma-separated AT-URIs of RequiredApproval records
                       that have not yet been satisfied
    Returns {"uri": ..., "cid": ...}.
    """
    gate = MergeGate(
        pull_request=pr_uri,
        pr_assessment=pr_assessment_uri,
        status=status,
        reason=reason,
        blocked_controls=blocked_controls.split(",") if blocked_controls else None,
        pending_approvals=pending_approvals.split(",") if pending_approvals else None,
        created_at=datetime.now(timezone.utc),
    )
    return get_client().create_governance_record(gate)


# ---------------------------------------------------------------------------
# ImpactAssessment
# ---------------------------------------------------------------------------


@tool
def create_impact_assessment(
    pr_uri: str,
    repo_uri: str,
    risk_level: str,
    affected_edges_json: str,
    summary: Optional[str] = None,
) -> dict:
    """Create an ImpactAssessment documenting downstream blast radius of a PR.

    risk_level: critical | high | medium | low
    affected_edges_json: JSON array of edge objects. Each object must have:
      - codeDependency (str): AT-URI of the CodeDependency record
      - downstreamRepo (str): AT-URI of the affected downstream repo
      - reason (str): why this downstream repo is affected (≤500 chars)
      Optional per edge:
      - downstreamPath (str): specific file/module impacted
      - actionRequired (str): update-required | review-recommended | no-action

    Example:
      '[{"codeDependency": "at://...", "downstreamRepo": "at://...",
         "reason": "imports UserModel which changed", "actionRequired": "update-required"}]'

    Returns {"uri": ..., "cid": ...}.
    """
    edges_data = json.loads(affected_edges_json)
    edges = [AffectedEdge(**e) for e in edges_data]
    assessment = ImpactAssessment(
        pull_request=pr_uri,
        repo=repo_uri,
        affected_edges=edges,
        risk_level=risk_level,
        summary=summary,
        created_at=datetime.now(timezone.utc),
    )
    return get_client().create_governance_record(assessment)


# ---------------------------------------------------------------------------
# Propagation
# ---------------------------------------------------------------------------


@tool
def create_propagation(
    source_pr_uri: str,
    source_repo_uri: str,
    downstream_actions_json: str,
    incident_uri: Optional[str] = None,
) -> dict:
    """Create a Propagation record documenting post-merge actions triggered in
    downstream repos (e.g. auto-created issues, scan triggers).

    downstream_actions_json: JSON array of action objects. Each must have:
      - repo (str): AT-URI of the downstream repo
      - issue (str): AT-URI of the auto-created issue in that repo
      - codeDependency (str): AT-URI of the CodeDependency edge that caused this
      - reason (str): explanation (≤1000 chars)
      Optional:
      - severity (str): critical | high | medium | low

    Returns {"uri": ..., "cid": ...}.
    """
    actions_data = json.loads(downstream_actions_json)
    actions = [DownstreamAction(**a) for a in actions_data]
    propagation = Propagation(
        source_pr=source_pr_uri,
        source_repo=source_repo_uri,
        incident=incident_uri,
        downstream_actions=actions,
        created_at=datetime.now(timezone.utc),
    )
    return get_client().create_governance_record(propagation)
