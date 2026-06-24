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

// Auth

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
    credentials: "include",
  });
}

// Organizations

export async function fetchOrgs() {
  return apiFetch<{ organizations: any[] }>("/api/org");
}

export async function fetchMembers(orgRkey: string) {
  return apiFetch<{ members: any[]; roles: any[] }>(`/api/org/${orgRkey}/members`);
}

// Repos

export async function fetchRepos() {
  return apiFetch<{ repos: any[] }>("/api/repos");
}

export async function fetchRepoProfile(rkey: string) {
  return apiFetch<{ profile: any; uri: string }>(`/api/repos/${rkey}/profile`);
}

// Policies

export async function fetchPolicies() {
  return apiFetch<{ policyPacks: any[] }>("/api/policies");
}

// Audit

export async function fetchAudit() {
  return apiFetch<{ entries: any[] }>("/api/audit");
}

// Dependency Graph

export async function fetchGraph() {
  return apiFetch<{
    repoDependencies: any[];
    codeDependencies: any[];
    serviceDependencies: any[];
  }>("/api/graph");
}

// Incidents

export async function fetchIncidents() {
  return apiFetch<{ incidents: any[] }>("/api/incidents");
}
