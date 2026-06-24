import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { MergeGateBadge } from "@/components/compliance/MergeGateBadge";
import { RiskBadge } from "@/components/compliance/RiskBadge";
import {
  mockRepos,
  mockPRs,
  mockMembers,
  mockOrg,
  mockIssues,
} from "@/lib/mock-data";
import { formatRelativeTime, cn } from "@/lib/utils";
import type { ComplianceStatus, IssueStatus } from "@/types";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em]">
        {children}
      </span>
      <div className="flex-1 border-t border-zinc-800/80" />
    </div>
  );
}

const statusDot: Record<ComplianceStatus, string> = {
  compliant:       "bg-green-500",
  "at-risk":       "bg-amber-500",
  "non-compliant": "bg-red-500",
  unknown:         "bg-zinc-600",
};

const statusLabel: Record<ComplianceStatus, string> = {
  compliant:       "compliant",
  "at-risk":       "at risk",
  "non-compliant": "non-compliant",
  unknown:         "unknown",
};

const statusColor: Record<ComplianceStatus, string> = {
  compliant:       "text-green-400",
  "at-risk":       "text-amber-400",
  "non-compliant": "text-red-400",
  unknown:         "text-zinc-500",
};

const issueStatusColor: Record<IssueStatus, string> = {
  open:          "text-red-400",
  "in-progress": "text-amber-400",
  resolved:      "text-green-400",
  closed:        "text-zinc-600",
};

