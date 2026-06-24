"""Base model and shared types for all governance ATProto records."""

from datetime import datetime
from enum import StrEnum
from typing import ClassVar, Optional

from pydantic import BaseModel, Field


LEXICON_VERSION = 1
NAMESPACE_PREFIX = "sh.tangled.governance"


class ATProtoRecord(BaseModel):
    """Base for all ATProto record models.

    Subclasses define the record schema. The COLLECTION class var
    maps to the ATProto collection NSID used in createRecord / listRecords.
    """

    COLLECTION: ClassVar[str] = ""

    model_config = {"populate_by_name": True, "use_enum_values": True}

    def to_record(self) -> dict:
        """Serialize to the dict format expected by com.atproto.repo.createRecord."""
        data = self.model_dump(mode="json", exclude_none=True, by_alias=True)
        data["$type"] = self.COLLECTION
        return data


# --- shared enums ---


class Severity(StrEnum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class EnforcementMode(StrEnum):
    ADVISORY = "advisory"
    SOFT = "soft"
    HARD = "hard"


class DataClassification(StrEnum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class DataType(StrEnum):
    PII = "pii"
    PHI = "phi"
    FINANCIAL = "financial"
    CREDENTIALS = "credentials"
    ML_TRAINING_DATA = "ml-training-data"
    PUBLIC_DATA = "public-data"


class Regulation(StrEnum):
    ISO_27001 = "iso-27001"
    GDPR = "gdpr"
    EU_AI_ACT = "eu-ai-act"
    SOC2 = "soc2"
    HIPAA = "hipaa"
    PCI_DSS = "pci-dss"
    CUSTOM = "custom"


class CheckType(StrEnum):
    GATE = "gate"
    SCAN = "scan"
    APPROVAL = "approval"
    ORGANIZATIONAL = "organizational"
    SYSTEM = "system"


class ScanTool(StrEnum):
    SEMGREP = "semgrep"
    GITLEAKS = "gitleaks"
    OSV_SCANNER = "osv-scanner"
    CUSTOM = "custom"


class GateStatus(StrEnum):
    PASS = "pass"
    WARNING = "warning"
    NEEDS_HUMAN_REVIEW = "needs-human-review"
    BLOCKED = "blocked"


class ControlStatus(StrEnum):
    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"
    SKIPPED = "skipped"


class ApprovalStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class IncidentCategory(StrEnum):
    DATA_LEAK = "data-leak"
    VULNERABILITY = "vulnerability"
    UNAUTHORIZED_ACCESS = "unauthorized-access"
    SUPPLY_CHAIN = "supply-chain"
    MISCONFIGURATION = "misconfiguration"
    OTHER = "other"


class IncidentStatus(StrEnum):
    OPEN = "open"
    IN_PROGRESS = "in-progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class SLAStatus(StrEnum):
    OPEN = "open"
    AT_RISK = "at-risk"
    BREACHED = "breached"
    RESOLVED = "resolved"


class DependencyType(StrEnum):
    RUNTIME = "runtime"
    BUILD = "build"
    TEST = "test"
    API = "api"
    DATA = "data"


class CodeDependencyType(StrEnum):
    API_CALL = "api-call"
    IMPORT = "import"
    SHARED_MODEL = "shared-model"
    EVENT_CONSUMER = "event-consumer"
    DATABASE_SHARED = "database-shared"
    CONFIG_REF = "config-ref"
    GRPC = "grpc"
    GRAPHQL = "graphql"


class ServiceType(StrEnum):
    DATABASE = "database"
    API = "api"
    QUEUE = "queue"
    CACHE = "cache"
    STORAGE = "storage"
    AUTH = "auth"
    OTHER = "other"


class EvidenceType(StrEnum):
    SEMGREP_REPORT = "semgrep-report"
    GITLEAKS_REPORT = "gitleaks-report"
    OSV_REPORT = "osv-report"
    CLAUDE_REASONING = "claude-reasoning"
    MANUAL_REVIEW = "manual-review"
    SCREENSHOT = "screenshot"
    LOG = "log"


class AgentRunStatus(StrEnum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMED_OUT = "timed-out"


class WaiverStatus(StrEnum):
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"


class ActionRequired(StrEnum):
    UPDATE_REQUIRED = "update-required"
    REVIEW_RECOMMENDED = "review-recommended"
    NO_ACTION = "no-action"


class PostMergeActionType(StrEnum):
    PROPAGATE_ISSUES = "propagate-issues"
    NOTIFY_OWNERS = "notify-owners"
    TRIGGER_SCAN = "trigger-scan"
    UPDATE_SLA = "update-sla"


class RoleSlug(StrEnum):
    ORG_ADMIN = "org-admin"
    REPO_ADMIN = "repo-admin"
    POLICY_AUTHOR = "policy-author"
    AUDITOR = "auditor"
    CONTRIBUTOR = "contributor"
    ISMS_MANAGER = "isms-manager"
    DPO = "dpo"
    SECURITY_LEAD = "security-lead"


class Permission(StrEnum):
    ORG_MANAGE = "org.manage"
    ORG_INVITE = "org.invite"
    REPO_CREATE = "repo.create"
    REPO_DELETE = "repo.delete"
    POLICY_AUTHOR = "policy.author"
    POLICY_BIND = "policy.bind"
    COMPLIANCE_APPROVE = "compliance.approve"
    COMPLIANCE_WAIVE = "compliance.waive"
    AUDIT_VIEW = "audit.view"
    AUDIT_EXPORT = "audit.export"


class Framework(StrEnum):
    ISO_27001 = "iso-27001"
    GDPR = "gdpr"
    EU_AI_ACT = "eu-ai-act"
    SOC2 = "soc2"
    HIPAA = "hipaa"
    PCI_DSS = "pci-dss"
    CUSTOM = "custom"
