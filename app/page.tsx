"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Shield, AlertCircle, CheckCircle2, XCircle, AlertTriangle,
  GitPullRequest, FolderGit2, FileText, Network,
  ArrowRight, Activity, Eye, GitMerge,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { fetchOrgs, fetchDashboard, fetchIncidents } from "@/lib/api";
import type { DashboardData } from "@/lib/api";

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
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [incidents, setIncidents] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetchOrgs(),
      fetchDashboard(),
      fetchIncidents(),
    ]).then(([orgsData, dashData, incData]) => {
      setOrg(orgsData?.organizations?.[0] ?? { name: "Organization" });
      setDash(dashData);
      setIncidents(incData?.incidents ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading || !dash) {
    return (
      <Shell breadcrumbs={[{ label: "Dashboard" }]}>
        <div className="flex items-center justify-center h-64">
          <span className="text-zinc-500 text-sm animate-pulse">Loading dashboard...</span>
        </div>
      </Shell>
    );
  }

  const openIncidents = incidents.filter((i: any) => i.status === "open" || i.status === "in-progress");
  const criticalCount = dash.incidents.severity.critical + dash.incidents.severity.high;
  const reposUnscanned = dash.repoCount - dash.scans.reposScanned;

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
            value={dash.repoCount}
            label="Repositories"
            sublabel={`${dash.scans.reposScanned} scanned`}
            color="text-blue-400"
            icon={FolderGit2}
            href="/repos"
          />
          <StatCard
            value={dash.incidents.open}
            label="Open Incidents"
            sublabel={`${criticalCount} critical/high`}
            color="text-red-400"
            icon={AlertCircle}
            href="/issues"
          />
          <StatCard
            value={dash.policies.count}
            label="Policy Packs"
            sublabel={`${dash.policies.totalControls} controls · ${dash.policies.totalBindings} bindings`}
            color="text-amber-400"
            icon={Shield}
            href="/policies"
          />
          <StatCard
            value={dash.pulls.totalOpen}
            label="Open PRs"
            sublabel={`across ${dash.repoStats.filter(r => r.openPulls > 0).length} repos`}
            color="text-purple-400"
            icon={GitPullRequest}
          />
        </div>

        {/* ── Compliance health + Severity breakdown ─────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Scan coverage */}
          <Card>
            <CardHeader title="Scan Coverage" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold font-mono text-zinc-100">
                    {dash.repoCount > 0 ? Math.round((dash.scans.reposScanned / dash.repoCount) * 100) : 0}%
                  </span>
                  <span className="text-xs text-zinc-500">repos scanned</span>
                </div>
                <Eye size={18} className="text-zinc-600" />
              </div>
              <MiniBar segments={[
                { value: dash.scans.reposScanned, color: "bg-green-500", label: "Scanned" },
                { value: reposUnscanned, color: "bg-zinc-700", label: "Not scanned" },
              ]} />
              {reposUnscanned > 0 && (
                <p className="text-[10px] text-amber-400/70">
                  {reposUnscanned} repo{reposUnscanned > 1 ? "s" : ""} never scanned by AI
                </p>
              )}
              <div className="text-[10px] text-zinc-600 pt-1 border-t border-zinc-800">
                {dash.scans.total} total scans performed
              </div>
            </div>
          </Card>

          {/* Severity distribution */}
          <Card>
            <CardHeader title="Incident Severity" />
            <div className="space-y-3">
              {dash.incidents.total === 0 ? (
                <div className="flex items-center gap-2 py-4">
                  <CheckCircle2 size={16} className="text-green-400" />
                  <span className="text-sm text-zinc-400">No incidents recorded</span>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {(["critical", "high", "medium", "low"] as const).map((sev) => {
                      const count = dash.incidents.severity[sev];
                      const pct = dash.incidents.total > 0 ? (count / dash.incidents.total) * 100 : 0;
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
                    { value: dash.incidents.open, color: "bg-red-500", label: "Open" },
                    { value: dash.incidents.resolved, color: "bg-green-500", label: "Resolved" },
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
                  <p className="text-2xl font-bold font-mono text-cyan-400">{dash.graph.repoDeps}</p>
                  <p className="text-[9px] text-zinc-500 uppercase">Repo Links</p>
                </div>
                <div className="bg-zinc-800/40 rounded p-3 text-center">
                  <p className="text-2xl font-bold font-mono text-teal-400">{dash.graph.codeDeps}</p>
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
                    {["", "Severity", "Repo", "Description", "Assigned To", "Status"].map((h) => (
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
                      <td className="px-3 py-2 whitespace-nowrap">
                        {inc.assignedTo ? (
                          <span className="font-mono text-[11px] text-zinc-400">
                            {inc.assignedTo.split(".")[0]}
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-700">—</span>
                        )}
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
                  {["Repository", "Incidents", "Open PRs", "Scans", "Status"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.12em]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {dash.repoStats.map((repo) => (
                  <tr key={repo.rkey} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-3 py-2.5">
                      <Link href={`/repos/${repo.rkey}`} className="font-mono text-xs text-blue-400 hover:text-blue-300">
                        {repo.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      {repo.incidentCount > 0 ? (
                        <span className="font-mono text-[11px] text-red-400 font-semibold">{repo.incidentCount}</span>
                      ) : (
                        <span className="text-[11px] text-zinc-700">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {repo.openPulls > 0 ? (
                        <span className="font-mono text-[11px] text-purple-400">{repo.openPulls}</span>
                      ) : (
                        <span className="text-[11px] text-zinc-700">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {repo.scanCount > 0 ? (
                        <span className="font-mono text-[11px] text-green-400">{repo.scanCount}</span>
                      ) : (
                        <span className="text-[11px] text-amber-400/70">none</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {repo.scanCount === 0 ? (
                        <Badge variant="warning" size="sm">unscanned</Badge>
                      ) : repo.incidentCount > 0 ? (
                        <Badge variant="danger" size="sm">issues</Badge>
                      ) : (
                        <Badge variant="success" size="sm">clean</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Quick links footer ───────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {[
            { href: "/repos", label: "Repositories", icon: FolderGit2, desc: `${dash.repoCount} governed` },
            { href: "/graph", label: "Dependency Map", icon: Network, desc: `${dash.graph.repoDeps + dash.graph.codeDeps} links` },
            { href: "/policies", label: "Policies", icon: Shield, desc: `${dash.policies.totalControls} controls` },
            { href: "/audit", label: "Audit Log", icon: FileText, desc: "View activity" },
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
