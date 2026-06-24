// ─── Organization ───────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  did: string;
  handle: string;
  name: string;
  description: string;
  avatarUrl?: string;
  createdAt: string;
  stats: {
    repos: number;
    members: number;
    teams: number;
    openPRs: number;
  };
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  description: string;
  memberCount: number;
  repoCount: number;
  members: string[]; // member ids
  repos: string[]; // repo ids
}

export type MemberRole = "owner" | "admin" | "maintainer" | "developer" | "viewer" | "isms-manager" | "dpo" | "security-lead";

export interface Member {
  id: string;
  did: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  role: MemberRole;
  teams: string[]; // team ids
  lastActive: string;
  approvalCount: number;
}

export type RoleName = "Code Owner" | "Security Reviewer" | "Compliance Officer" | "Developer" | "Admin" | "Viewer";

export interface Role {
  id: string;
  name: RoleName;
  permissions: string[];
  description: string;
}

// ─── Repositories ───────────────────────────────────────────────────────────

export type ComplianceStatus = "compliant" | "at-risk" | "non-compliant" | "unknown";
export type RiskTier = "critical" | "high" | "medium" | "low";
export type DataClassification = "public" | "internal" | "confidential" | "restricted";
export type Language = "TypeScript" | "Python" | "Go" | "Rust" | "Java" | "Solidity" | "Shell";

export interface CodeOwner {
  pattern: string;
  owners: string[]; // member handles
  teamOwners: string[]; // team slugs
}

export interface Repo {
  id: string;
  did: string;
  name: string;
  slug: string;
  description: string;
  language: Language;
  complianceStatus: ComplianceStatus;
  riskTier: RiskTier;
  dataClassification: DataClassification;
  stars: number;
  forks: number;
  openPRs: number;
  lastActivity: string;
  policyPacks: string[]; // policy pack ids
  codeOwners: CodeOwner[];
  regulations: string[];
  teamId: string;
}

// ─── Pull Requests ───────────────────────────────────────────────────────────

export type PRStatus = "open" | "merged" | "closed" | "draft";

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  description: string;
  repoId: string;
  repoSlug: string;
  authorId: string;
  authorHandle: string;
  baseBranch: string;
  headBranch: string;
  status: PRStatus;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  labels: string[];
  assessment?: PRAssessment;
}

// ─── Compliance Assessment ───────────────────────────────────────────────────

export type MergeGateStatus = "pass" | "warning" | "needs-human-review" | "blocked";
export type ControlStatus = "pass" | "fail" | "warning" | "skipped" | "manual-required";
export type ControlSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface ControlEvaluation {
  id: string;
  controlId: string;
  controlName: string;
  policyPack: string;
  severity: ControlSeverity;
  status: ControlStatus;
  detail: string;
  automatedCheck: boolean;
  evidence?: string;
}

export interface RequiredApproval {
  id: string;
  approverHandle?: string;
  approverDid?: string;
  teamSlug?: string;
  reason: string;
  obtained: boolean;
  obtainedAt?: string;
}

export interface SASTFinding {
  rule: string;
  severity: "critical" | "high" | "medium" | "low";
  file: string;
  line: number;
  message: string;
}

export interface OSVVuln {
  id: string;
  package: string;
  severity: "critical" | "high" | "medium" | "low";
  fixedIn?: string;
}

export interface Evidence {
  sast: {
    tool: string;
    findings: SASTFinding[];
    totalCount: number;
    runAt: string;
  };
  secrets: {
    tool: string;
    clean: boolean;
    findings: number;
    runAt: string;
  };
  deps: {
    tool: string;
    vulns: OSVVuln[];
    totalVulns: number;
    runAt: string;
  };
  aiReasoning: {
    model: string;
    summary: string;
    riskFactors: string[];
    runAt: string;
  };
}

export interface PRAssessment {
  id: string;
  prId: string;
  assessedAt: string;
  assessedBy: string; // DID of agent
  mergeGate: MergeGateStatus;
  riskTier: RiskTier;
  riskSummary: string;
  complianceScore: number;
  controlEvaluations: ControlEvaluation[];
  requiredApprovals: RequiredApproval[];
  evidence: Evidence;
  impactAssessment?: ImpactAssessment;
  agentRun?: AgentRunMeta;
}

