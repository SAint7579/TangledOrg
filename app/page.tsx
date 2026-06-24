import Link from "next/link";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  GitPullRequest,
  Activity,
  TrendingUp,
  Shield,
  Clock,
  AlertOctagon,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { MergeGateBadge } from "@/components/compliance/MergeGateBadge";
import { RiskBadge } from "@/components/compliance/RiskBadge";
import { ComplianceScore } from "@/components/compliance/ComplianceScore";
import {
  mockRepos,
  mockPRs,
  mockAuditEntries,
  mockPolicyPacks,
  mockMembers,
  mockOrg,
  mockIncidents,
} from "@/lib/mock-data";
import { formatRelativeTime, auditTypeColor, languageDot, cn } from "@/lib/utils";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="flex items-start gap-3">
      <div className={cn("p-2 rounded-lg flex-shrink-0", color)}>
        <Icon size={18} strokeWidth={2} />
      </div>
      <div>
        <p className="text-2xl font-bold text-zinc-100 leading-none">{value}</p>
        <p className="text-xs text-zinc-400 mt-1">{label}</p>
        {sub && <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const compliantRepos = mockRepos.filter((r) => r.complianceStatus === "compliant").length;
  const atRiskRepos = mockRepos.filter((r) => r.complianceStatus === "at-risk").length;
  const nonCompliantRepos = mockRepos.filter((r) => r.complianceStatus === "non-compliant").length;
  const blockedPRs = mockPRs.filter((pr) => pr.assessment?.mergeGate === "blocked").length;
  const openIncidents = mockIncidents.filter((i) => i.status === "open" || i.status === "in-progress");
  const slaAtRisk = mockIncidents.filter((i) => i.sla.status === "at-risk" || i.sla.status === "breached").length;

  // Org-level compliance score: weighted average
  const orgScore = Math.round(
    mockRepos.reduce((acc, _) => acc + 78, 0) / mockRepos.length + 9
  );

  // Policy coverage: % repos with each framework
  const policyCoverage = mockPolicyPacks.map((pack) => ({
    name: pack.framework,
    percent: Math.round((pack.repoCount / mockOrg.stats.repos) * 100),
    count: pack.repoCount,
  }));

  // Risk heatmap data
  const riskGrid = mockRepos.map((r) => ({
    name: r.name,
    status: r.complianceStatus,
    risk: r.riskTier,
    slug: r.slug,
  }));

  return (
    <Shell breadcrumbs={[{ label: "Dashboard" }]}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Compliance Dashboard</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Governance overview for <span className="text-zinc-300 font-medium">Acme Health</span> ·{" "}
              <span className="font-mono text-xs text-zinc-600">did:plc:acmehealth7x2kqmn9pltrs44e</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="info" size="sm">AT Protocol</Badge>
            <Badge variant="success" size="sm">Live</Badge>
          </div>
        </div>

        {/* Top section: score + stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Big score */}
          <Card className="lg:col-span-1 flex flex-col items-center justify-center py-6 gap-2">
            <ComplianceScore score={orgScore} size="xl" label="Org Score" />
            <p className="text-xs text-zinc-500 text-center mt-1">
              {compliantRepos}/{mockOrg.stats.repos} repos compliant
            </p>
            <div className="flex gap-2 mt-2">
              <Badge variant="success" size="sm">{compliantRepos} pass</Badge>
              {atRiskRepos > 0 && <Badge variant="warning" size="sm">{atRiskRepos} risk</Badge>}
              {nonCompliantRepos > 0 && <Badge variant="danger" size="sm">{nonCompliantRepos} fail</Badge>}
            </div>
          </Card>

          {/* Stat cards */}
          <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Compliant Repos"
              value={compliantRepos}
              sub={`of ${mockOrg.stats.repos} total`}
              icon={CheckCircle}
              color="bg-green-500/10 text-green-400"
            />
            <StatCard
              label="At-Risk Repos"
              value={atRiskRepos}
              sub="require attention"
              icon={AlertTriangle}
              color="bg-amber-500/10 text-amber-400"
            />
            <StatCard
              label="Blocked PRs"
              value={blockedPRs}
              sub="cannot merge"
              icon={XCircle}
              color="bg-red-500/10 text-red-400"
            />
            <StatCard
              label="SLA at Risk"
              value={slaAtRisk}
              sub="incidents"
              icon={AlertOctagon}
              color="bg-orange-500/10 text-orange-400"
            />
          </div>
        </div>

        {/* Open Incidents */}
        {openIncidents.length > 0 && (
          <Card padding={false}>
            <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-zinc-800/60">
              <div className="flex items-center gap-2">
                <AlertOctagon size={14} className="text-orange-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Open Incidents</h3>
                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                  {openIncidents.length}
                </span>
              </div>
              <Link href="/incidents" className="text-xs text-blue-400 hover:text-blue-300">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-zinc-800/40">
              {openIncidents.map((incident) => {
                const severityDot = {
                  critical: "bg-red-500",
                  high: "bg-orange-500",
                  medium: "bg-amber-500",
                  low: "bg-green-500",
                }[incident.severity];
                const categoryColors: Record<string, string> = {
                  "data-leak": "bg-red-500/10 text-red-400 border-red-500/20",
                  vulnerability: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                  "unauthorized-access": "bg-orange-500/10 text-orange-400 border-orange-500/20",
                  "supply-chain": "bg-purple-500/10 text-purple-400 border-purple-500/20",
                  misconfiguration: "bg-blue-500/10 text-blue-400 border-blue-500/20",
                  other: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
                };
                const slaDisplay = incident.sla.status === "breached"
                  ? <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">BREACHED</span>
                  : incident.sla.status === "at-risk"
                    ? <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">{incident.sla.hoursRemaining >= 24 ? `${Math.ceil(incident.sla.hoursRemaining / 24)}d left ⚠` : `${incident.sla.hoursRemaining}h left ⚠`}</span>
                    : <span className="text-[10px] text-zinc-500 font-mono">{incident.sla.hoursRemaining >= 24 ? `${Math.ceil(incident.sla.hoursRemaining / 24)}d left` : `${incident.sla.hoursRemaining}h left`}</span>;
                return (
                  <Link
                    key={incident.id}
                    href={`/incidents/${incident.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/30 transition-colors group"
                  >
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0", severityDot)} />
                    <span className="font-mono text-xs text-zinc-400 w-14 flex-shrink-0">{incident.id}</span>
                    <span className="text-xs font-mono text-zinc-500 w-28 flex-shrink-0 truncate">{incident.repoSlug}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border capitalize flex-shrink-0", categoryColors[incident.category])}>
                      {incident.category.replace("-", " ")}
                    </span>
                    <span className="flex-1 text-xs text-zinc-300 group-hover:text-white truncate">{incident.title}</span>
                    <div className="flex-shrink-0">{slaDisplay}</div>
                  </Link>
                );
              })}
            </div>
          </Card>
        )}

        {/* Middle section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent PRs */}
          <Card padding={false} className="lg:col-span-2">
            <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-zinc-800/60">
              <div className="flex items-center gap-2">
                <GitPullRequest size={14} className="text-zinc-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Open Pull Requests</h3>
                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                  {mockPRs.length}
                </span>
              </div>
              <Link href="/repos" className="text-xs text-blue-400 hover:text-blue-300">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-zinc-800/40">
              {mockPRs.map((pr) => {
                const memberAuthor = mockMembers.find((m) => m.handle === pr.authorHandle);
                return (
                  <Link
                    key={pr.id}
                    href={`/repos/${pr.repoSlug}/pr/${pr.id}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-800/30 transition-colors group"
                  >
                    <div className="pt-0.5">
                      <Avatar displayName={memberAuthor?.displayName ?? pr.authorHandle} size="xs" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-zinc-500 font-mono">
                          {pr.repoSlug}#{pr.number}
                        </span>
                        {pr.assessment && (
                          <RiskBadge tier={pr.assessment.riskTier} size="sm" />
                        )}
                      </div>
                      <p className="text-sm text-zinc-200 group-hover:text-white truncate font-medium">
                        {pr.title}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        by @{pr.authorHandle.split(".")[0]} · {formatRelativeTime(pr.updatedAt)}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {pr.assessment && (
                        <MergeGateBadge status={pr.assessment.mergeGate} size="sm" />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>

          {/* Recent Audit Activity */}
          <Card padding={false}>
            <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-zinc-800/60">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-zinc-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Audit Activity</h3>
              </div>
              <Link href="/audit" className="text-xs text-blue-400 hover:text-blue-300">
                View all →
              </Link>
            </div>
            <div className="px-4 py-2 space-y-0">
              {mockAuditEntries.slice(0, 8).map((entry) => {
                const typeColor = auditTypeColor(entry.type);
                return (
                  <div key={entry.id} className="flex items-start gap-2.5 py-2.5 border-b border-zinc-800/30 last:border-0">
                    <span className={cn("text-[9px] px-1 py-0.5 rounded font-mono font-semibold uppercase tracking-wider mt-0.5 flex-shrink-0 whitespace-nowrap", typeColor)}>
                      {entry.type.replace("-", " ")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-300 leading-snug line-clamp-2">{entry.description}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock size={9} className="text-zinc-600" />
                        <span className="text-[10px] text-zinc-600">{formatRelativeTime(entry.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Bottom section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Policy Coverage */}
          <Card>
            <CardHeader
              title="Policy Coverage"
              description="Percentage of repos bound to each framework"
              action={<TrendingUp size={14} className="text-zinc-500" />}
            />
            <div className="space-y-3">
              {policyCoverage.map((policy) => (
                <div key={policy.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Shield size={11} className="text-zinc-500" />
                      <span className="text-xs font-medium text-zinc-300">{policy.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500 font-mono">{policy.count}/{mockOrg.stats.repos} repos</span>
                      <span className="text-[10px] text-zinc-300 font-mono font-semibold w-6 text-right">{policy.percent}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${policy.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Risk by Repo heatmap */}
          <Card>
            <CardHeader
              title="Risk by Repo"
              description="Compliance and risk tier overview"
            />
            <div className="grid grid-cols-2 gap-2">
              {riskGrid.map((repo) => {
                const statusColors = {
                  compliant: "border-green-500/30 bg-green-500/5",
                  "at-risk": "border-amber-500/30 bg-amber-500/5",
                  "non-compliant": "border-red-500/30 bg-red-500/5",
                  unknown: "border-zinc-700 bg-zinc-800/20",
                };
                const riskDotColors = {
                  critical: "bg-red-500",
                  high: "bg-orange-500",
                  medium: "bg-amber-500",
                  low: "bg-green-500",
                };
                return (
                  <Link
                    key={repo.slug}
                    href={`/repos/${repo.slug}`}
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-md border transition-all hover:opacity-80",
                      statusColors[repo.status]
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0", languageDot("TypeScript"))} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-200 truncate font-mono">{repo.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", riskDotColors[repo.risk])} />
                        <span className="text-[10px] text-zinc-500 capitalize">{repo.risk} risk</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
