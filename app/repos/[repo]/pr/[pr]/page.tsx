"use client";

import { useState } from "react";
import {
  GitMerge,
  GitBranch,
  Plus,
  Minus,
  FileCode,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Cpu,
  Bug,
  Key,
  Package,
  Brain,
  User,
  Users,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { MergeGateBadge } from "@/components/compliance/MergeGateBadge";
import { RiskBadge } from "@/components/compliance/RiskBadge";
import { ControlRow } from "@/components/compliance/ControlRow";
import { ComplianceScore } from "@/components/compliance/ComplianceScore";
import { mockPRs, mockMembers, mockRepos } from "@/lib/mock-data";
import {
  mergeGateBannerColor,
  mergeGateLabel,
  formatDateTime,
  formatRelativeTime,
  truncateDid,
  cn,
} from "@/lib/utils";
import type { MergeGateStatus } from "@/types";

// Mock diff data
const mockDiff = [
  { type: "meta", content: "diff --git a/src/auth/token.ts b/src/auth/token.ts" },
  { type: "meta", content: "@@ -85,12 +85,18 @@ export class TokenService {" },
  { type: "context", content: "   private readonly secret: string;" },
  { type: "context", content: "   private readonly refreshWindowMs: number;" },
  { type: "context", content: "" },
  { type: "remove", content: "-  constructor(secret: string) {" },
  { type: "remove", content: "-    this.secret = secret;" },
  { type: "remove", content: "-    this.refreshWindowMs = 15 * 60 * 1000; // 15 minutes" },
  { type: "add", content: "+  constructor(secret: string, refreshWindowMs?: number) {" },
  { type: "add", content: "+    this.secret = secret ?? process.env.JWT_SECRET ?? 'fallback';" },
  { type: "add", content: "+    this.refreshWindowMs = refreshWindowMs ?? 30 * 60 * 1000; // 30 min" },
  { type: "add", content: "+    if (!secret) {" },
  { type: "add", content: "+      console.warn('JWT_SECRET not provided, using fallback');" },
  { type: "add", content: "+    }" },
  { type: "context", content: "   }" },
  { type: "context", content: "" },
  { type: "context", content: "   async createRefreshToken(userId: string): Promise<string> {" },
  { type: "meta", content: "@@ -138,8 +144,12 @@ export class TokenService {" },
  { type: "context", content: "   async verifyToken(token: string): Promise<Payload | null> {" },
  { type: "context", content: "     try {" },
  { type: "remove", content: "-      return jwt.decode(token) as Payload;" },
  { type: "add", content: "+      const payload = jwt.verify(token, this.secret) as Payload;" },
  { type: "add", content: "+      if (payload.exp && Date.now() / 1000 > payload.exp) {" },
  { type: "add", content: "+        throw new Error('Token expired');" },
  { type: "add", content: "+      }" },
  { type: "add", content: "+      return payload;" },
  { type: "context", content: "     } catch (err) {" },
  { type: "context", content: "       return null;" },
  { type: "context", content: "     }" },
];

const gateBgMap: Record<MergeGateStatus, string> = {
  pass: "bg-green-600",
  warning: "bg-amber-500",
  "needs-human-review": "bg-blue-600",
  blocked: "bg-red-600",
};

export default function PRPage({ params }: { params: { repo: string; pr: string } }) {
  const [diffExpanded, setDiffExpanded] = useState(true);
  const [evidenceExpanded, setEvidenceExpanded] = useState(true);

  const pr = mockPRs.find((p) => p.id === params.pr) ?? mockPRs[0];
  const repo = mockRepos.find((r) => r.slug === params.repo) ?? mockRepos[0];
  const author = mockMembers.find((m) => m.handle === pr.authorHandle);
  const assessment = pr.assessment;

  if (!assessment) {
    return (
      <Shell breadcrumbs={[{ label: "Repos", href: "/repos" }, { label: repo.name, href: `/repos/${repo.slug}` }, { label: `PR #${pr.number}` }]}>
        <p className="text-zinc-400">No assessment found for this PR.</p>
      </Shell>
    );
  }

  const bannerClass = mergeGateBannerColor(assessment.mergeGate);
  const gateDot = gateBgMap[assessment.mergeGate];

  return (
    <Shell
      breadcrumbs={[
        { label: "Repos", href: "/repos" },
        { label: repo.name, href: `/repos/${repo.slug}` },
        { label: `PR #${pr.number}` },
      ]}
    >
      <div className="max-w-7xl mx-auto">
        {/* PR Header */}
        <div className="mb-6">
          <div className="flex items-start gap-3 mb-3">
            <div className={cn("w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0", gateDot)} />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-zinc-100 leading-snug">{pr.title}</h1>
              <div className="flex items-center gap-3 mt-2 text-sm text-zinc-500 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Avatar displayName={author?.displayName ?? pr.authorHandle} size="xs" />
                  <span className="font-mono text-[11px]">@{pr.authorHandle.split(".")[0]}</span>
                </span>
                <span className="flex items-center gap-1">
                  <GitBranch size={12} />
                  <code className="text-[11px] font-mono text-zinc-400">{pr.baseBranch}</code>
                  <span className="text-zinc-600">←</span>
                  <code className="text-[11px] font-mono text-zinc-400">{pr.headBranch}</code>
                </span>
                <span className="flex items-center gap-1 text-green-400">
                  <Plus size={11} /><span className="text-xs font-mono">+{pr.additions}</span>
                </span>
                <span className="flex items-center gap-1 text-red-400">
                  <Minus size={11} /><span className="text-xs font-mono">-{pr.deletions}</span>
                </span>
                <span className="text-xs">{pr.changedFiles} files changed</span>
                <span className="text-xs">{formatRelativeTime(pr.updatedAt)}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {pr.labels.map((label) => (
                  <Badge key={label} variant="neutral" size="sm">{label}</Badge>
                ))}
              </div>
            </div>
            <MergeGateBadge status={assessment.mergeGate} size="md" />
          </div>
          {pr.description && (
            <p className="text-sm text-zinc-400 ml-5 pl-1 border-l border-zinc-800">{pr.description}</p>
          )}
        </div>

        {/* Main two-column layout */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          {/* Left: Diff view */}
          <div className="xl:col-span-3 space-y-4">
            <Card padding={false}>
              <button
                className="w-full flex items-center justify-between px-4 py-3 border-b border-zinc-800/60 hover:bg-zinc-800/20 transition-colors"
                onClick={() => setDiffExpanded(!diffExpanded)}
              >
                <div className="flex items-center gap-2">
                  <FileCode size={14} className="text-zinc-400" />
                  <span className="text-sm font-semibold text-zinc-100">src/auth/token.ts</span>
                  <span className="text-[10px] font-mono text-zinc-500">+14 −4</span>
                </div>
                {diffExpanded ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
              </button>
              {diffExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <tbody>
                      {mockDiff.map((line, i) => (
                        <tr
                          key={i}
                          className={cn(
                            "leading-relaxed",
                            line.type === "add" && "diff-add",
                            line.type === "remove" && "diff-remove",
                            line.type === "context" && "diff-context",
                            line.type === "meta" && "bg-blue-500/5 text-blue-400/70"
                          )}
                        >
                          <td className="w-10 px-2 py-0 text-zinc-700 text-right select-none border-r border-zinc-800/40">
                            {line.type !== "meta" ? i - mockDiff.filter((l, li) => li < i && l.type === "meta").length + 85 : ""}
                          </td>
                          <td className="w-4 px-1 text-center select-none">
                            {line.type === "add" && <span className="text-green-500">+</span>}
                            {line.type === "remove" && <span className="text-red-500">−</span>}
                          </td>
                          <td className="px-3 py-0 whitespace-pre">{line.content}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Additional files placeholder */}
            {[
              { file: "src/auth/middleware.ts", adds: 23, removes: 8 },
              { file: "src/auth/types.ts", adds: 6, removes: 2 },
              { file: "tests/auth/token.test.ts", adds: 89, removes: 31 },
              { file: "src/config/jwt.config.ts", adds: 12, removes: 0 },
            ].map((f) => (
              <Card key={f.file} padding={false}>
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/20 transition-colors"
                  onClick={() => {}}
                >
                  <div className="flex items-center gap-2">
                    <FileCode size={14} className="text-zinc-500" />
                    <span className="text-sm text-zinc-300 font-mono">{f.file}</span>
                    <span className="text-[10px] font-mono text-zinc-500">+{f.adds} −{f.removes}</span>
                  </div>
                  <ChevronDown size={14} className="text-zinc-600" />
                </button>
              </Card>
            ))}
          </div>

          {/* Right: Compliance Panel */}
          <div className="xl:col-span-2 space-y-4">
            {/* Merge Gate Banner */}
            <div className={cn("rounded-lg border p-4", bannerClass)}>
              <div className="flex items-start gap-3">
                <Shield size={20} className="flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{mergeGateLabel(assessment.mergeGate)}</span>
                    <ComplianceScore score={assessment.complianceScore} size="sm" />
                  </div>
                  <p className="text-xs opacity-80 leading-relaxed">{assessment.riskSummary}</p>
                </div>
              </div>
            </div>

            {/* Risk level */}
            <Card>
              <div className="flex items-center gap-3">
                <AlertTriangle size={15} className="text-amber-400 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-zinc-200">Risk Assessment</span>
                    <RiskBadge tier={assessment.riskTier} />
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Assessed by agent <code className="font-mono text-zinc-500 text-[10px]">{truncateDid(assessment.assessedBy)}</code>
                    {" "}· {formatDateTime(assessment.assessedAt)}
                  </p>
                </div>
              </div>
            </Card>

            {/* Controls */}
            <Card padding={false}>
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu size={14} className="text-zinc-400" />
                  <span className="text-sm font-semibold text-zinc-100">Control Evaluations</span>
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                    {assessment.controlEvaluations.length}
                  </span>
                </div>
                <div className="flex gap-1">
                  <span className="text-[10px] text-green-400 font-mono">
                    {assessment.controlEvaluations.filter((e) => e.status === "pass").length} pass
                  </span>
                  <span className="text-zinc-600 text-[10px]">·</span>
                  <span className="text-[10px] text-red-400 font-mono">
                    {assessment.controlEvaluations.filter((e) => e.status === "fail").length} fail
                  </span>
                </div>
              </div>
              <div className="px-4 pb-2">
                {assessment.controlEvaluations.map((ev) => (
                  <ControlRow key={ev.id} evaluation={ev} />
                ))}
              </div>
            </Card>

            {/* Required Approvals */}
            <Card>
              <CardHeader
                title="Required Approvals"
                description={`${assessment.requiredApprovals.filter((a) => a.obtained).length}/${assessment.requiredApprovals.length} obtained`}
              />
              <div className="space-y-2">
                {assessment.requiredApprovals.map((approval) => (
                  <div
                    key={approval.id}
                    className={cn(
                      "flex items-start gap-2.5 p-2.5 rounded-md border",
                      approval.obtained
                        ? "bg-green-500/5 border-green-500/20"
                        : "bg-zinc-800/40 border-zinc-700/50"
                    )}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {approval.obtained ? (
                        <CheckCircle size={14} className="text-green-400" />
                      ) : (
                        <Clock size={14} className="text-zinc-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {approval.approverHandle ? (
                          <>
                            <User size={10} className="text-zinc-500" />
                            <span className="text-xs font-mono text-blue-400">
                              @{approval.approverHandle.split(".")[0]}
                            </span>
                          </>
                        ) : (
                          <>
                            <Users size={10} className="text-zinc-500" />
                            <span className="text-xs font-mono text-purple-400">@{approval.teamSlug}</span>
                          </>
                        )}
                        {approval.obtained && (
                          <Badge variant="success" size="sm">Approved</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500 leading-relaxed">{approval.reason}</p>
                      {approval.obtainedAt && (
                        <p className="text-[9px] text-zinc-600 mt-0.5">{formatDateTime(approval.obtainedAt)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Evidence */}
            <Card padding={false}>
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/20 transition-colors"
                onClick={() => setEvidenceExpanded(!evidenceExpanded)}
              >
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-zinc-400" />
                  <span className="text-sm font-semibold text-zinc-100">Evidence</span>
                </div>
                {evidenceExpanded ? <ChevronUp size={13} className="text-zinc-500" /> : <ChevronDown size={13} className="text-zinc-500" />}
              </button>

              {evidenceExpanded && (
                <div className="border-t border-zinc-800/60 px-4 py-3 space-y-3">
                  {/* SAST */}
                  <div className="flex items-start gap-2.5">
                    <Bug size={13} className={assessment.evidence.sast.totalCount > 0 ? "text-amber-400" : "text-green-400"} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-zinc-200">SAST ({assessment.evidence.sast.tool})</span>
                        <Badge
                          variant={assessment.evidence.sast.totalCount > 0 ? "warning" : "success"}
                          size="sm"
                        >
                          {assessment.evidence.sast.totalCount} finding{assessment.evidence.sast.totalCount !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      {assessment.evidence.sast.findings.map((f, i) => (
                        <div key={i} className="mb-1 p-2 rounded bg-zinc-800/40 border border-zinc-800">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge
                              size="sm"
                              variant={f.severity === "critical" ? "danger" : f.severity === "high" ? "danger" : f.severity === "medium" ? "warning" : "neutral"}
                            >
                              {f.severity}
                            </Badge>
                            <code className="text-[10px] font-mono text-zinc-400">{f.rule}</code>
                          </div>
                          <p className="text-[10px] text-zinc-400">{f.message}</p>
                          <p className="text-[9px] text-zinc-600 font-mono mt-0.5">{f.file}:{f.line}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Secrets */}
                  <div className="flex items-start gap-2.5">
                    <Key size={13} className={assessment.evidence.secrets.clean ? "text-green-400" : "text-red-400"} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-200">Secrets ({assessment.evidence.secrets.tool})</span>
                        <Badge variant={assessment.evidence.secrets.clean ? "success" : "danger"} size="sm">
                          {assessment.evidence.secrets.clean ? "Clean" : `${assessment.evidence.secrets.findings} found`}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Deps */}
                  <div className="flex items-start gap-2.5">
                    <Package size={13} className={assessment.evidence.deps.totalVulns > 0 ? "text-amber-400" : "text-green-400"} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-zinc-200">OSV Deps ({assessment.evidence.deps.tool})</span>
                        <Badge variant={assessment.evidence.deps.totalVulns > 0 ? "warning" : "success"} size="sm">
                          {assessment.evidence.deps.totalVulns} vuln{assessment.evidence.deps.totalVulns !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      {assessment.evidence.deps.vulns.map((v) => (
                        <div key={v.id} className="p-2 rounded bg-zinc-800/40 border border-zinc-800 mb-1">
                          <div className="flex items-center gap-2">
                            <Badge size="sm" variant={v.severity === "critical" ? "danger" : "warning"}>{v.severity}</Badge>
                            <code className="text-[10px] font-mono text-zinc-400">{v.package}</code>
                          </div>
                          {v.fixedIn && (
                            <p className="text-[9px] text-green-400 font-mono mt-0.5">Fixed in {v.fixedIn}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Reasoning */}
                  <div className="flex items-start gap-2.5">
                    <Brain size={13} className="text-blue-400" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-zinc-200">AI Reasoning</span>
                        <Badge variant="info" size="sm">
                          <Zap size={8} className="mr-0.5" />
                          {assessment.evidence.aiReasoning.model.split("-").slice(0, 3).join("-")}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">{assessment.evidence.aiReasoning.summary}</p>
                      {assessment.evidence.aiReasoning.riskFactors.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {assessment.evidence.aiReasoning.riskFactors.map((rf, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <AlertTriangle size={9} className="text-amber-500 mt-0.5 flex-shrink-0" />
                              <span className="text-[10px] text-amber-400/80">{rf}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-[9px] text-zinc-600 mt-2">
                        Ran {formatDateTime(assessment.evidence.aiReasoning.runAt)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Merge action */}
            <div className="flex gap-2">
              {assessment.mergeGate === "pass" && (
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors">
                  <GitMerge size={15} />
                  Merge Pull Request
                </button>
              )}
              {assessment.mergeGate === "warning" && (
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors">
                  <GitMerge size={15} />
                  Merge with Warning
                </button>
              )}
              {assessment.mergeGate === "blocked" && (
                <button disabled className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md bg-red-600/40 text-red-300 text-sm font-semibold cursor-not-allowed border border-red-500/30">
                  <XCircle size={15} />
                  Merge Blocked
                </button>
              )}
              {assessment.mergeGate === "needs-human-review" && (
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
                  <Clock size={15} />
                  Request Review
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
