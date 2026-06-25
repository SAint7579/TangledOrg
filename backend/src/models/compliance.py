"""Compliance & assessment records."""

from datetime import datetime
from typing import ClassVar, Optional

from pydantic import Field

from src.models.base import (
    ATProtoRecord,
    NAMESPACE_PREFIX,
    ActionRequired,
    ApprovalStatus,
    ControlStatus,
    DataClassification,
    DataType,
    EnforcementMode,
    GateStatus,
    IncidentCategory,
    IncidentStatus,
    PostMergeActionType,
    Regulation,
    SLAStatus,
    Severity,
)


class RepoProfile(ATProtoRecord):
    """sh.tangled.governance.compliance.repoProfile"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.compliance.repoProfile"

    org: str = Field(..., description="AT-URI of the organization")
    repo: str = Field(..., description="AT-URI of the sh.tangled.repo record")
    data_classification: DataClassification = Field(..., alias="dataClassification")
    handles_data: Optional[list[DataType]] = Field(None, alias="handlesData")
    applicable_regulations: Optional[list[Regulation]] = Field(
        None, alias="applicableRegulations"
    )
    risk_tier: Optional[Severity] = Field(None, alias="riskTier")
    enforcement_mode: Optional[EnforcementMode] = Field(None, alias="enforcementMode")
    description: Optional[str] = Field(None, max_length=2000)
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")


class CodeOwner(ATProtoRecord):
    """sh.tangled.governance.compliance.codeOwner"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.compliance.codeOwner"

    repo: str = Field(..., description="AT-URI of the repo")
    pattern: str = Field(..., description="Glob pattern, e.g. 'api/**'")
    owner_did: Optional[str] = Field(None, alias="ownerDid")
    owner_team: Optional[str] = Field(
        None, alias="ownerTeam", description="AT-URI of team record"
    )
    approval_required: bool = Field(True, alias="approvalRequired")
    description: Optional[str] = Field(None, max_length=500)
    created_at: datetime = Field(..., alias="createdAt")


class Incident(ATProtoRecord):
    """sh.tangled.governance.compliance.incident"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.compliance.incident"

    issue: str = Field(..., description="AT-URI of the sh.tangled.issue record")
    repo: str = Field(..., description="AT-URI of the repo")
    org: Optional[str] = Field(None, description="AT-URI of the organization")
    severity: Severity
    category: IncidentCategory
    affected_package: Optional[str] = Field(None, alias="affectedPackage")
    cve_ids: Optional[list[str]] = Field(None, alias="cveIds")
    description: Optional[str] = Field(None, max_length=5000)
    linked_pr: Optional[str] = Field(None, alias="linkedPR")
    status: Optional[IncidentStatus] = IncidentStatus.OPEN
    created_at: datetime = Field(..., alias="createdAt")
    resolved_at: Optional[datetime] = Field(None, alias="resolvedAt")


class SLATracker(ATProtoRecord):
    """sh.tangled.governance.compliance.slaTracker"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.compliance.slaTracker"

    incident: str = Field(..., description="AT-URI of the incident")
    sla_rule: str = Field(..., alias="slaRule", description="AT-URI of the SLA rule")
    deadline: datetime
    status: SLAStatus
    resolved_at: Optional[datetime] = Field(None, alias="resolvedAt")
    resolved_by: Optional[str] = Field(None, alias="resolvedBy")
    breached_at: Optional[datetime] = Field(None, alias="breachedAt")


class PRAssessment(ATProtoRecord):
    """sh.tangled.governance.compliance.prAssessment"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.compliance.prAssessment"

    pull_request: str = Field(..., alias="pullRequest", description="AT-URI of the PR")
    repo: str = Field(..., description="AT-URI of the repo")
    incident: Optional[str] = Field(None, description="AT-URI of linked incident")
    risk_level: Severity = Field(..., alias="riskLevel")
    summary: str = Field(..., max_length=5000)
    changed_files: Optional[int] = Field(None, alias="changedFiles")
    affected_owners: Optional[list[str]] = Field(None, alias="affectedOwners")
    affected_teams: Optional[list[str]] = Field(None, alias="affectedTeams")
    controls_passed: Optional[int] = Field(None, alias="controlsPassed")
    controls_failed: Optional[int] = Field(None, alias="controlsFailed")
    controls_warning: Optional[int] = Field(None, alias="controlsWarning")
    agent_run: Optional[str] = Field(None, alias="agentRun")
    created_at: datetime = Field(..., alias="createdAt")


class ControlEvaluation(ATProtoRecord):
    """sh.tangled.governance.compliance.controlEvaluation"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.compliance.controlEvaluation"

    pr_assessment: str = Field(..., alias="prAssessment")
    control: str = Field(..., description="AT-URI of the control")
    status: ControlStatus
    reason: Optional[str] = Field(None, max_length=2000)
    evidence: Optional[list[str]] = Field(None, description="AT-URIs of evidence records")
    created_at: datetime = Field(..., alias="createdAt")


