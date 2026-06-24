"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  FolderGit2,
  Zap,
  User,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { fetchPolicies, fetchRepos, createPolicyBinding } from "@/lib/api";
import { cn } from "@/lib/utils";

const frameworkColors: Record<string, string> = {
  "ISO 27001": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  GDPR: "bg-green-500/10 text-green-400 border-green-500/20",
  "EU AI Act": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "SOC 2": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  HIPAA: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Custom: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const severityOrder = ["critical", "high", "medium", "low", "info"] as const;

export default function PoliciesPage() {
  const [policiesData, setPoliciesData] = useState<any>(null);
  const [reposData, setReposData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showBindForm, setShowBindForm] = useState(false);
  const [bindRepoUri, setBindRepoUri] = useState("");
  const [binding, setBinding] = useState(false);

  useEffect(() => {
    Promise.all([fetchPolicies(), fetchRepos()]).then(([policies, repos]) => {
      setPoliciesData(policies);
      setReposData(repos);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <Shell breadcrumbs={[{ label: "Policies" }]}>
        <div className="flex items-center justify-center h-64">
          <span className="text-zinc-500 text-sm animate-pulse">Loading...</span>
        </div>
      </Shell>
    );
  }

  const policyPacks = policiesData?.policyPacks ?? [];
  const repos = reposData?.repos ?? [];
  const selectedPack = policyPacks[selectedIdx] ?? policyPacks[0];

  if (!selectedPack) {
    return (
      <Shell breadcrumbs={[{ label: "Policies" }]}>
        <div className="max-w-5xl mx-auto text-center py-12">
          <Shield size={32} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">No policy packs found.</p>
        </div>
      </Shell>
    );
  }

  const controls = selectedPack.controls ?? [];
  const bindings = selectedPack.bindings ?? [];

  async function handleBind() {
    if (!bindRepoUri || !selectedPack) return;
    setBinding(true);
    await createPolicyBinding({
      repoUri: bindRepoUri,
      policyPackUri: selectedPack.uri ?? selectedPack.id,
    });
    const res = await fetchPolicies();
    setPoliciesData(res);
    setShowBindForm(false);
    setBindRepoUri("");
    setBinding(false);
  }

  return (
    <Shell breadcrumbs={[{ label: "Policies" }]}>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Policy Packs</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {policyPacks.length} frameworks ·{" "}
            {policyPacks.reduce(
              (a: number, p: any) => a + (p.controlCount ?? p.controls?.length ?? 0),
              0
            )}{" "}
            total controls
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {policyPacks.map((pack: any, idx: number) => {
            const isSelected = idx === selectedIdx;
            const fwColor =
              frameworkColors[pack.framework] ?? frameworkColors["Custom"];
            return (
              <button
                key={pack.id ?? idx}
                onClick={() => setSelectedIdx(idx)}
                className={cn(
                  "text-left p-4 rounded-lg border transition-all",
                  isSelected
                    ? "border-blue-500/40 bg-blue-500/5 ring-1 ring-blue-500/20"
                    : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-800/40"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <BookOpen
                      size={14}
                      className={isSelected ? "text-blue-400" : "text-zinc-500"}
                    />
                    <span className="text-sm font-semibold text-zinc-100">
                      {pack.name}
                    </span>
                  </div>
                  {isSelected && (
                    <ChevronRight
                      size={13}
                      className="text-blue-400 flex-shrink-0"
                    />
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed mb-3 line-clamp-2">
                  {pack.description}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border font-mono font-medium",
                      fwColor
                    )}
                  >
                    {pack.framework}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {pack.controlCount ?? controls.length} controls
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] text-zinc-500 font-mono">
                    <FolderGit2 size={9} /> {pack.repoCount ?? bindings.length}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <Card padding={false}>
              <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-zinc-400" />
                  <span className="text-sm font-semibold text-zinc-100">
                    {selectedPack.name}
                  </span>
                  {selectedPack.version && (
                    <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                      v{selectedPack.version}
                    </span>
                  )}
                </div>
                <span className="text-xs text-zinc-500">
                  {controls.length} controls
                </span>
              </div>
              <div className="divide-y divide-zinc-800/40">
                {[...controls]
                  .sort(
                    (a: any, b: any) =>
                      severityOrder.indexOf(a.severity) -
                      severityOrder.indexOf(b.severity)
                  )
                  .map((ctrl: any) => (
                    <div key={ctrl.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-medium text-zinc-200">
                              {ctrl.name}
                            </span>
                            <Badge
                              size="sm"
                              variant={
                                ctrl.severity === "critical"
                                  ? "danger"
                                  : ctrl.severity === "high"
                                  ? "danger"
                                  : ctrl.severity === "medium"
                                  ? "warning"
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
                          <p className="text-xs text-zinc-500 leading-relaxed">
                            {ctrl.description}
                          </p>
                          {ctrl.reference && (
                            <code className="text-[10px] font-mono text-zinc-600 mt-1 block">
                              {ctrl.reference}
                            </code>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                {controls.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-zinc-500">
                      No controls defined for this pack.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader
                title="Repo Bindings"
                description={`${bindings.length} repos bound`}
                action={
                  <button
                    onClick={() => setShowBindForm(!showBindForm)}
                    className="text-[10px] font-mono px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                  >
                    Bind to Repo
                  </button>
                }
              />
              {showBindForm && (
                <div className="mb-3 space-y-2">
                  <select
                    value={bindRepoUri}
                    onChange={(e) => setBindRepoUri(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  >
                    <option value="">Select repo...</option>
                    {repos.map((r: any) => (
                      <option key={r.id ?? r.uri} value={r.uri ?? r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleBind}
                    disabled={binding || !bindRepoUri}
                    className="text-[10px] font-mono px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition-colors"
                  >
                    {binding ? "Binding..." : "Confirm"}
                  </button>
                </div>
              )}
              {bindings.length > 0 ? (
                <div className="space-y-2">
                  {bindings.map((binding: any, idx: number) => (
                    <div
                      key={binding.id ?? idx}
                      className="flex items-center gap-2 p-2 rounded-md bg-zinc-800/40 border border-zinc-800/60"
                    >
                      <FolderGit2
                        size={12}
                        className="text-zinc-500 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-zinc-300 truncate">
                          {binding.repoSlug ?? binding.repoUri ?? binding.repoId}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-600 text-center py-4">
                  No repos bound to this pack.
                </p>
              )}
            </Card>

            <Card>
              <CardHeader title="Pack Overview" />
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-500">Framework</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded border font-mono text-[10px] font-medium",
                      frameworkColors[selectedPack.framework] ??
                        frameworkColors["Custom"]
                    )}
                  >
                    {selectedPack.framework}
                  </span>
                </div>
                {selectedPack.version && (
                  <div className="flex items-center justify-between py-1 border-b border-zinc-800/50">
                    <span className="text-zinc-500">Version</span>
                    <code className="font-mono text-zinc-300">
                      {selectedPack.version}
                    </code>
                  </div>
                )}
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-500">Controls</span>
                  <span className="text-zinc-300 font-mono">
                    {controls.length}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-zinc-800/50">
                  <span className="text-zinc-500">Automated</span>
                  <span className="text-zinc-300 font-mono">
                    {controls.filter((c: any) => c.automated).length}/
                    {controls.length}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-zinc-500">Repos Bound</span>
                  <span className="text-zinc-300 font-mono">
                    {bindings.length}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Shell>
  );
}
