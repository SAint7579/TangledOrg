import Link from "next/link";
import { GitPullRequest } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { RiskBadge } from "@/components/compliance/RiskBadge";
import { mockRepos, mockIssues, mockMembers } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { IssueStatus, SLAStatus } from "@/types";

const statusLabel: Record<IssueStatus, string> = {
  open:          "open",
  "in-progress": "in progress",
  resolved:      "resolved",
  closed:        "closed",
};

const statusColor: Record<IssueStatus, string> = {
  open:          "text-red-400",
  "in-progress": "text-amber-400",
  resolved:      "text-green-400",
  closed:        "text-zinc-600",
};

function SlaCell({ hoursRemaining, slaStatus }: { hoursRemaining: number; slaStatus: SLAStatus }) {
  if (slaStatus === "resolved") return <span className="font-mono text-[11px] text-zinc-600">—</span>;
  const urgent = slaStatus === "at-risk" || slaStatus === "breached";
  const label = hoursRemaining >= 24
    ? `${Math.ceil(hoursRemaining / 24)}d remaining`
    : `${hoursRemaining}h remaining`;
  return (
    <span className={cn("font-mono text-[11px]", urgent ? "text-amber-400" : "text-zinc-500")}>
      {label}{urgent && " ⚠"}
    </span>
  );
}

export default function RepoIssuesPage({ params }: { params: { repo: string } }) {
  const repo = mockRepos.find((r) => r.slug === params.repo) ?? mockRepos[0];
  const issues = mockIssues.filter((i) => i.repoSlug === params.repo);

  const openCount       = issues.filter((i) => i.status === "open").length;
  const inProgressCount = issues.filter((i) => i.status === "in-progress").length;
  const resolvedCount   = issues.filter((i) => i.status === "resolved").length;

  return (
    <Shell
      breadcrumbs={[
        { label: "Repos", href: "/repos" },
        { label: repo.name, href: `/repos/${repo.slug}` },
        { label: "Issues" },
      ]}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100 tracking-tight font-mono">
              {repo.name} / issues
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Compliance and security issues tracked against this repository.
            </p>
          </div>
          <div className="flex items-center gap-6 text-right">
            <div>
              <span className="text-xl font-mono font-semibold text-red-400">{openCount}</span>
              <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em]">open</p>
            </div>
            <div>
              <span className="text-xl font-mono font-semibold text-amber-400">{inProgressCount}</span>
              <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em]">in progress</p>
            </div>
            <div>
              <span className="text-xl font-mono font-semibold text-green-400">{resolvedCount}</span>
              <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em]">resolved</p>
            </div>
          </div>
        </div>

        {/* Issues table */}
        {issues.length === 0 ? (
          <div className="border border-zinc-800 px-6 py-12 text-center">
            <p className="text-sm text-zinc-500">No issues for this repository.</p>
          </div>
        ) : (
          <div className="border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/60">
                  {["ID", "Title", "Severity", "Assigned To", "SLA", "Status", "Linked PR"].map((h) => (
                    <th key={h} className="text-left px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.12em]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {issues.map((issue) => {
                  const assignee = mockMembers.find((m) => m.handle === issue.assigneeHandle);
                  return (
                    <tr key={issue.id} className="hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link href={`/issues/${issue.id}`} className="font-mono text-xs font-semibold text-blue-400 hover:text-blue-300">
                          {issue.id}
                        </Link>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <Link href={`/issues/${issue.id}`} className="text-xs text-zinc-200 hover:text-white leading-snug line-clamp-2 transition-colors">
                          {issue.title}
                        </Link>
                        {issue.affectedPackage && (
                          <code className="text-[10px] font-mono text-zinc-600 mt-0.5 block">{issue.affectedPackage}</code>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <RiskBadge tier={issue.severity} size="sm" />
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                        {assignee ? assignee.handle.split(".")[0] : issue.assigneeHandle.split(".")[0]}
                        <span className="text-zinc-600 ml-1 text-[9px] uppercase tracking-wide">
                          {assignee?.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <SlaCell hoursRemaining={issue.sla.hoursRemaining} slaStatus={issue.sla.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn("font-mono text-[11px] font-medium", statusColor[issue.status])}>
                          {statusLabel[issue.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {issue.linkedPRId ? (
                          <Link
                            href={`/repos/${repo.slug}/pr/${issue.linkedPRId}`}
                            className="flex items-center gap-1 font-mono text-[11px] text-blue-400 hover:text-blue-300"
                          >
                            <GitPullRequest size={11} />
                            {issue.linkedPRId}
                          </Link>
                        ) : (
                          <span className="font-mono text-[11px] text-zinc-700">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
