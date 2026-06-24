const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
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
  await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" });
}

// ── Organizations ───────────────────────────────────────────────────────────

export async function fetchOrgs() {
  return apiFetch<{ organizations: any[] }>("/api/org");
}

export async function fetchMembers(orgRkey: string) {
  return apiFetch<{ members: any[]; roles: any[]; teams: any[] }>(`/api/org/${orgRkey}/members`);
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

// ── Policies ────────────────────────────────────────────────────────────────

export async function fetchPolicies() {
  return apiFetch<{ policyPacks: any[] }>("/api/policies");
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
  return apiFetch<AgentRunResult>("/api/agent/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
