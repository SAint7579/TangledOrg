const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const SESSION_KEY = "tangled_session";

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_KEY, token);
}

export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_KEY);
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getSessionToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: authHeaders(),
      ...options,
    });
    if (res.status === 401) return null;
    if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
    return res.json();
  } catch {
    return null;
  }
}

async function apiPost<T>(path: string, body: unknown): Promise<T | null> {
  return apiFetch<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Auth ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  did: string;
  handle: string;
  pds: string;
}

export async function fetchMe(): Promise<AuthUser | null> {
  return apiFetch<AuthUser>("/auth/me");
}

export function getLoginUrl(handle: string): string {
  return `${API_URL}/auth/login?handle=${encodeURIComponent(handle)}`;
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: authHeaders(),
  });
  clearSessionToken();
}

// ── Organizations ───────────────────────────────────────────────────────────

export async function fetchOrgs() {
  return apiFetch<{ organizations: any[] }>("/api/org");
}

export async function fetchMembers(orgRkey: string) {
  return apiFetch<{ members: any[]; roles: any[]; teams: any[] }>(`/api/org/${orgRkey}/members`);
}

export async function addMember(body: {
  handle: string; orgUri: string; roleUri?: string;
}) {
  return apiPost<{ membership: any; did: string; handle: string }>("/api/org/members", body);
}

// ── Repos ───────────────────────────────────────────────────────────────────

export async function fetchRepos() {
  return apiFetch<{ repos: any[] }>("/api/repos");
}

export async function fetchRepoProfile(rkey: string) {
  return apiFetch<{ profile: any; uri: string; rkey: string }>(`/api/repos/${rkey}/profile`);
}

export async function createRepoProfile(rkey: string, body: {
  repoUri: string; orgUri: string; dataClassification: string;
  handlesData?: string[]; applicableRegulations?: string[];
  riskTier?: string; enforcementMode?: string; description?: string;
}) {
  return apiPost(`/api/repos/${rkey}/profile`, body);
}

export async function fetchRepoIssues(rkey: string) {
  return apiFetch<{
    issues: {
      id: string; uri: string; title: string; body: string;
      state: "open" | "closed"; createdAt: string;
      mentions: string[]; references: string[];
    }[];
  }>(`/api/repos/${rkey}/issues`);
}

export async function fetchRepoPulls(rkey: string) {
  return apiFetch<{
    pulls: {
      id: string; uri: string; title: string; body: string;
      status: "open" | "closed" | "merged"; createdAt: string;
      sourceBranch: string; targetBranch: string; rounds: unknown[];
    }[];
  }>(`/api/repos/${rkey}/pulls`);
}

// ── PR Assessment ────────────────────────────────────────────────────────────

export interface PRAssessmentData {
  id: string;
  uri: string;
  riskLevel: string;
  summary: string;
  changedFiles: number;
  controlsPassed: number;
  controlsFailed: number;
  controlsWarning: number;
  createdAt: string;
}

export interface PRGateData {
  status: string;
  reason: string;
  blockedControls: string[];
}

export interface PRControlEval {
  id: string;
  control: string;
  status: string;
  reason: string;
}

export interface PRAffectedEdge {
  downstreamRepo: string;
  downstreamPath: string;
  reason: string;
  actionRequired: string;
}

export interface PRImpactData {
  riskLevel: string;
  summary: string;
  affectedEdges: PRAffectedEdge[];
}

export interface PRAssessmentResponse {
  assessment: PRAssessmentData | null;
  gate: PRGateData | null;
  controlEvaluations: PRControlEval[];
  impact: PRImpactData | null;
}

export async function fetchPRAssessment(repoRkey: string, pullRkey: string) {
  return apiFetch<PRAssessmentResponse>(`/api/repos/${repoRkey}/pulls/${pullRkey}/assessment`);
}

export async function closePullRequest(repoRkey: string, pullRkey: string) {
  return apiPost<{ status: string; pullRkey: string }>(
    `/api/repos/${repoRkey}/pulls/${pullRkey}/close`, {}
  );
}

export async function mergePullRequest(repoRkey: string, pullRkey: string) {
  return apiPost<{
    status: string;
    pullRkey: string;
    knotMerged: boolean;
    knotError: string | null;
    materializedRecords: number;
  }>(
    `/api/repos/${repoRkey}/pulls/${pullRkey}/merge`, {}
  );
}

// ── Branches ─────────────────────────────────────────────────────────────────

export interface Branch {
  name: string;
  hash: string;
  isDefault?: boolean;
}

export async function fetchRepoBranches(rkey: string) {
  return apiFetch<{ branches: Branch[] }>(`/api/repos/${rkey}/branches`);
}

// ── Create PR ────────────────────────────────────────────────────────────────

export async function createPullRequest(rkey: string, body: {
  title: string;
  body?: string;
  sourceBranch: string;
  targetBranch?: string;
}) {
  return apiPost<{
    uri: string;
    rkey: string;
    title: string;
    sourceBranch: string;
    targetBranch: string;
    status: string;
    compliance: {
      gate_status?: string;
      gate_reason?: string;
      risk_level?: string;
      summary?: string;
      records_written?: number;
      pr_assessment_uri?: string;
      error?: string;
    } | null;
  }>(`/api/repos/${rkey}/pulls`, body);
}

