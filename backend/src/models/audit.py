"""Audit trail records: evidence, agent runs, waivers."""

from datetime import datetime
from typing import ClassVar, Optional

from pydantic import Field

from src.models.base import (
    ATProtoRecord,
    NAMESPACE_PREFIX,
    AgentRunStatus,
    EvidenceType,
    WaiverStatus,
)


class Evidence(ATProtoRecord):
    """sh.tangled.governance.audit.evidence"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.audit.evidence"

    pr_assessment: str = Field(..., alias="prAssessment")
    evidence_type: EvidenceType = Field(..., alias="evidenceType")
    title: Optional[str] = Field(None, max_length=200)
    summary: Optional[str] = Field(None, max_length=2000)
    content: Optional[str] = Field(None, max_length=50000)
    findings_count: Optional[int] = Field(None, alias="findingsCount")
    created_at: datetime = Field(..., alias="createdAt")


class AgentRun(ATProtoRecord):
    """sh.tangled.governance.audit.agentRun"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.audit.agentRun"

    pull_request: str = Field(..., alias="pullRequest")
    repo: str
    status: AgentRunStatus
    agent_version: Optional[str] = Field(None, alias="agentVersion")
    duration_ms: Optional[int] = Field(None, alias="durationMs")
    claude_tokens_in: Optional[int] = Field(None, alias="claudeTokensIn")
    claude_tokens_out: Optional[int] = Field(None, alias="claudeTokensOut")
    scans_run: Optional[list[str]] = Field(None, alias="scansRun")
    records_written: Optional[int] = Field(None, alias="recordsWritten")
    error_message: Optional[str] = Field(None, alias="errorMessage", max_length=2000)
    started_at: datetime = Field(..., alias="startedAt")
    completed_at: Optional[datetime] = Field(None, alias="completedAt")


class Waiver(ATProtoRecord):
    """sh.tangled.governance.audit.waiver"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.audit.waiver"

    control: str = Field(..., description="AT-URI of the control")
    repo: str = Field(..., description="AT-URI of the repo")
    pull_request: Optional[str] = Field(None, alias="pullRequest")
    reason: str = Field(..., max_length=2000)
    granted_by: str = Field(..., alias="grantedBy")
    approved_by: Optional[str] = Field(None, alias="approvedBy")
    expires_at: datetime = Field(..., alias="expiresAt")
    status: WaiverStatus = WaiverStatus.ACTIVE
    created_at: datetime = Field(..., alias="createdAt")
