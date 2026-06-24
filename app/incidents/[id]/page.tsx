import Link from "next/link";
import { AlertOctagon, Clock, GitPullRequest, Package, Shield, Network, CheckCircle } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { mockIncidents, mockPRs } from "@/lib/mock-data";
import { formatDateTime, cn } from "@/lib/utils";
import type { RiskTier, IncidentCategory } from "@/types";

function severityBadgeClass(severity: RiskTier): string {
  switch (severity) {
    case "critical": return "bg-red-500/10 text-red-400 border-red-500/20";
    case "high": return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    case "medium": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "low": return "bg-green-500/10 text-green-400 border-green-500/20";
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

function slaProgressColor(percentElapsed: number): string {
  if (percentElapsed < 50) return "bg-green-500";
  if (percentElapsed < 75) return "bg-amber-500";
  return "bg-red-500";
}

const slaRules = [
  { severity: "critical", maxHours: 48, requiredApprover: "security-lead + DPO", escalationHours: 24 },
  { severity: "high", maxHours: 168, requiredApprover: "security-lead", escalationHours: 72 },
  { severity: "medium", maxHours: 336, requiredApprover: "maintainer", escalationHours: 168 },
  { severity: "low", maxHours: 720, requiredApprover: "developer", escalationHours: 336 },
];

export default function IncidentDetailPage({ params }: { params: { id: string } }) {
  const incident = mockIncidents.find((i) => i.id === params.id) ?? mockIncidents[0];
  const linkedPR = incident.linkedPRId ? mockPRs.find((pr) => pr.id === incident.linkedPRId) : undefined;

  const createdAt = new Date(incident.createdAt);
  const deadline = new Date(incident.sla.deadline);
  const now = new Date("2026-06-24T12:00:00Z"); // fixed reference for demo

  const totalMs = deadline.getTime() - createdAt.getTime();
  const elapsedMs = now.getTime() - createdAt.getTime();
  const percentElapsed = Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100)));

  const statusColors: Record<string, string> = {
    open: "bg-green-500/10 text-green-400 border-green-500/20",
    "in-progress": "bg-blue-500/10 text-blue-400 border-blue-500/20",
    resolved: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    closed: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };

  const downstreamImpact = linkedPR?.assessment?.impactAssessment?.affectedEdges ?? [];

  return (
    <Shell
      breadcrumbs={[
        { label: "Incidents", href: "/incidents" },
        { label: incident.id },
      ]}
    >
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 flex-shrink-0">
            <AlertOctagon size={20} className="text-orange-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="font-mono text-sm font-bold text-zinc-400">{incident.id}</span>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded border capitalize font-semibold", severityBadgeClass(incident.severity))}>
                {incident.severity}
              </span>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded border capitalize", categoryBadgeClass(incident.category))}>
                {incident.category.replace("-", " ")}
              </span>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded border capitalize", statusColors[incident.status])}>
                {incident.status}
              </span>
            </div>
            <h1 className="text-xl font-bold text-zinc-100 leading-snug">{incident.title}</h1>
            <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500 flex-wrap">
              <span className="font-mono text-zinc-600 text-[10px]">{incident.repoSlug}</span>
              <span>Opened {formatDateTime(incident.createdAt)}</span>
              {incident.cveIds.length > 0 && (
                <span className="flex items-center gap-1">
                  {incident.cveIds.map((cve) => (
                    <code key={cve} className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">{cve}</code>
                  ))}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Left column */}
          <div className="lg:col-span-3 space-y-4">
            {/* SLA Timeline */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Clock size={14} className="text-zinc-400" />
                <span className="text-sm font-semibold text-zinc-100">SLA Timeline</span>
                {incident.sla.status === "at-risk" && (
                  <Badge variant="warning" size="sm">At Risk</Badge>
                )}
                {incident.sla.status === "breached" && (
                  <Badge variant="danger" size="sm">BREACHED</Badge>
                )}
                {incident.sla.status === "open" && (
                  <Badge variant="success" size="sm">On Track</Badge>
                )}
              </div>

              {/* Large remaining time */}
              <div className="mb-4">
                {incident.sla.status === "breached" ? (
                  <p className="text-2xl font-bold text-red-400">SLA Breached</p>
                ) : incident.sla.hoursRemaining >= 24 ? (
                  <p className="text-2xl font-bold text-zinc-100">
                    {Math.floor(incident.sla.hoursRemaining / 24)}d {incident.sla.hoursRemaining % 24}h remaining
                  </p>
                ) : (
                  <p className="text-2xl font-bold text-amber-400">{incident.sla.hoursRemaining}h remaining</p>
                )}
                <p className="text-xs text-zinc-500 mt-0.5">{percentElapsed}% of SLA window elapsed</p>
              </div>

              {/* Progress bar */}
              <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden mb-4">
                <div
                  className={cn("h-full rounded-full transition-all", slaProgressColor(percentElapsed))}
                  style={{ width: `${percentElapsed}%` }}
                />
              </div>

              {/* Timeline details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-md bg-zinc-800/40 border border-zinc-800/60">
                  <p className="text-zinc-600 text-[10px] mb-0.5">Created</p>
                  <p className="text-zinc-300 font-mono text-[11px]">{formatDateTime(incident.createdAt)}</p>
                </div>
                <div className="p-2.5 rounded-md bg-zinc-800/40 border border-zinc-800/60">
                  <p className="text-zinc-600 text-[10px] mb-0.5">SLA Deadline</p>
                  <p className="text-zinc-300 font-mono text-[11px]">{formatDateTime(incident.sla.deadline)}</p>
                </div>
                <div className="p-2.5 rounded-md bg-zinc-800/40 border border-zinc-800/60">
                  <p className="text-zinc-600 text-[10px] mb-0.5">Max Resolution</p>
                  <p className="text-zinc-300 font-mono text-[11px]">{incident.sla.maxResolutionHours}h</p>
                </div>
                <div className="p-2.5 rounded-md bg-zinc-800/40 border border-zinc-800/60">
                  <p className="text-zinc-600 text-[10px] mb-0.5">Escalation After</p>
                  <p className="text-zinc-300 font-mono text-[11px]">{incident.sla.escalationAfterHours}h</p>
                </div>
                {incident.sla.resolvedAt && (
                  <div className="p-2.5 rounded-md bg-green-500/5 border border-green-500/20 col-span-2">
                    <p className="text-zinc-600 text-[10px] mb-0.5">Resolved</p>
                    <p className="text-green-400 font-mono text-[11px]">{formatDateTime(incident.sla.resolvedAt)}</p>
                    {incident.sla.resolvedBy && <p className="text-zinc-500 text-[10px] mt-0.5">by {incident.sla.resolvedBy}</p>}
                  </div>
                )}
              </div>
            </Card>

            {/* Details */}
            <Card>
              <CardHeader title="Details" />
              <div className="space-y-3">
                <div className="flex items-start justify-between py-1.5 border-b border-zinc-800/50">
                  <span className="text-xs text-zinc-500">Repository</span>
                  <Link href={`/repos/${incident.repoSlug}`} className="text-xs font-mono text-blue-400 hover:text-blue-300">
                    {incident.repoSlug}
                  </Link>
                </div>
                {incident.affectedPackage && (
                  <div className="flex items-start justify-between py-1.5 border-b border-zinc-800/50">
                    <span className="text-xs text-zinc-500 flex items-center gap-1.5"><Package size={11} /> Affected Package</span>
                    <code className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      {incident.affectedPackage}
                    </code>
                  </div>
                )}
                {incident.cveIds.length > 0 && (
                  <div className="flex items-start justify-between py-1.5 border-b border-zinc-800/50">
                    <span className="text-xs text-zinc-500">CVE IDs</span>
                    <div className="flex flex-col gap-1 items-end">
                      {incident.cveIds.map((cve) => (
                        <code key={cve} className="text-[10px] font-mono text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">{cve}</code>
                      ))}
                    </div>
                  </div>
                )}
                <div className="py-1.5">
                  <p className="text-xs text-zinc-500 mb-1.5">Description</p>
                  <p className="text-xs text-zinc-300 leading-relaxed">{incident.description}</p>
                </div>
              </div>
            </Card>

            {/* SLA Rules Table */}
            <Card padding={false}>
              <div className="px-4 pt-4 pb-3 flex items-center gap-2 border-b border-zinc-800/60">
                <Shield size={14} className="text-zinc-400" />
                <span className="text-sm font-semibold text-zinc-100">SLA Policy Rules</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800/40">
                      <th className="text-left px-4 py-2.5 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Severity</th>
                      <th className="text-left px-4 py-2.5 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Max Resolution</th>
                      <th className="text-left px-4 py-2.5 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Required Approver</th>
                      <th className="text-left px-4 py-2.5 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Escalation At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/30">
                    {slaRules.map((rule) => (
                      <tr
                        key={rule.severity}
                        className={cn(
                          "transition-colors",
                          rule.severity === incident.severity && "bg-blue-500/5"
                        )}
                      >
                        <td className="px-4 py-2.5">
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded border capitalize font-semibold",
                            severityBadgeClass(rule.severity as RiskTier)
                          )}>
                            {rule.severity}
                          </span>
                          {rule.severity === incident.severity && (
                            <span className="ml-2 text-[9px] text-blue-400">← current</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-zinc-300">{rule.maxHours}h</td>
                        <td className="px-4 py-2.5 text-zinc-400">{rule.requiredApprover}</td>
                        <td className="px-4 py-2.5 font-mono text-zinc-300">{rule.escalationHours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Linked PR */}
            {linkedPR && (
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <GitPullRequest size={14} className="text-zinc-400" />
                  <span className="text-sm font-semibold text-zinc-100">Linked Pull Request</span>
                </div>
                <div className="p-3 rounded-md bg-zinc-800/40 border border-zinc-800/60">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono text-xs text-zinc-500">
                      {linkedPR.repoSlug}#{linkedPR.number}
                    </span>
                    {linkedPR.assessment && (
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded border font-semibold uppercase",
                        linkedPR.assessment.mergeGate === "blocked"
                          ? "bg-red-500/10 text-red-400 border-red-500/20"
                          : linkedPR.assessment.mergeGate === "pass"
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      )}>
                        {linkedPR.assessment.mergeGate}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-200 font-medium mb-1.5 leading-snug">{linkedPR.title}</p>
                  <p className="text-[10px] text-zinc-500">by @{linkedPR.authorHandle.split(".")[0]}</p>
                  <Link
                    href={`/repos/${linkedPR.repoSlug}/pr/${linkedPR.id}`}
                    className="mt-2.5 flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <GitPullRequest size={11} />
                    View PR →
                  </Link>
                </div>
              </Card>
            )}

            {/* Downstream Impact */}
            {downstreamImpact.length > 0 && (
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <Network size={14} className="text-zinc-400" />
                  <span className="text-sm font-semibold text-zinc-100">Downstream Impact</span>
                </div>
                <p className="text-[11px] text-zinc-400 mb-3 leading-relaxed">
                  When resolved, issues will be auto-created in:
                </p>
                <div className="space-y-2">
                  {downstreamImpact.map((edge, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded bg-zinc-800/40 border border-zinc-800/60">
                      <CheckCircle size={12} className={
                        edge.actionRequired === "update-required" ? "text-red-400" :
                        edge.actionRequired === "review-recommended" ? "text-amber-400" :
                        "text-zinc-500"
                      } />
                      <span className="text-xs font-mono text-zinc-300">{edge.downstreamRepoName}</span>
                      <span className={cn(
                        "text-[9px] px-1 py-0.5 rounded border ml-auto",
                        edge.actionRequired === "update-required"
                          ? "bg-red-500/10 text-red-400 border-red-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      )}>
                        {edge.actionRequired.replace("-", " ")}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* AT Protocol DID */}
            <div className="rounded-md bg-zinc-900/60 border border-zinc-800/50 px-3 py-2.5">
              <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold mb-1">AT Protocol Record</p>
              <code className="text-[9px] text-zinc-500 font-mono break-all leading-relaxed">
                {incident.did}
              </code>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