export async function fetchRepoTree(rkey: string, ref = "main", path = "") {
  const params = new URLSearchParams({ ref });
  if (path) params.set("path", path);
  return apiFetch<Record<string, unknown>>(`/api/repos/${rkey}/tree?${params}`);
}

export async function fetchRepoLog(rkey: string, ref = "main", limit = 20) {
  const params = new URLSearchParams({ ref, limit: String(limit) });
  return apiFetch<Record<string, unknown>>(`/api/repos/${rkey}/log?${params}`);
}

// ── Policies ────────────────────────────────────────────────────────────────

export async function fetchPolicies() {
  return apiFetch<{ policyPacks: any[] }>("/api/policies");
}

export async function createPolicyPack(body: {
  orgUri: string; name: string; description?: string;
  framework?: string; version?: string;
  controls?: { controlId: string; name: string; description?: string;
    checkType?: string; enforcement?: string; severity?: string;
    scanTool?: string; isoReference?: string; }[];
}) {
  return apiPost("/api/policies", body);
}

export async function createPolicyBinding(body: {
  repoUri: string; policyPackUri: string; enforcementOverride?: string;
}) {
  return apiPost("/api/policies/bind", body);
}

// ── Incidents ───────────────────────────────────────────────────────────────

export async function fetchIncidents() {
  return apiFetch<{ incidents: any[] }>("/api/incidents");
}

export async function createIncident(body: {
  title: string; description: string; repoUri: string;
  orgUri?: string; severity: string; category: string;
  affectedPackage?: string; cveIds?: string[]; linkedPR?: string;
}) {
  return apiPost("/api/incidents", body);
}

// ── Audit ───────────────────────────────────────────────────────────────────

export async function fetchAudit() {
  return apiFetch<{ entries: any[] }>("/api/audit");
}

// ── Dependency Graph ────────────────────────────────────────────────────────

export async function fetchGraph() {
  return apiFetch<{
    repos: any[];
    repoDependencies: any[];
    codeDependencies: any[];
    serviceDependencies: any[];
  }>("/api/graph");
}

export async function createRepoDependency(body: {
  sourceRepo: string; targetRepo: string;
  dependencyType: string; description?: string;
}) {
  return apiPost("/api/graph/repo-dependency", body);
}

export async function createCodeDependency(body: {
  sourceRepo: string; sourcePath: string; sourceLabel?: string;
  targetRepo: string; targetPath: string; targetLabel?: string;
  dependencyType: string; description?: string;
}) {
  return apiPost("/api/graph/code-dependency", body);
}

export async function deleteGraphEdge(collection: string, rkey: string) {
  return apiPost("/api/graph/delete", { collection, rkey });
}

// Agent

export interface AgentRunRequest {
  pr_uri: string;
  repo_uri: string;
  repo_clone_url: string;
  pr_branch: string;
  base_branch?: string;
}

export interface AgentRunResult {
  gate_status: string;
  gate_reason: string;
  risk_level: string;
  summary: string;
  records_written: number;
  agent_run_uri: string;
  pr_assessment_uri: string;
  error: string | null;
}

export async function runAgent(payload: AgentRunRequest): Promise<AgentRunResult | null> {
  return apiPost<AgentRunResult>("/api/agent/run", payload);
}

// ── Scan History ─────────────────────────────────────────────────────────────

export interface ScanHistoryItem {
  id: string;
  uri: string;
  riskLevel: string;
  summary: string;
  policyPack: string;
  filesScanned: number;
  controlsPassed: number;
  controlsFailed: number;
  controlsWarning: number;
  findingsCount: number;
  findings: ScanFinding[];
  issuesCreated: number;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
}

export async function fetchRepoScans(rkey: string): Promise<{ scans: ScanHistoryItem[] } | null> {
  return apiFetch<{ scans: ScanHistoryItem[] }>(`/api/repos/${rkey}/scans`);
}

// ── Agent Scan ───────────────────────────────────────────────────────────────

export interface ScanFinding {
  file: string;
  line?: number;
  severity: string;
  control_id: string;
  control_name: string;
  title: string;
  description: string;
  category: string;
}

export interface ScanResult {
  repo: string;
  risk_level: string;
  summary: string;
  policy_pack: string;
  files_scanned: number;
  controls_passed: number;
  controls_failed: number;
  controls_warning: number;
  findings: ScanFinding[];
  issues_created: { uri: string; title: string; severity: string; file: string }[];
  incidents_created: { uri: string; issue_uri: string; severity: string }[];
  duration_ms: number;
  error: string | null;
}

export async function runScan(repoRkey: string): Promise<ScanResult | null> {
  return apiPost<ScanResult>("/api/agent/scan", { repo_rkey: repoRkey });
}

// ── Agent Chat ───────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "human" | "assistant";
  content: string;
}

export async function agentChat(
  message: string,
  history: ChatMessage[] = []
): Promise<{ response: string } | null> {
  return apiPost<{ response: string }>("/api/agent/chat", { message, history });
}