// ─── Merge Gate ───────────────────────────────────────────────────────────────

export interface MergeGate {
  status: MergeGateStatus;
  reason: string;
  blockedBy?: string[];
  approvals: {
    required: number;
    obtained: number;
  };
}

// ─── Policy Packs ────────────────────────────────────────────────────────────

export type PolicyFramework = "ISO 27001" | "GDPR" | "EU AI Act" | "SOC 2" | "HIPAA" | "Custom";

export interface Control {
  id: string;
  name: string;
  description: string;
  severity: ControlSeverity;
  automated: boolean;
  policyPackId: string;
  category: string;
  reference?: string;
}

export interface PolicyPack {
  id: string;
  name: string;
  framework: PolicyFramework;
  version: string;
  description: string;
  controlCount: number;
  repoCount: number;
  controls: Control[];
  createdAt: string;
  updatedAt: string;
}

export interface RepoBinding {
  id: string;
  repoId: string;
  repoSlug: string;
  policyPackId: string;
  policyPackName: string;
  boundAt: string;
  boundBy: string;
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

export type AuditEntryType = "assessment" | "waiver" | "evidence" | "agent-run" | "policy-change" | "member-action" | "merge-gate";

export interface AuditEntry {
  id: string;
  type: AuditEntryType;
  description: string;
  actorHandle: string;
  actorDid: string;
  targetType: "repo" | "pr" | "policy" | "member" | "org";
  targetId: string;
  targetLabel: string;
  metadata: Record<string, string | number | boolean>;
  createdAt: string;
}

// ─── SLA & Incidents ────────────────────────────────────────────────────────

export type SLAStatus = "open" | "at-risk" | "breached" | "resolved";

export type IncidentCategory = "data-leak" | "vulnerability" | "unauthorized-access" | "supply-chain" | "misconfiguration" | "other";

export interface Incident {
  id: string;
  did: string; // AT-URI
  issueNumber: number;
  title: string;
  repoId: string;
  repoSlug: string;
  severity: RiskTier; // critical | high | medium | low
  category: IncidentCategory;
  affectedPackage?: string;
  cveIds: string[];
  description: string;
  linkedPRId?: string;
  status: "open" | "in-progress" | "resolved" | "closed";
  sla: {
    status: SLAStatus;
    deadline: string; // ISO datetime
    hoursRemaining: number;
    maxResolutionHours: number;
    escalationAfterHours: number;
    resolvedAt?: string;
    resolvedBy?: string;
  };
  createdAt: string;
}

// ─── Impact Assessment ────────────────────────────────────────────────────────

export interface ImpactEdge {
  downstreamRepoSlug: string;
  downstreamRepoName: string;
  sourcePath: string;
  targetPath: string;
  dependencyType: "api-call" | "import" | "shared-model" | "event-consumer" | "database-shared";
  reason: string;
  actionRequired: "update-required" | "review-recommended" | "no-action";
}

export interface ImpactAssessment {
  prId: string;
  riskLevel: RiskTier;
  summary: string;
  affectedEdges: ImpactEdge[];
}

// ─── Agent Run Metadata ───────────────────────────────────────────────────────

export interface AgentRunMeta {
  version: string;
  durationMs: number;
  claudeTokensIn: number;
  claudeTokensOut: number;
  scansRun: string[];
  recordsWritten: number;
  startedAt: string;
  completedAt: string;
}

// ─── Dependency Graph ────────────────────────────────────────────────────────

export interface DependencyNode {
  id: string;
  repoId: string;
  repoSlug: string;
  label: string;
  complianceStatus: ComplianceStatus;
  riskTier: RiskTier;
  x: number;
  y: number;
  critical: boolean;
}

export interface DependencyEdge {
  id: string;
  source: string; // node id
  target: string; // node id
  type: "depends-on" | "owned-by" | "integrates-with";
  critical: boolean;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}
