"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, GitFork, GitPullRequest, Shield, Users, Lock, Tag, FileText, Settings } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RiskBadge } from "@/components/compliance/RiskBadge";
import { ComplianceScore } from "@/components/compliance/ComplianceScore";
import { mockRepos, mockPolicyPacks, mockPRs, mockMembers } from "@/lib/mock-data";
import { complianceStatusBg, languageDot, formatRelativeTime, cn } from "@/lib/utils";

type Tab = "compliance" | "codeowners" | "policies" | "owners-link" | "settings-link";

export default function RepoDetailPage({ params }: { params: { repo: string } }) {
  const [activeTab, setActiveTab] = useState<Tab>("compliance");
  const repo = mockRepos.find((r) => r.slug === params.repo) ?? mockRepos[0];
  const packs = mockPolicyPacks.filter((p) => repo.policyPacks.includes(p.id));
  const repoPRs = mockPRs.filter((pr) => pr.repoId === repo.id);

  const tabs: { id: Tab; label: string; icon: React.ElementType; external?: string }[] = [
    { id: "compliance", label: "Compliance", icon: Shield },
    { id: "codeowners", label: "Code Owners", icon: Users },
    { id: "policies", label: "Bound Policies", icon: FileText },
    { id: "owners-link", label: "Owners", icon: Users, external: `/repos/${repo.slug}/owners` },
    { id: "settings-link", label: "Settings", icon: Settings, external: `/repos/${repo.slug}/settings` },
  ];

  // Estimated compliance score per repo
  const scoreMap: Record<string, number> = {
    "patient-service": 41,
    "billing-service": 97,
    "auth-service": 78,
    "user-service": 67,
    "notification-service": 88,
    "analytics-pipeline": 52,
  };
  const score = scoreMap[repo.slug] ?? 75;

  return (
    <Shell breadcrumbs={[{ label: "Repos", href: "/repos" }, { label: repo.name }]}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Repo header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-bold text-zinc-100 font-mono">{repo.name}</h1>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded border font-mono font-medium",
                complianceStatusBg(repo.complianceStatus)
              )}>
                {repo.complianceStatus === "compliant" && "Compliant"}
                {repo.complianceStatus === "at-risk" && "At Risk"}
                {repo.complianceStatus === "non-compliant" && "Non-Compliant"}
              </span>
              <RiskBadge tier={repo.riskTier} />
              <Badge variant="neutral" size="sm" className="capitalize">{repo.dataClassification}</Badge>
            </div>
            <p className="text-sm text-zinc-400">{repo.description}</p>
            <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className={cn("w-2.5 h-2.5 rounded-full", languageDot(repo.language))} />
                {repo.language}
              </span>
              <span className="flex items-center gap-1"><Star size={12} />{repo.stars}</span>
              <span className="flex items-center gap-1"><GitFork size={12} />{repo.forks}</span>
              <span className="flex items-center gap-1"><GitPullRequest size={12} />{repo.openPRs} open PRs</span>
              <span className="font-mono text-zinc-600 text-[10px]">{repo.did.substring(0, 22)}...</span>
            </div>
          </div>
          <ComplianceScore score={score} size="lg" label="Score" />
        </div>

        {/* Open PRs quick list */}
        {repoPRs.length > 0 && (
          <Card padding={false}>
            <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitPullRequest size={14} className="text-zinc-400" />
                <span className="text-sm font-semibold text-zinc-100">Open Pull Requests</span>
                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">{repoPRs.length}</span>
              </div>
            </div>
            <div className="divide-y divide-zinc-800/30">
              {repoPRs.map((pr) => (
                <Link
                  key={pr.id}
                  href={`/repos/${repo.slug}/pr/${pr.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/20 transition-colors group"
                >
                  <GitPullRequest size={13} className="text-zinc-500" />
                  <span className="font-mono text-xs text-zinc-500">#{pr.number}</span>
                  <span className="text-sm text-zinc-300 group-hover:text-white flex-1 truncate">{pr.title}</span>
                  <span className="text-xs text-zinc-500">{formatRelativeTime(pr.updatedAt)}</span>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {/* Tabs */}
        <div>
          <div className="flex gap-0 border-b border-zinc-800">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              if (tab.external) {
                return (
                  <Link
                    key={tab.id}
                    href={tab.external}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                      "border-transparent text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    <Icon size={13} />
                    {tab.label}
                  </Link>
                );
              }
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                    isActive
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="mt-4">
            {activeTab === "compliance" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Compliance profile */}
                <Card>
                  <CardHeader title="Compliance Profile" />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
                      <span className="text-xs text-zinc-500 flex items-center gap-1.5"><Lock size={11} /> Data Classification</span>
                      <Badge variant="neutral" className="capitalize">{repo.dataClassification}</Badge>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
                      <span className="text-xs text-zinc-500 flex items-center gap-1.5"><Shield size={11} /> Risk Tier</span>
                      <RiskBadge tier={repo.riskTier} />
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
                      <span className="text-xs text-zinc-500">Compliance Status</span>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded border font-mono",
                        complianceStatusBg(repo.complianceStatus)
                      )}>
                        {repo.complianceStatus}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
                      <span className="text-xs text-zinc-500">Language</span>
                      <span className="flex items-center gap-1.5 text-xs text-zinc-300">
                        <span className={cn("w-2 h-2 rounded-full", languageDot(repo.language))} />
                        {repo.language}
                      </span>
                    </div>
                    <div className="flex items-start justify-between py-1.5">
                      <span className="text-xs text-zinc-500">Regulations</span>
                      <div className="flex gap-1 flex-wrap justify-end max-w-[160px]">
                        {repo.regulations.map((reg) => (
                          <Badge key={reg} variant="info" size="sm">{reg}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Policy packs summary */}
                <Card>
                  <CardHeader title="Policy Packs" description={`${packs.length} packs bound`} />
                  <div className="space-y-2">
                    {packs.map((pack) => (
                      <div key={pack.id} className="flex items-center justify-between p-2.5 rounded-md bg-zinc-800/40 border border-zinc-800/60">
                        <div>
                          <p className="text-xs font-medium text-zinc-200">{pack.name}</p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">{pack.controlCount} controls</p>
                        </div>
                        <Badge variant="info" size="sm">{pack.framework}</Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {activeTab === "codeowners" && (
              <Card padding={false}>
                <div className="px-4 py-3 border-b border-zinc-800/60">
                  <div className="flex items-center gap-2">
                    <Users size={13} className="text-zinc-400" />
                    <span className="text-sm font-semibold text-zinc-100">CODEOWNERS</span>
                  </div>
                </div>
                <div className="divide-y divide-zinc-800/40">
                  {repo.codeOwners.map((co, i) => {
                    const ownerMembers = mockMembers.filter((m) =>
                      co.owners.includes(`@${m.handle}`)
                    );
                    return (
                      <div key={i} className="px-4 py-3">
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <code className="text-xs font-mono text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded">
                              {co.pattern}
                            </code>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {ownerMembers.map((m) => (
                              <span key={m.id} className="text-[10px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                                @{m.handle.split(".")[0]}
                              </span>
                            ))}
                            {co.teamOwners.map((t) => (
                              <span key={t} className="text-[10px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {activeTab === "policies" && (
              <div className="space-y-3">
                {packs.map((pack) => (
                  <Card key={pack.id}>
                    <CardHeader
                      title={pack.name}
                      description={pack.description}
                      action={
                        <div className="flex items-center gap-2">
                          <Badge variant="info" size="sm">{pack.framework}</Badge>
                          <Tag size={12} className="text-zinc-500" />
                        </div>
                      }
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {pack.controls.map((ctrl) => (
                        <div key={ctrl.id} className="p-2 rounded bg-zinc-800/40 border border-zinc-800/60">
                          <p className="text-[10px] font-medium text-zinc-200 leading-snug">{ctrl.name}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Badge
                              size="sm"
                              variant={ctrl.severity === "critical" || ctrl.severity === "high" ? "danger" : ctrl.severity === "medium" ? "warning" : "neutral"}
                            >
                              {ctrl.severity}
                            </Badge>
                            {ctrl.automated && <Badge size="sm" variant="info">auto</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
