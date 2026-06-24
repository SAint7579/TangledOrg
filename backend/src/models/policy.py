"""Policy definition records: packs, controls, bindings, SLA rules."""

from datetime import datetime
from typing import ClassVar, Optional

from pydantic import Field

from src.models.base import (
    ATProtoRecord,
    NAMESPACE_PREFIX,
    CheckType,
    EnforcementMode,
    Framework,
    ScanTool,
    Severity,
)


class PolicyPack(ATProtoRecord):
    """sh.tangled.governance.policy.policyPack"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.policy.policyPack"

    org: str = Field(..., description="AT-URI of the organization")
    name: str = Field(..., max_length=100)
    display_name: Optional[str] = Field(None, alias="displayName", max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    framework: Optional[Framework] = None
    version: str = Field(..., max_length=20)
    is_starter: Optional[bool] = Field(None, alias="isStarter")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")


class Control(ATProtoRecord):
    """sh.tangled.governance.policy.control"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.policy.control"

    policy_pack: str = Field(..., alias="policyPack")
    control_id: str = Field(..., alias="controlId", max_length=20)
    name: str = Field(..., max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    iso_reference: Optional[str] = Field(None, alias="isoReference")
    check_type: CheckType = Field(..., alias="checkType")
    enforcement: EnforcementMode
    scan_tool: Optional[ScanTool] = Field(None, alias="scanTool")
    required_approver_role: Optional[str] = Field(None, alias="requiredApproverRole")
    severity_threshold: Optional[Severity] = Field(None, alias="severityThreshold")
    auto_remediation: Optional[str] = Field(None, alias="autoRemediation")


class RepoBinding(ATProtoRecord):
    """sh.tangled.governance.policy.repoBinding"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.policy.repoBinding"

    repo: str = Field(..., description="AT-URI of the repo")
    policy_pack: str = Field(..., alias="policyPack")
    enforcement_override: Optional[EnforcementMode] = Field(
        None, alias="enforcementOverride"
    )
    enabled_controls: Optional[list[str]] = Field(None, alias="enabledControls")
    disabled_controls: Optional[list[str]] = Field(None, alias="disabledControls")
    bound_by: Optional[str] = Field(None, alias="boundBy")
    created_at: datetime = Field(..., alias="createdAt")


class SLARule(ATProtoRecord):
    """sh.tangled.governance.policy.slaRule"""

    COLLECTION: ClassVar[str] = f"{NAMESPACE_PREFIX}.policy.slaRule"

    policy_pack: str = Field(..., alias="policyPack")
    severity: Severity
    max_resolution_hours: int = Field(..., alias="maxResolutionHours")
    required_approver_role: Optional[str] = Field(None, alias="requiredApproverRole")
    escalation_after_hours: Optional[int] = Field(None, alias="escalationAfterHours")
    escalation_target: Optional[str] = Field(None, alias="escalationTarget")
