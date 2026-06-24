"use client";

import { useState } from "react";
import { Shield, FolderGit2, Zap, User, ChevronRight, BookOpen } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { mockPolicyPacks, mockRepoBindings, mockRepos } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { PolicyPack } from "@/types";

const frameworkColors: Record<string, string> = {
  "ISO 27001": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "GDPR": "bg-green-500/10 text-green-400 border-green-500/20",
  "EU AI Act": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "SOC 2": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "HIPAA": "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Custom": "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const severityOrder = ["critical", "high", "medium", "low", "info"] as const;

export default function PoliciesPage() {
  const [selectedPack, setSelectedPack] = useState<PolicyPack>(mockPolicyPacks[0]);

  const bindings = mockRepoBindings.filter(
    (b) => b.policyPackId === selectedPack.id
  );

  return (
    <Shell breadcrumbs={[{ label: "Policies" }]}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Policy Packs</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {mockPolicyPacks.length} frameworks · {mockPolicyPacks.reduce((a, p) => a + p.controlCount, 0)} total controls
          </p>
        </div>

        {/* Policy packs grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {mockPolicyPacks.map((pack) => {
            const isSelected = selectedPack.id === pack.id;
            const fwColor = frameworkColors[pack.framework] ?? frameworkColors["Custom"];
            return (
              <button
                key={pack.id}
                onClick={() => setSelectedPack(pack)}
                className={cn(
                  "text-left p-4 rounded-lg border transition-all",
                  isSelected
                    ? "border-blue-500/40 bg-blue-500/5 ring-1 ring-blue-500/20"
                    : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-800/40"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <BookOpen size={14} className={isSelected ? "text-blue-400" : "text-zinc-500"} />
                    <span className="text-sm font-semibold text-zinc-100">{pack.name}</span>
                  </div>
                  {isSelected && <ChevronRight size={13} className="text-blue-400 flex-shrink-0" />}
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed mb-3 line-clamp-2">{pack.description}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-mono font-medium", fwColor)}>
                    {pack.framework}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">{pack.controlCount} controls</span>
                  <span className="flex items-center gap-0.5 text-[10px] text-zinc-500 font-mono">
                    <FolderGit2 size={9} /> {pack.repoCount}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected pack detail */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Controls table */}
          <div className="lg:col-span-2">
            <Card padding={false}>
              <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-zinc-400" />
                  <span className="text-sm font-semibold text-zinc-100">{selectedPack.name}</span>
                  <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                    v{selectedPack.version}
                  </span>
                </div>
                <span className="text-xs text-zinc-500">{selectedPack.controlCount} controls</span>
              </div>
              <div className="divide-y divide-zinc-800/40">
                {[...selectedPack.controls].sort((a, b) => {
                  return severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
                }).map((ctrl) => (
                  <div key={ctrl.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-medium text-zinc-200">{ctrl.name}</span>
                          <Badge
                            size="sm"
                            variant={
                              ctrl.severity === "critical" ? "danger"
                              : ctrl.severity === "high" ? "danger"
                              : ctrl.severity === "medium" ? "warning"
                              : "neutral"
                            }
                          >
                            {ctrl.severity}
                          </Badge>
                          {ctrl.automated ? (
                            <Badge size="sm" variant="info">
                              <Zap size={8} className="mr-0.5" />
                              automated
                            </Badge>
                          ) : (
                            <Badge size="sm" variant="neutral">
                              <User size={8} className="mr-0.5" />
                              manual
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed">{ctrl.description}</p>
                        {ctrl.reference && (
                          <code className="text-[10px] font-mono text-zinc-600 mt-1 block">{ctrl.reference}</code>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Repo Bindings */}
          <div className="space-y-4">
            <Card>
              <CardHeader
                title="Repo Bindings"
                description={`${bindings.length} repos bound to this pack`}
              />
              {bindings.length > 0 ? (
                <div className="space-y-2">
                  {bindings.map((binding) => {
                    const repo = mockRepos.find((r) => r.id === binding.repoId);
                    return (
                      <div
                        key={binding.id}
                        className="flex items-center gap-2 p-2 rounded-md bg-zinc-800/40 border border-zinc-800/60"
                      >
                        <FolderGit2 size={12} className="text-zinc-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-zinc-300 truncate">{binding.repoSlug}</p>
                          <p className="text-[9px] text-zinc-600 mt-0.5">
                            bound by @{binding.boundBy.split(".")[0]}
                          </p>
                        </div>
                        {repo && (
                          <span className={cn(
                            "text-[9px] px-1 py-0.5 rounded border font-mono",
                            repo.complianceStatus === "compliant" ? "text-green-400 border-green-500/20 bg-green-500/10" : "text-amber-400 border-amber-500/20 bg-amber-500/10"
                          )}>
                            {repo.complianceStatus === "compliant" ? "✓" : "⚠"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-zinc-600 text-center py-4">No repos bound to this pack.</p>
              )}
            </Card>

            {/* Pack stats */}
            <Card>
              <CardHeader title="Pack Overview" />
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-500">Framework</span>
                  <span className={cn("px-1.5 py-0.5 rounded border font-mono text-[10px] font-medium", frameworkColors[selectedPack.framework])}>
                    {selectedPack.framework}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-500">Version</span>
                  <code className="font-mono text-zinc-300">{selectedPack.version}</code>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-500">Controls</span>
                  <span className="text-zinc-300 font-mono">{selectedPack.controlCount}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-500">Automated</span>
                  <span className="text-zinc-300 font-mono">
                    {selectedPack.controls.filter((c) => c.automated).length}/{selectedPack.controlCount}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-500">Critical</span>
                  <span className="text-red-400 font-mono">
                    {selectedPack.controls.filter((c) => c.severity === "critical").length}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-zinc-500">Repos Bound</span>
                  <span className="text-zinc-300 font-mono">{bindings.length}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Shell>
  );
}
