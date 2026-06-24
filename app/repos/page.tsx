"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Star,
  GitFork,
  GitPullRequest,
  Clock,
  Shield,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RiskBadge } from "@/components/compliance/RiskBadge";
import { mockRepos, mockPolicyPacks } from "@/lib/mock-data";
import {
  complianceStatusBg,
  languageDot,
  formatRelativeTime,
  cn,
} from "@/lib/utils";
import type { ComplianceStatus } from "@/types";

type Filter = "all" | ComplianceStatus;

const filterLabels: Record<Filter, string> = {
  all: "All",
  compliant: "Compliant",
  "at-risk": "At Risk",
  "non-compliant": "Non-Compliant",
  unknown: "Unknown",
};

export default function ReposPage() {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = filter === "all"
    ? mockRepos
    : mockRepos.filter((r) => r.complianceStatus === filter);

  const counts: Record<Filter, number> = {
    all: mockRepos.length,
    compliant: mockRepos.filter((r) => r.complianceStatus === "compliant").length,
    "at-risk": mockRepos.filter((r) => r.complianceStatus === "at-risk").length,
    "non-compliant": mockRepos.filter((r) => r.complianceStatus === "non-compliant").length,
    unknown: mockRepos.filter((r) => r.complianceStatus === "unknown").length,
  };

  return (
    <Shell breadcrumbs={[{ label: "Repos" }]}>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Repositories</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {mockRepos.length} repos with active compliance monitoring
          </p>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "compliant", "at-risk", "non-compliant"] as Filter[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "primary" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {filterLabels[f]}
              <span className={cn(
                "ml-1 px-1.5 py-0 rounded-full text-[9px] font-mono",
                filter === f ? "bg-blue-500/30 text-blue-200" : "bg-zinc-700/60 text-zinc-400"
              )}>
                {counts[f]}
              </span>
            </Button>
          ))}
        </div>

        {/* Repos list */}
        <div className="space-y-2">
          {filtered.map((repo) => {
            const packs = mockPolicyPacks.filter((p) => repo.policyPacks.includes(p.id));
            return (
              <Card key={repo.id} padding={false}>
                <Link
                  href={`/repos/${repo.slug}`}
                  className="flex items-start gap-4 p-4 hover:bg-zinc-800/20 transition-colors group rounded-lg"
                >
                  {/* Left: info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                      <span className="text-base font-semibold text-zinc-100 group-hover:text-white font-mono">
                        {repo.name}
                      </span>
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium font-mono",
                        complianceStatusBg(repo.complianceStatus)
                      )}>
                        {repo.complianceStatus === "compliant" && "✓ Compliant"}
                        {repo.complianceStatus === "at-risk" && "⚠ At Risk"}
                        {repo.complianceStatus === "non-compliant" && "✕ Non-Compliant"}
                        {repo.complianceStatus === "unknown" && "? Unknown"}
                      </span>
                      <RiskBadge tier={repo.riskTier} size="sm" />
                    </div>
                    <p className="text-sm text-zinc-400 line-clamp-1 mb-2">{repo.description}</p>
                    <div className="flex items-center gap-4 text-xs text-zinc-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <span className={cn("w-2 h-2 rounded-full", languageDot(repo.language))} />
                        {repo.language}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star size={11} />
                        {repo.stars}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitFork size={11} />
                        {repo.forks}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitPullRequest size={11} />
                        {repo.openPRs} open
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {formatRelativeTime(repo.lastActivity)}
                      </span>
                    </div>
                  </div>

                  {/* Right: policies */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                      {packs.map((pack) => (
                        <span
                          key={pack.id}
                          className="text-[9px] bg-zinc-800 text-zinc-400 border border-zinc-700/50 px-1.5 py-0.5 rounded font-mono"
                        >
                          {pack.framework}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="neutral" size="sm">
                        <span className="capitalize">{repo.dataClassification}</span>
                      </Badge>
                    </div>
                  </div>
                </Link>
              </Card>
            );
          })}

          {filtered.length === 0 && (
            <Card className="py-12 text-center">
              <Shield size={32} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-400">No repos match this filter.</p>
            </Card>
          )}
        </div>
      </div>
    </Shell>
  );
}
