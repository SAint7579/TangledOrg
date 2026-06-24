import Link from "next/link";
import { GitPullRequest, FolderGit2, User, Clock, Tag, AlertCircle } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { RiskBadge } from "@/components/compliance/RiskBadge";
import { mockIssues, mockPRs, mockMembers } from "@/lib/mock-data";
import { formatRelativeTime, cn } from "@/lib/utils";
import type { IssueStatus, SLAStatus, IssueCategory } from "@/types";

const statusLabel: Record<IssueStatus, string> = {
  open:          "Open",
  "in-progress": "In Progress",
  resolved:      "Resolved",
  closed:        "Closed",
};

const statusColor: Record<IssueStatus, string> = {
  open:          "text-red-400 border-red-900",
  "in-progress": "text-amber-400 border-amber-900",
  resolved:      "text-green-400 border-green-900",
  closed:        "text-zinc-500 border-zinc-700",
};

const slaStatusColor: Record<SLAStatus, string> = {
  open:     "text-zinc-400",
  "at-risk": "text-amber-400",
  breached: "text-red-400",
  resolved: "text-green-400",
};

function categoryLabel(c: IssueCategory) {
  return c.replace(/-/g, " ");
}

function SLABar({ hoursRemaining, maxHours, status }: { hoursRemaining: number; maxHours: number; status: SLAStatus }) {
  const pct = Math.max(0, Math.min(100, (hoursRemaining / maxHours) * 100));
  const barColor = status === "breached" ? "bg-red-500" : status === "at-risk" ? "bg-amber-500" : "bg-green-500";
  const label = status === "breached"
    ? "OVERDUE"
    : hoursRemaining >= 24
      ? `${Math.ceil(hoursRemaining / 24)}d remaining`
      : `${hoursRemaining}h remaining`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className={cn("font-mono text-xs font-medium", slaStatusColor[status])}>{label}</span>
        <span className="font-mono text-[10px] text-zinc-600">{maxHours}h SLA</span>
      </div>
      <div className="h-1 bg-zinc-800 w-full">
        <div className={cn("h-full transition-all", barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function IssueDetailPage({ params }: { params: { id: string } }) {
  const issue = mockIssues.find((i) => i.id === params.id) ?? mockIssues[0];
  const linkedPR = mockPRs.find((pr) => pr.id === issue.linkedPRId);
  const assignee = mockMembers.find((m) => m.handle === issue.assigneeHandle);
  const createdBy = mockMembers.find((m) => m.handle === issue.createdByHandle);

  return (
    <Shell
      breadcrumbs={[
        { label: "Issues", href: "/issues" },
        { label: issue.id },
      ]}
    >
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={cn("font-mono text-xs px-2 py-0.5 border", statusColor[issue.status])}>
              {statusLabel[issue.status]}
            </span>
            <RiskBadge tier={issue.severity} />
            <span className="font-mono text-[11px] text-zinc-500 capitalize">{categoryLabel(issue.category)}</span>
            {issue.sla.status === "at-risk" && (
              <span className="font-mono text-[11px] text-amber-400 flex items-center gap-1">
                <AlertCircle size={11} /> SLA at risk
              </span>
            )}
          </div>
          <h1 className="text-lg font-semibold text-zinc-100 leading-snug">{issue.title}</h1>
          <p className="text-[11px] font-mono text-zinc-600">
            {issue.id} · opened {formatRelativeTime(issue.createdAt)}
            {createdBy && <> by <span className="text-zinc-500">{createdBy.handle.split(".")[0]}</span></>}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Left: description + CVEs */}
          <div className="md:col-span-2 space-y-5">

            {/* Description */}
            <div className="border border-zinc-800 bg-zinc-900/30 px-5 py-4">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-3">Description</p>
              <p className="text-sm text-zinc-300 leading-relaxed">{issue.description}</p>
            </div>

            {/* CVEs / affected package */}
            {(issue.cveIds.length > 0 || issue.affectedPackage) && (
              <div className="border border-zinc-800 bg-zinc-900/30 px-5 py-4 space-y-3">
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em]">Vulnerability Details</p>
                {issue.affectedPackage && (
                  <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
                    <span className="text-xs text-zinc-500">Affected Package</span>
                    <code className="font-mono text-xs text-zinc-200 bg-zinc-800 px-2 py-0.5">
                      {issue.affectedPackage}
                    </code>
                  </div>
                )}
                {issue.cveIds.map((cve) => (
                  <div key={cve} className="flex items-center justify-between py-1.5 border-b border-zinc-800/50 last:border-0">
                    <span className="text-xs text-zinc-500">CVE</span>
                    <span className="font-mono text-xs text-red-400 font-semibold">{cve}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Linked PR preview */}
            {linkedPR && (
              <div className="border border-zinc-800 bg-zinc-900/30 px-5 py-4">
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-3">Linked Pull Request</p>
                <Link
                  href={`/repos/${issue.repoSlug}/pr/${linkedPR.id}`}
                  className="flex items-start gap-3 group"
                >
                  <GitPullRequest size={14} className="text-zinc-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 group-hover:text-white transition-colors">
                      #{linkedPR.number} {linkedPR.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-zinc-600">
                      <span>{linkedPR.repoSlug}</span>
                      <span>{linkedPR.headBranch} → {linkedPR.baseBranch}</span>
                      <span className={cn(
                        "font-semibold",
                        linkedPR.assessment?.mergeGate === "blocked" ? "text-red-400" :
                        linkedPR.assessment?.mergeGate === "needs-human-review" ? "text-blue-400" :
                        linkedPR.assessment?.mergeGate === "warning" ? "text-amber-400" :
                        "text-green-400"
                      )}>
                        {linkedPR.assessment?.mergeGate?.toUpperCase() ?? "PENDING"}
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* Right: metadata sidebar */}
          <div className="space-y-4">

            {/* SLA */}
            <div className="border border-zinc-800 bg-zinc-900/30 px-4 py-4 space-y-3">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em]">SLA</p>
              <SLABar
                hoursRemaining={issue.sla.hoursRemaining}
                maxHours={issue.sla.maxResolutionHours}
                status={issue.sla.status}
              />
              <div className="text-[10px] font-mono text-zinc-600 space-y-0.5">
                <p>Escalates after {issue.sla.escalationAfterHours}h</p>
                <p>Deadline: {new Date(issue.sla.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>

            {/* Metadata */}
            <div className="border border-zinc-800 bg-zinc-900/30 px-4 py-4 space-y-3">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em]">Details</p>

              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-600 flex items-center gap-1.5"><User size={11} /> Assignee</span>
                <span className="font-mono text-zinc-300">
                  {assignee?.handle.split(".")[0] ?? issue.assigneeHandle.split(".")[0]}
                  <span className="text-zinc-600 ml-1 text-[9px] uppercase">{assignee?.role}</span>
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-600 flex items-center gap-1.5"><FolderGit2 size={11} /> Repo</span>
                <Link href={`/repos/${issue.repoSlug}`} className="font-mono text-blue-400 hover:text-blue-300 text-[11px]">
                  {issue.repoSlug}
                </Link>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-600 flex items-center gap-1.5"><Tag size={11} /> Category</span>
                <span className="font-mono text-zinc-400 text-[11px] capitalize">{categoryLabel(issue.category)}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-600 flex items-center gap-1.5"><Clock size={11} /> Opened</span>
                <span className="font-mono text-zinc-400 text-[11px]">{formatRelativeTime(issue.createdAt)}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-600">AT-URI</span>
                <span className="font-mono text-zinc-600 text-[10px]">{issue.did.slice(0, 28)}…</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Shell>
  );
}
