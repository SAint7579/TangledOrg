"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertOctagon, GitPullRequest } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { mockIncidents } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { SLAStatus, IncidentCategory, RiskTier } from "@/types";

type FilterTab = "all" | "open" | "at-risk" | "breached" | "resolved";

function severityBadgeClass(severity: RiskTier): string {
  switch (severity) {
    case "critical": return "bg-red-500/10 text-red-400 border-red-500/20";
    case "high": return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    case "medium": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "low": return "bg-green-500/10 text-green-400 border-green-500/20";
  }
}

function severityIdColor(severity: RiskTier): string {
  switch (severity) {
    case "critical": return "text-red-400";
    case "high": return "text-orange-400";
    case "medium": return "text-amber-400";
    case "low": return "text-green-400";
  }
}

function categoryBadgeClass(category: IncidentCategory): string {
  switch (category) {
    case "data-leak": return "bg-red-500/10 text-red-400 border-red-500/20";
    case "vulnerability": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "supply-chain": return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    case "unauthorized-access": return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    case "misconfiguration": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "other": return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  }
}

function SLABadge({ status, hoursRemaining }: { status: SLAStatus; hoursRemaining: number }) {
  if (status === "breached") {
    return <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">OVERDUE</span>;
  }
  if (status === "at-risk") {
    const display = hoursRemaining >= 24 ? `${Math.ceil(hoursRemaining / 24)}d left ⚠` : `${hoursRemaining}h left ⚠`;
    return <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">{display}</span>;
  }
  if (status === "resolved") {
    return <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">resolved</span>;
  }
  const display = hoursRemaining >= 24 ? `${Math.ceil(hoursRemaining / 24)}d left` : `${hoursRemaining}h left`;
  return <span className="text-[10px] text-zinc-400 font-mono">{display}</span>;
}

export default function IncidentsPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const filtered = mockIncidents.filter((incident) => {
    if (activeTab === "all") return true;
    if (activeTab === "open") return incident.status === "open" || incident.status === "in-progress";
    if (activeTab === "at-risk") return incident.sla.status === "at-risk";
    if (activeTab === "breached") return incident.sla.status === "breached";
    if (activeTab === "resolved") return incident.status === "resolved" || incident.status === "closed";
    return true;
  });

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "open", label: "Open" },
    { id: "at-risk", label: "At Risk" },
    { id: "breached", label: "Breached" },
    { id: "resolved", label: "Resolved" },
  ];

  const atRiskCount = mockIncidents.filter((i) => i.sla.status === "at-risk").length;
  const breachedCount = mockIncidents.filter((i) => i.sla.status === "breached").length;

  return (
    <Shell breadcrumbs={[{ label: "Incidents" }]}>
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertOctagon size={20} className="text-orange-400" />
            <h1 className="text-xl font-bold text-zinc-100">Incidents</h1>
            <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono">
              {mockIncidents.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {atRiskCount > 0 && (
              <Badge variant="warning" size="sm">{atRiskCount} at risk</Badge>
            )}
            {breachedCount > 0 && (
              <Badge variant="danger" size="sm">{breachedCount} breached</Badge>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0 border-b border-zinc-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab.id
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Incidents table */}
        <Card padding={false}>
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-zinc-500 text-sm">
              No incidents match this filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/60">
                    <th className="text-left px-4 py-3 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">ID</th>
                    <th className="text-left px-4 py-3 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Repo</th>
                    <th className="text-left px-4 py-3 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Category</th>
                    <th className="text-left px-4 py-3 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Severity</th>
                    <th className="text-left px-4 py-3 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Affected Package</th>
                    <th className="text-left px-4 py-3 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">SLA Status</th>
                    <th className="text-left px-4 py-3 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Remaining</th>
                    <th className="text-left px-4 py-3 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Linked PR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/30">
                  {filtered.map((incident) => (
                    <tr
                      key={incident.id}
                      className="hover:bg-zinc-800/20 transition-colors cursor-pointer group"
                      onClick={() => window.location.href = `/incidents/${incident.id}`}
                    >
                      <td className="px-4 py-3">
                        <span className={cn("font-mono text-xs font-semibold", severityIdColor(incident.severity))}>
                          {incident.id}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/repos/${incident.repoSlug}`}
                          className="text-xs font-mono text-blue-400 hover:text-blue-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {incident.repoSlug}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border capitalize", categoryBadgeClass(incident.category))}>
                          {incident.category.replace("-", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border capitalize font-semibold", severityBadgeClass(incident.severity))}>
                          {incident.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {incident.affectedPackage ? (
                          <code className="text-[10px] font-mono text-zinc-300 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                            {incident.affectedPackage}
                          </code>
                        ) : (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {incident.sla.status === "open" && (
                          <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">open</span>
                        )}
                        {incident.sla.status === "at-risk" && (
                          <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded font-semibold">at-risk ⚠</span>
                        )}
                        {incident.sla.status === "breached" && (
                          <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded font-semibold">BREACHED</span>
                        )}
                        {incident.sla.status === "resolved" && (
                          <span className="text-[10px] text-zinc-400 bg-zinc-500/10 border border-zinc-500/20 px-1.5 py-0.5 rounded">resolved</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <SLABadge status={incident.sla.status} hoursRemaining={incident.sla.hoursRemaining} />
                      </td>
                      <td className="px-4 py-3">
                        {incident.linkedPRId ? (
                          <Link
                            href={`/repos/${incident.repoSlug}/pr/${incident.linkedPRId}`}
                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <GitPullRequest size={11} />
                            {incident.linkedPRId}
                          </Link>
                        ) : (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
