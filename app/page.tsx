"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Shield, AlertCircle, CheckCircle2, XCircle, AlertTriangle, Clock,
  GitPullRequest, GitBranch, FolderGit2, FileText, Network,
  ArrowRight, TrendingUp, Activity, Eye,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import {
  fetchOrgs, fetchRepos, fetchIncidents, fetchPolicies,
  fetchAudit, fetchGraph, fetchRepoPulls, fetchRepoScans,
} from "@/lib/api";

function StatCard({
  value, label, sublabel, color, icon: Icon, href,
}: {
  value: number | string; label: string; sublabel?: string;
  color: string; icon: React.ElementType; href?: string;
}) {
  const inner = (
    <div className={cn(
      "border border-zinc-800 bg-zinc-900/40 p-4 transition-colors",
      href && "hover:bg-zinc-800/40 cursor-pointer"
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-3xl font-bold font-mono text-zinc-100">{value}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-[0.12em] mt-1">{label}</p>
          {sublabel && <p className="text-[10px] text-zinc-600 mt-0.5">{sublabel}</p>}
        </div>
        <Icon size={18} className={color} />
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function MiniBar({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <div className="h-2 bg-zinc-800 rounded-full" />;
  return (
    <div className="space-y-1">
      <div className="flex h-2 rounded-full overflow-hidden bg-zinc-800">
        {segments.map((seg, i) => (
          seg.value > 0 && (
            <div
              key={i}
              className={cn("h-full transition-all", seg.color)}
              style={{ width: `${(seg.value / total) * 100}%` }}
            />
          )
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        {segments.map((seg, i) => (
          <span key={i} className="flex items-center gap-1 text-[9px] text-zinc-500">
            <span className={cn("w-1.5 h-1.5 rounded-full", seg.color)} />
            {seg.label}: {seg.value}
          </span>
        ))}
      </div>
    </div>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const color = severity === "critical" ? "bg-red-500"
    : severity === "high" ? "bg-orange-500"
    : severity === "medium" ? "bg-yellow-500"
    : "bg-green-500";
  return <span className={cn("w-2 h-2 rounded-full inline-block flex-shrink-0", color)} />;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<any>(null);
  const [repos, setRepos] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [graph, setGraph] = useState<any>(null);
  const [pullCounts, setPullCounts] = useState<Record<string, { open: number; total: number }>>({});
  const [scanCounts, setScanCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.all([
      fetchOrgs(),
      fetchRepos(),
      fetchIncidents(),
      fetchPolicies(),
      fetchAudit(),
      fetchGraph(),
    ]).then(([orgsData, reposData, incData, polData, auditData, graphData]) => {
      setOrg(orgsData?.organizations?.[0] ?? { name: "Organization" });
      const r = reposData?.repos ?? [];
      setRepos(r);
      setIncidents(incData?.incidents ?? []);
      setPolicies(polData?.policyPacks ?? []);
      setAudit(auditData?.entries ?? []);
      setGraph(graphData);
      setLoading(false);

      // Fetch pull counts and scan counts per repo in parallel
      const pullPromises = r.map((repo: any) =>
        fetchRepoPulls(repo.id || repo.name).then((d) => {
          const pulls = d?.pulls || [];
          return {
            id: repo.id || repo.name,
            open: pulls.filter((p: any) => p.status === "open").length,
            total: pulls.length,
          };
        }).catch(() => ({ id: repo.id || repo.name, open: 0, total: 0 }))
      );
      const scanPromises = r.map((repo: any) =>
        fetchRepoScans(repo.id || repo.name).then((d) => ({
          id: repo.id || repo.name,
          count: d?.scans?.length ?? 0,
        })).catch(() => ({ id: repo.id || repo.name, count: 0 }))
      );

      Promise.all(pullPromises).then((results) => {
        const map: Record<string, { open: number; total: number }> = {};
        results.forEach((r) => { map[r.id] = { open: r.open, total: r.total }; });
        setPullCounts(map);
      });
      Promise.all(scanPromises).then((results) => {
        const map: Record<string, number> = {};
        results.forEach((r) => { map[r.id] = r.count; });
        setScanCounts(map);
      });
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Shell breadcrumbs={[{ label: "Dashboard" }]}>
        <div className="flex items-center justify-center h-64">
          <span className="text-zinc-500 text-sm animate-pulse">Loading dashboard...</span>
        </div>
      </Shell>
    );
  }

  // ── Derived stats ──────────────────────────────────────────────────────
  const openIncidents = incidents.filter((i: any) => i.status === "open" || i.status === "in-progress");
  const criticalIncidents = incidents.filter((i: any) => i.severity === "critical" || i.severity === "high");
  const resolvedIncidents = incidents.filter((i: any) => i.status === "resolved" || i.status === "closed");

  const totalControls = policies.reduce((sum: number, p: any) => sum + (p.controls?.length || 0), 0);
  const totalBindings = policies.reduce((sum: number, p: any) => sum + (p.bindings?.length || 0), 0);

  const repoDeps = graph?.repoDependencies?.length ?? 0;
  const codeDeps = graph?.codeDependencies?.length ?? 0;

  const totalOpenPRs = Object.values(pullCounts).reduce((s, v) => s + v.open, 0);
  const reposScanned = Object.values(scanCounts).filter((c) => c > 0).length;
  const reposUnscanned = repos.length - reposScanned;
  const totalScans = Object.values(scanCounts).reduce((s, c) => s + c, 0);

  const auditScans = audit.filter((e: any) => e.type === "scan");
  const auditPRChecks = audit.filter((e: any) => e.type === "pr-check" || e.type === "agent-run");

  // Severity breakdown
  const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  incidents.forEach((i: any) => {
    const s = i.severity as keyof typeof sevCounts;
    if (s in sevCounts) sevCounts[s]++;
  });

  // Per-repo incident counts
  const repoIncidentMap: Record<string, number> = {};
  incidents.forEach((i: any) => {
    const rkey = (i.repoName || i.repo || "").split("/").pop() || "unknown";
    repoIncidentMap[rkey] = (repoIncidentMap[rkey] || 0) + 1;
  });

  return (
    <Shell breadcrumbs={[{ label: "Dashboard" }]}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">
                {org?.name ?? org?.handle ?? "Dashboard"}
              </h1>
              <span className="text-[9px] font-mono text-zinc-600 border border-zinc-800 px-1.5 py-px">
                AT Protocol
              </span>
            </div>
            <p className="text-sm text-zinc-500">
              {org?.description ?? "Governance & compliance overview"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-zinc-600">
            <Activity size={11} />
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>

        {/* ── Top-level stats ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            value={repos.length}
            label="Repositories"
            sublabel={`${reposScanned} scanned`}
            color="text-blue-400"
            icon={FolderGit2}
            href="/repos"
          />
          <StatCard
            value={openIncidents.length}
            label="Open Incidents"
            sublabel={`${criticalIncidents.length} critical/high`}
            color="text-red-400"
            icon={AlertCircle}
            href="/issues"
          />
          <StatCard
            value={policies.length}
            label="Policy Packs"
            sublabel={`${totalControls} controls · ${totalBindings} bindings`}
            color="text-amber-400"
            icon={Shield}
            href="/policies"
          />
          <StatCard
            value={totalOpenPRs}
            label="Open PRs"
            sublabel={`across ${Object.values(pullCounts).filter(v => v.open > 0).length} repos`}
            color="text-purple-400"
            icon={GitPullRequest}
          />
        </div>

        {/* ── Compliance health + Severity breakdown ─────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Compliance score card */}
          <Card>
            <CardHeader title="Scan Coverage" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold font-mono text-zinc-100">
                    {repos.length > 0 ? Math.round((reposScanned / repos.length) * 100) : 0}%
                  </span>
                  <span className="text-xs text-zinc-500">repos scanned</span>
                </div>
                <Eye size={18} className="text-zinc-600" />
              </div>
              <MiniBar segments={[
                { value: reposScanned, color: "bg-green-500", label: "Scanned" },
                { value: reposUnscanned, color: "bg-zinc-700", label: "Not scanned" },
              ]} />
              {reposUnscanned > 0 && (
                <p className="text-[10px] text-amber-400/70">
                  {reposUnscanned} repo{reposUnscanned > 1 ? "s" : ""} never scanned by AI
                </p>
              )}
              <div className="text-[10px] text-zinc-600 pt-1 border-t border-zinc-800">
                {totalScans} total scans performed
              </div>
            </div>
          </Card>

          {/* Severity distribution */}
          <Card>
            <CardHeader title="Incident Severity" />
            <div className="space-y-3">
              {incidents.length === 0 ? (
                <div className="flex items-center gap-2 py-4">
                  <CheckCircle2 size={16} className="text-green-400" />
                  <span className="text-sm text-zinc-400">No incidents recorded</span>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {(["critical", "high", "medium", "low"] as const).map((sev) => {
                      const count = sevCounts[sev];
                      const pct = incidents.length > 0 ? (count / incidents.length) * 100 : 0;
                      const barColor = sev === "critical" ? "bg-red-500"
                        : sev === "high" ? "bg-orange-500"
                        : sev === "medium" ? "bg-yellow-500"
                        : "bg-green-500";
                      return (
                        <div key={sev} className="flex items-center gap-3">
                          <span className="text-[10px] text-zinc-500 w-14 text-right capitalize">{sev}</span>
                          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] font-mono text-zinc-400 w-6 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                  <MiniBar segments={[
                    { value: openIncidents.length, color: "bg-red-500", label: "Open" },
                    { value: resolvedIncidents.length, color: "bg-green-500", label: "Resolved" },
                  ]} />
                </>
              )}
            </div>
          </Card>

          {/* Dependency graph summary */}
          <Card>
            <CardHeader title="Dependency Graph" />
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-800/40 rounded p-3 text-center">
                  <p className="text-2xl font-bold font-mono text-cyan-400">{repoDeps}</p>
                  <p className="text-[9px] text-zinc-500 uppercase">Repo Links</p>
                </div>
                <div className="bg-zinc-800/40 rounded p-3 text-center">
                  <p className="text-2xl font-bold font-mono text-teal-400">{codeDeps}</p>
                  <p className="text-[9px] text-zinc-500 uppercase">Code Links</p>
                </div>
              </div>
              <Link
                href="/graph"
                className="flex items-center gap-1.5 text-[10px] text-blue-400 hover:text-blue-300"
              >
                <Network size={10} /> View full graph <ArrowRight size={9} />
              </Link>
            </div>
          </Card>
        </div>

        {/* ── Open incidents table ──────────────────────────────────── */}
        {openIncidents.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <AlertCircle size={12} className="text-red-400" />
                Open Incidents ({openIncidents.length})
              </h2>
              <Link href="/issues" className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                View all <ArrowRight size={9} />
              </Link>
            </div>
            <div className="border border-zinc-800 rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/60">
                    {["", "Severity", "Repo", "Description", "Status"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.12em]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {openIncidents.slice(0, 8).map((inc: any, idx: number) => (
                    <tr key={inc.id ?? idx} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-3 py-2"><SeverityDot severity={inc.severity} /></td>
                      <td className="px-3 py-2">
                        <span className={cn(
                          "font-mono text-[11px] font-semibold uppercase",
                          inc.severity === "critical" ? "text-red-400"
                          : inc.severity === "high" ? "text-orange-400"
                          : inc.severity === "medium" ? "text-amber-400"
                          : "text-green-400"
                        )}>
                          {inc.severity}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-zinc-500">{inc.repoName || "—"}</td>
                      <td className="px-3 py-2 max-w-xs">
                        <p className="text-xs text-zinc-300 line-clamp-1">
                          {inc.linkedIssue?.title || inc.description || inc.title || "—"}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={inc.status === "open" ? "danger" : inc.status === "in-progress" ? "warning" : "success"}
                          size="sm"
                        >
                          {inc.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Repository compliance matrix ─────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <FolderGit2 size={12} className="text-green-400" />
              Repository Compliance Matrix
            </h2>
            <Link href="/repos" className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
              View all <ArrowRight size={9} />
            </Link>
          </div>
          <div className="border border-zinc-800 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/60">
                  {["Repository", "Classification", "Incidents", "Open PRs", "Scans", "Status"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.12em]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {repos.map((repo: any) => {
                  const rkey = repo.id || repo.name;
                  const incCount = repoIncidentMap[rkey] || 0;
                  const prData = pullCounts[rkey] || { open: 0, total: 0 };
                  const scans = scanCounts[rkey] || 0;
                  const classification = repo.profile?.dataClassification || repo.dataClassification || "—";
                  const hasIssues = incCount > 0;
                  const isScanned = scans > 0;

                  return (
                    <tr key={rkey} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-3 py-2.5">
                        <Link href={`/repos/${rkey}`} className="font-mono text-xs text-blue-400 hover:text-blue-300">
                          {repo.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-[11px] text-zinc-400 capitalize">{classification}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        {incCount > 0 ? (
                          <span className="font-mono text-[11px] text-red-400 font-semibold">{incCount}</span>
                        ) : (
                          <span className="text-[11px] text-zinc-700">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {prData.open > 0 ? (
                          <span className="font-mono text-[11px] text-purple-400">{prData.open}</span>
                        ) : (
                          <span className="text-[11px] text-zinc-700">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {scans > 0 ? (
                          <span className="font-mono text-[11px] text-green-400">{scans}</span>
                        ) : (
                          <span className="text-[11px] text-amber-400/70">none</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {!isScanned ? (
                          <Badge variant="warning" size="sm">unscanned</Badge>
                        ) : hasIssues ? (
                          <Badge variant="danger" size="sm">issues</Badge>
                        ) : (
                          <Badge variant="success" size="sm">clean</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Policy packs + Recent activity ───────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Policy packs summary */}
          <Card>
            <CardHeader title="Policy Packs" />
            <div className="space-y-2">
              {policies.length === 0 ? (
                <p className="text-xs text-zinc-600 py-2">No policy packs configured</p>
              ) : (
                policies.map((pack: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Shield size={12} className="text-amber-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-200 truncate">{pack.name}</p>
                        <p className="text-[9px] text-zinc-600">{pack.framework || "custom"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-zinc-500">
                        {pack.controls?.length || 0} controls
                      </span>
                      <span className="text-[10px] font-mono text-zinc-600">
                        {pack.bindings?.length || 0} bound
                      </span>
                    </div>
                  </div>
                ))
              )}
              <Link href="/policies" className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 pt-1">
                Manage policies <ArrowRight size={9} />
              </Link>
            </div>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader title="Recent Activity" />
            <div className="space-y-1">
              {audit.length === 0 ? (
                <p className="text-xs text-zinc-600 py-2">No audit activity yet</p>
              ) : (
                audit.slice(0, 8).map((entry: any, i: number) => {
                  const typeIcon = entry.type === "scan" ? (
                    <Eye size={11} className="text-purple-400" />
                  ) : entry.type === "incident" ? (
                    <AlertCircle size={11} className="text-red-400" />
                  ) : entry.type === "policy" ? (
                    <Shield size={11} className="text-amber-400" />
                  ) : (
                    <FileText size={11} className="text-zinc-500" />
                  );
                  return (
                    <div key={i} className="flex items-start gap-2 py-1.5 border-b border-zinc-800/30 last:border-0">
                      <div className="mt-0.5">{typeIcon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-zinc-300 line-clamp-1">{entry.description || entry.action || entry.type}</p>
                        <p className="text-[9px] text-zinc-600">
                          {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ""}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <Link href="/audit" className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 pt-1">
                Full audit log <ArrowRight size={9} />
              </Link>
            </div>
          </Card>
        </div>

        {/* ── Quick links footer ───────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {[
            { href: "/repos", label: "Repositories", icon: FolderGit2, desc: `${repos.length} governed` },
            { href: "/graph", label: "Dependency Map", icon: Network, desc: `${repoDeps + codeDeps} links` },
            { href: "/policies", label: "Policies", icon: Shield, desc: `${totalControls} controls` },
            { href: "/audit", label: "Audit Log", icon: FileText, desc: `${audit.length} entries` },
          ].map((link) => (
            <Link key={link.href} href={link.href}>
              <div className="border border-zinc-800 rounded p-3 hover:bg-zinc-800/40 transition-colors flex items-center gap-3">
                <link.icon size={16} className="text-zinc-500" />
                <div>
                  <p className="text-xs text-zinc-300">{link.label}</p>
                  <p className="text-[9px] text-zinc-600">{link.desc}</p>
                </div>
                <ArrowRight size={11} className="text-zinc-700 ml-auto" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Shell>
  );
}
