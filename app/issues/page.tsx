"use client";

import { useState } from "react";
import Link from "next/link";
import { GitPullRequest } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { RiskBadge } from "@/components/compliance/RiskBadge";
import { mockIssues } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { IssueStatus, IssueCategory, SLAStatus, RiskTier } from "@/types";

type FilterTab = "all" | "open" | "in-progress" | "resolved";

function severityColor(s: RiskTier) {
  return s === "critical" ? "text-red-400" : s === "high" ? "text-orange-400" : s === "medium" ? "text-amber-400" : "text-green-400";
}

function categoryLabel(c: IssueCategory) {
  return c.replace(/-/g, " ");
}

function SLACell({ status, hoursRemaining }: { status: SLAStatus; hoursRemaining: number }) {
  if (status === "breached") {
    return <span className="font-mono text-[11px] text-red-400">OVERDUE ⚠</span>;
  }
  if (status === "resolved") {
    return <span className="font-mono text-[11px] text-zinc-600">resolved</span>;
  }
  const label = hoursRemaining >= 24
    ? `${Math.ceil(hoursRemaining / 24)}d remaining`
    : `${hoursRemaining}h remaining`;
  const atRisk = status === "at-risk";
  return (
    <span className={cn("font-mono text-[11px]", atRisk ? "text-amber-400" : "text-zinc-500")}>
      {label}{atRisk && " ⚠"}
    </span>
  );
}

function StatusDot({ status }: { status: IssueStatus }) {
  const map: Record<IssueStatus, string> = {
    open:          "text-red-400",
    "in-progress": "text-amber-400",
    resolved:      "text-green-400",
    closed:        "text-zinc-600",
  };
  const label: Record<IssueStatus, string> = {
    open:          "open",
    "in-progress": "in progress",
    resolved:      "resolved",
    closed:        "closed",
  };
  return <span className={cn("font-mono text-[11px] font-medium", map[status])}>{label[status]}</span>;
}

export default function IssuesPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const filtered = mockIssues.filter((issue) => {
    if (activeTab === "all") return true;
    if (activeTab === "open") return issue.status === "open";
    if (activeTab === "in-progress") return issue.status === "in-progress";
    if (activeTab === "resolved") return issue.status === "resolved" || issue.status === "closed";
    return true;
  });

  const openCount      = mockIssues.filter((i) => i.status === "open").length;
  const inProgCount    = mockIssues.filter((i) => i.status === "in-progress").length;
  const atRiskCount    = mockIssues.filter((i) => i.sla.status === "at-risk").length;

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all",         label: `All (${mockIssues.length})` },
    { id: "open",        label: `Open (${openCount})` },
    { id: "in-progress", label: `In Progress (${inProgCount})` },
    { id: "resolved",    label: "Resolved" },
  ];

  return (
    <Shell breadcrumbs={[{ label: "Issues" }]}>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">Issues</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Compliance and security issues tracked per repository, each linked to a pull request.
            </p>
          </div>
          <div className="flex items-center gap-6 text-right">
            <div>
              <span className="text-xl font-mono font-semibold text-red-400">{openCount}</span>
              <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em]">open</p>
            </div>
            <div>
              <span className="text-xl font-mono font-semibold text-amber-400">{inProgCount}</span>
              <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em]">in progress</p>
            </div>
            {atRiskCount > 0 && (
              <div>
                <span className="text-xl font-mono font-semibold text-amber-400">{atRiskCount}</span>
                <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em]">sla at risk</p>
              </div>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-zinc-800">
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

        {/* Issues table */}
        {filtered.length === 0 ? (
          <div className="border border-zinc-800 px-6 py-12 text-center">
            <p className="text-sm text-zinc-500">No issues match this filter.</p>
          </div>
        ) : (
          <div className="border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/60">
                  {["ID", "Repo", "Title", "Severity", "Category", "Assigned To", "SLA", "Status", "Linked PR"].map((h) => (
                    <th key={h} className="text-left px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.12em]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filtered.map((issue) => (
                  <tr
                    key={issue.id}
                    className="hover:bg-zinc-800/30 transition-colors group cursor-pointer"
                    onClick={() => { window.location.href = `/issues/${issue.id}`; }}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/issues/${issue.id}`}
                        className={cn("font-mono text-xs font-semibold", severityColor(issue.severity))}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {issue.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/repos/${issue.repoSlug}`}
                        className="font-mono text-[11px] text-blue-400 hover:text-blue-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {issue.repoSlug}
                      </Link>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-xs text-zinc-200 leading-snug line-clamp-2">{issue.title}</p>
                      {issue.affectedPackage && (
                        <code className="text-[10px] font-mono text-zinc-500 mt-0.5 block">
                          {issue.affectedPackage}
                        </code>
                      )}
                      {issue.cveIds.length > 0 && (
                        <span className="text-[10px] font-mono text-red-400 mt-0.5 block">
                          {issue.cveIds.join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <RiskBadge tier={issue.severity} size="sm" />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-[11px] text-zinc-500 capitalize">
                        {categoryLabel(issue.category)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                      {issue.assigneeHandle.split(".")[0]}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <SLACell status={issue.sla.status} hoursRemaining={issue.sla.hoursRemaining} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusDot status={issue.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {issue.linkedPRId ? (
                        <Link
                          href={`/repos/${issue.repoSlug}/pr/${issue.linkedPRId}`}
                          className="flex items-center gap-1 font-mono text-[11px] text-blue-400 hover:text-blue-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GitPullRequest size={11} />
                          {issue.linkedPRId}
                        </Link>
                      ) : (
                        <span className="font-mono text-[11px] text-zinc-700">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