export default function DashboardPage() {
  const compliantCount  = mockRepos.filter(r => r.complianceStatus === "compliant").length;
  const atRiskCount     = mockRepos.filter(r => r.complianceStatus === "at-risk").length;
  const nonCompliant    = mockRepos.filter(r => r.complianceStatus === "non-compliant").length;
  const blockedPRs      = mockPRs.filter(pr => pr.assessment?.mergeGate === "blocked").length;
  const openIssues      = mockIssues.filter(i => i.status !== "resolved");
  const orgScore        = 72;

  return (
    <Shell breadcrumbs={[{ label: "Dashboard" }]}>
      <div className="max-w-5xl mx-auto space-y-8">

        {/* ── Org header ──────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">
                {mockOrg.name}
              </h1>
              <span className="text-[10px] font-mono text-zinc-600 border border-zinc-800 px-1.5 py-px">
                AT Protocol
              </span>
            </div>
            <p className="text-sm text-zinc-500">{mockOrg.description}</p>
          </div>
          <Link
            href="/repos/patient-service/pr/pr-001"
            className="text-xs text-blue-400 hover:text-blue-300 border border-blue-900 px-3 py-1.5 transition-colors font-mono"
          >
            view blocked pr →
          </Link>
        </div>

        {/* ── Posture bar ─────────────────────────────────────────── */}
        <div className="border border-zinc-800 bg-zinc-900/40 px-5 py-4">
          <div className="flex items-center gap-8 flex-wrap">
            <div>
              <span className="text-4xl font-bold font-mono text-zinc-100">{orgScore}</span>
              <span className="text-lg font-mono text-zinc-500">%</span>
              <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em] mt-0.5">Compliance Score</p>
            </div>
            <div className="flex-1 min-w-0 border-l border-zinc-800 pl-8">
              <div className="flex items-center gap-8 flex-wrap text-sm">
                <div>
                  <span className="text-xl font-mono font-semibold text-zinc-100">{mockOrg.stats.repos}</span>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em]">repos governed</p>
                </div>
                <div>
                  <span className="text-xl font-mono font-semibold text-green-400">{compliantCount}</span>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em]">compliant</p>
                </div>
                <div>
                  <span className="text-xl font-mono font-semibold text-amber-400">{atRiskCount}</span>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em]">at risk</p>
                </div>
                <div>
                  <span className="text-xl font-mono font-semibold text-red-400">{nonCompliant}</span>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em]">non-compliant</p>
                </div>
                <div>
                  <span className="text-xl font-mono font-semibold text-red-400">{blockedPRs}</span>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em]">blocked prs</p>
                </div>
                <div>
                  <span className="text-xl font-mono font-semibold text-red-400">{openIssues.length}</span>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em]">open issues</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Open Issues ─────────────────────────────────────────── */}
        {openIssues.length > 0 && (
          <div>
            <SectionLabel>
              Issues — {openIssues.length} open
            </SectionLabel>
            <div className="border border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/60">
                    {["ID", "Repo", "Title", "Severity", "Assigned To", "SLA", "Status", "Linked PR"].map(h => (
                      <th key={h} className="text-left px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.12em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {openIssues.map(issue => {
                    const assignee = mockMembers.find(m => m.handle === issue.assigneeHandle);
                    const urgent = issue.sla.hoursRemaining <= 24;
                    const slaLabel = issue.sla.hoursRemaining >= 24
                      ? `${Math.ceil(issue.sla.hoursRemaining / 24)}d`
                      : `${issue.sla.hoursRemaining}h`;
                    return (
                      <tr key={issue.id} className="hover:bg-zinc-800/30 transition-colors group">
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <Link href={`/issues/${issue.id}`} className="font-mono text-xs font-semibold text-blue-400 hover:text-blue-300">
                            {issue.id}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                          {issue.repoSlug}
                        </td>
                        <td className="px-4 py-2.5 max-w-xs">
                          <Link
                            href={`/issues/${issue.id}`}
                            className="text-zinc-200 hover:text-white text-xs transition-colors line-clamp-1"
                          >
                            {issue.title}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">
                          <RiskBadge tier={issue.severity} size="sm" />
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                          {assignee ? assignee.handle.split(".")[0] : issue.assigneeHandle.split(".")[0]}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className={cn("font-mono text-[11px]", urgent ? "text-amber-400" : "text-zinc-500")}>
                            {slaLabel} remaining{urgent && " ⚠"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className={cn("font-mono text-[11px] font-medium", issueStatusColor[issue.status])}>
                            {issue.status === "in-progress" ? "in progress" : issue.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {issue.linkedPRId ? (
                            <Link
                              href={`/repos/${issue.repoSlug}/pr/${issue.linkedPRId}`}
                              className="font-mono text-[11px] text-blue-400 hover:text-blue-300"
                            >
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
          </div>
        )}

        {/* ── Pull requests ────────────────────────────────────────── */}
        <div>
          <SectionLabel>Pull Requests — {mockPRs.length} open</SectionLabel>
          <div className="border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/60">
                  {["Repo", "Title", "Author", "Risk", "Gate", "Updated"].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.12em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {mockPRs.map(pr => {
                  const author = mockMembers.find(m => m.handle === pr.authorHandle);
                  return (
                    <tr key={pr.id} className="hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                        {pr.repoSlug}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/repos/${pr.repoSlug}/pr/${pr.id}`}
                          className="text-zinc-200 hover:text-white text-xs group-hover:text-white transition-colors"
                        >
                          {pr.title}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                        {author?.handle.split(".")[0]}
                      </td>
                      <td className="px-4 py-2.5">
                        {pr.assessment && <RiskBadge tier={pr.assessment.riskTier} size="sm" />}
                      </td>
                      <td className="px-4 py-2.5">
                        {pr.assessment && <MergeGateBadge status={pr.assessment.mergeGate} size="sm" />}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-600 whitespace-nowrap">
                        {formatRelativeTime(pr.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Repository status ────────────────────────────────────── */}
        <div>
          <SectionLabel>Repository Status</SectionLabel>
          <div className="border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/60">
                  {["Repository", "Risk Tier", "Frameworks", "Status", "Open PRs"].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.12em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {mockRepos.map(repo => (
                  <tr key={repo.id} className="hover:bg-zinc-800/30 transition-colors group">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", statusDot[repo.complianceStatus])} />
                        <Link
                          href={`/repos/${repo.slug}`}
                          className="font-mono text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {repo.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <RiskBadge tier={repo.riskTier} size="sm" />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-500">
                      {repo.regulations.join(" · ")}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn("font-mono text-[11px] font-medium", statusColor[repo.complianceStatus])}>
                        {statusLabel[repo.complianceStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-600">
                      {repo.openPRs > 0 ? repo.openPRs : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </Shell>
  );
}