class RequiredApproval(ATProtoRecord):
    """sh.tangled.governance.compliance.requiredApproval"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.compliance.requiredApproval"

    pr_assessment: str = Field(..., alias="prAssessment")
    approver_did: Optional[str] = Field(None, alias="approverDid")
    approver_role: Optional[str] = Field(None, alias="approverRole")
    approver_team: Optional[str] = Field(None, alias="approverTeam")
    reason: str = Field(..., max_length=1000)
    policy_ref: Optional[str] = Field(None, alias="policyRef")
    status: ApprovalStatus = ApprovalStatus.PENDING
    approved_by: Optional[str] = Field(None, alias="approvedBy")
    approved_at: Optional[datetime] = Field(None, alias="approvedAt")
    created_at: datetime = Field(..., alias="createdAt")


class PostMergeAction(ATProtoRecord):
    action: PostMergeActionType
    target_repos: Optional[list[str]] = Field(None, alias="targetRepos")
    reason: Optional[str] = Field(None, max_length=500)


class MergeGate(ATProtoRecord):
    """sh.tangled.governance.compliance.mergeGate"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.compliance.mergeGate"

    pull_request: str = Field(..., alias="pullRequest")
    pr_assessment: str = Field(..., alias="prAssessment")
    status: GateStatus
    reason: Optional[str] = Field(None, max_length=2000)
    blocked_controls: Optional[list[str]] = Field(None, alias="blockedControls")
    pending_approvals: Optional[list[str]] = Field(None, alias="pendingApprovals")
    post_merge_actions: Optional[list[PostMergeAction]] = Field(
        None, alias="postMergeActions"
    )
    created_at: datetime = Field(..., alias="createdAt")


class AffectedEdge(ATProtoRecord):
    code_dependency: str = Field(..., alias="codeDependency")
    downstream_repo: str = Field(..., alias="downstreamRepo")
    downstream_path: Optional[str] = Field(None, alias="downstreamPath")
    reason: str = Field(..., max_length=500)
    action_required: Optional[ActionRequired] = Field(None, alias="actionRequired")


class ImpactAssessment(ATProtoRecord):
    """sh.tangled.governance.compliance.impactAssessment"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.compliance.impactAssessment"

    pull_request: str = Field(..., alias="pullRequest")
    repo: str
    affected_edges: list[AffectedEdge] = Field(..., alias="affectedEdges")
    risk_level: Severity = Field(..., alias="riskLevel")
    summary: Optional[str] = Field(None, max_length=3000)
    created_at: datetime = Field(..., alias="createdAt")


class ScanRecord(ATProtoRecord):
    """sh.tangled.governance.compliance.scanResult

    Stores the full result of an AI compliance scan on a repository.
    """

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.compliance.scanResult"

    repo: str = Field(..., description="AT-URI of the repo")
    risk_level: Severity = Field(..., alias="riskLevel")
    summary: str = Field(..., max_length=5000)
    policy_pack: str = Field(..., alias="policyPack", description="Display name of the policy pack")
    files_scanned: int = Field(0, alias="filesScanned")
    controls_passed: int = Field(0, alias="controlsPassed")
    controls_failed: int = Field(0, alias="controlsFailed")
    controls_warning: int = Field(0, alias="controlsWarning")
    findings_count: int = Field(0, alias="findingsCount")
    findings_json: Optional[str] = Field(None, alias="findingsJson", max_length=50000)
    issues_created: int = Field(0, alias="issuesCreated")
    duration_ms: Optional[int] = Field(None, alias="durationMs")
    error: Optional[str] = Field(None, max_length=2000)
    created_at: datetime = Field(..., alias="createdAt")


class DownstreamAction(ATProtoRecord):
    repo: str
    issue: str = Field(..., description="AT-URI of auto-created issue")
    code_dependency: str = Field(..., alias="codeDependency")
    reason: str = Field(..., max_length=1000)
    severity: Optional[Severity] = None


class Propagation(ATProtoRecord):
    """sh.tangled.governance.compliance.propagation"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.compliance.propagation"

    source_pr: str = Field(..., alias="sourcePR")
    source_repo: str = Field(..., alias="sourceRepo")
    incident: Optional[str] = None
    downstream_actions: list[DownstreamAction] = Field(..., alias="downstreamActions")
    created_at: datetime = Field(..., alias="createdAt")
