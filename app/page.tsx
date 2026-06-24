import Link from "next/link";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  GitPullRequest,
  Shield,
  Clock,
  AlertOctagon,
  ArrowRight,
  Zap,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { MergeGateBadge } from "@/components/compliance/MergeGateBadge";
import { RiskBadge } from "@/components/compliance/RiskBadge";
import { ComplianceScore } from "@/components/compliance/ComplianceScore";
import {
  mockRepos,
  mockPRs,
  mockMembers,
  mockOrg,
  mockIncidents,
} from "@/lib/mock-data";
import { formatRelativeTime, cn } from "@/lib/utils";

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

  const orgScore = Math.round(
    mockRepos.reduce((acc, _) => acc + 78, 0) / mockRepos.length + 9
  );

  return (
    <Shell breadcrumbs={[{ label: "Dashboard" }]}>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Hero banner ──────────────────────────────────────────── */}
        <div className="relative rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-600/10 via-zinc-900/60 to-zinc-900 p-6 overflow-hidden">
          {/* Background glow */}
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-indigo-600/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="info" size="sm">
                  <Zap size={9} className="mr-1" />AT Protocol
                </Badge>
              </div>
              <h1 className="text-2xl font-bold text-zinc-100 leading-tight">
                Protocol-native compliance,<br className="hidden sm:block" /> enforced on every PR.
              </h1>
              <p className="text-sm text-zinc-400 mt-2 max-w-xl leading-relaxed">
                Tangled Org automatically runs security scans, checks regulatory controls, and blocks non-compliant merges — with every decision signed as a tamper-evident ATProto record.
              </p>
            </div>
            <Link
              href="/repos/patient-service/pr/pr-001"
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-900/30"
            >
              View blocked PR
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>

        {/* ── Score + stats ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="flex flex-col items-center justify-center py-6 gap-2">
            <ComplianceScore score={orgScore} size="xl" label="Org Score" />
            <p className="text-xs text-zinc-500 text-center mt-1">
              {compliantRepos}/{mockOrg.stats.repos} repos compliant
            </p>
            <div className="flex gap-2 mt-1">
              <Badge variant="success" size="sm">{compliantRepos} pass</Badge>
              {atRiskRepos > 0 && <Badge variant="warning" size="sm">{atRiskRepos} risk</Badge>}
              {nonCompliantRepos > 0 && <Badge variant="danger" size="sm">{nonCompliantRepos} fail</Badge>}
            </div>
          </Card>

          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Compliant Repos"
              value={compliantRepos}
              sub={`of ${mockOrg.stats.repos} governed`}
              icon={CheckCircle}
              color="bg-green-500/10 text-green-400"
            />
            <StatCard
              label="Blocked PRs"
              value={blockedPRs}
              sub="awaiting fixes"
              icon={XCircle}
              color="bg-red-500/10 text-red-400"
            />
            <StatCard
              label="Open Incidents"
              value={openIncidents.length}
              sub={openIncidents.some(i => i.sla.status === "at-risk") ? "⚠ SLA at risk" : "within SLA"}
              icon={AlertOctagon}
              color="bg-orange-500/10 text-orange-400"
            />
          </div>
        </div>

        {/* ── Open incidents ────────────────────────────────────────── */}
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
              <Link href="/incidents" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-zinc-800/40">
              {openIncidents.map((incident) => {
                const severityDot: Record<string, string> = {
                  critical: "bg-red-500",
                  high: "bg-orange-500",
                  medium: "bg-amber-500",
                  low: "bg-green-500",
                };
                const slaDisplay = incident.sla.status === "breached"
                  ? <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded font-mono">BREACHED</span>
                  : incident.sla.status === "at-risk"
                    ? <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono">
                        {incident.sla.hoursRemaining >= 24 ? `${Math.ceil(incident.sla.hoursRemaining / 24)}d left ⚠` : `${incident.sla.hoursRemaining}h left ⚠`}
                      </span>
                    : <span className="text-[10px] text-zinc-500 font-mono">
                        {incident.sla.hoursRemaining >= 24 ? `${Math.ceil(incident.sla.hoursRemaining / 24)}d left` : `${incident.sla.hoursRemaining}h left`}
                      </span>;

                return (
                  <Link
                    key={incident.id}
                    href={`/incidents/${incident.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/30 transition-colors group"
                  >
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0 animate-pulse", severityDot[incident.severity])} />
                    <span className="font-mono text-xs font-semibold text-zinc-300 w-14 flex-shrink-0">{incident.id}</span>
                    <span className="font-mono text-xs text-zinc-500 w-32 flex-shrink-0 truncate">{incident.repoSlug}</span>
                    <span className="flex-1 text-xs text-zinc-300 group-hover:text-white truncate">{incident.title}</span>
                    <div className="flex-shrink-0">{slaDisplay}</div>
                  </Link>
                );
              })}
            </div>
          </Card>
        )}

        {/* ── Pull requests ─────────────────────────────────────────── */}
        <Card padding={false}>
          <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-zinc-800/60">
            <div className="flex items-center gap-2">
              <GitPullRequest size={14} className="text-zinc-400" />
              <h3 className="text-sm font-semibold text-zinc-100">Open Pull Requests</h3>
              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                {mockPRs.length}
              </span>
            </div>
            <Link href="/repos" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              View repos →
            </Link>
          </div>
          <div className="divide-y divide-zinc-800/40">
            {mockPRs.map((pr) => {
              const author = mockMembers.find((m) => m.handle === pr.authorHandle);
              return (
                <Link
                  key={pr.id}
                  href={`/repos/${pr.repoSlug}/pr/${pr.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/30 transition-colors group"
                >
                  <Avatar displayName={author?.displayName ?? pr.authorHandle} size="xs" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] text-zinc-600 font-mono">{pr.repoSlug}#{pr.number}</span>
                      {pr.assessment && <RiskBadge tier={pr.assessment.riskTier} size="sm" />}
                    </div>
                    <p className="text-sm font-medium text-zinc-200 group-hover:text-white truncate">{pr.title}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[10px] text-zinc-600 hidden sm:block">
                      <Clock size={9} className="inline mr-1" />
                      {formatRelativeTime(pr.updatedAt)}
                    </span>
                    {pr.assessment && <MergeGateBadge status={pr.assessment.mergeGate} size="sm" />}
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>

        {/* ── How it works ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              icon: Shield,
              color: "text-blue-400 bg-blue-500/10",
              title: "Automated on every PR",
              body: "Semgrep, Gitleaks, and OSV-Scanner run automatically. An AI agent reasons about regulatory implications.",
            },
            {
              icon: Lock,
              color: "text-purple-400 bg-purple-500/10",
              title: "Signed ATProto records",
              body: "Every assessment, approval, and evidence record is cryptographically signed on your PDS. Tamper-evident by design.",
            },
            {
              icon: AlertTriangle,
              color: "text-amber-400 bg-amber-500/10",
              title: "Hard enforcement",
              body: "A Knot-side hook blocks the merge if hard controls fail — not just a warning, but a real gate.",
            },
          ].map(({ icon: Icon, color, title, body }) => (
            <div key={title} className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-4">
              <div className={cn("w-8 h-8 rounded-md flex items-center justify-center mb-3", color)}>
                <Icon size={15} strokeWidth={2} />
              </div>
              <p className="text-sm font-semibold text-zinc-200 mb-1">{title}</p>
              <p className="text-xs text-zinc-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

      </div>
    </Shell>
  );
}
