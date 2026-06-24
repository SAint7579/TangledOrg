"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  FolderGit2,
  Zap,
  User,
  ChevronRight,
  BookOpen,
  Plus,
  X,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { fetchPolicies, fetchRepos, fetchOrgs, createPolicyBinding, createPolicyPack } from "@/lib/api";
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

const FRAMEWORKS = [
  { value: "iso-27001", label: "ISO 27001" },
  { value: "gdpr", label: "GDPR" },
  { value: "eu-ai-act", label: "EU AI Act" },
  { value: "soc2", label: "SOC 2" },
  { value: "hipaa", label: "HIPAA" },
  { value: "pci-dss", label: "PCI DSS" },
  { value: "custom", label: "Custom" },
];

export default function PoliciesPage() {
  const [policiesData, setPoliciesData] = useState<any>(null);
  const [reposData, setReposData] = useState<any>(null);
  const [orgUri, setOrgUri] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showBindForm, setShowBindForm] = useState(false);
  const [bindRepoUri, setBindRepoUri] = useState("");
  const [binding, setBinding] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPack, setNewPack] = useState({
    name: "", description: "", framework: "custom", version: "1.0",
  });
  const [newControls, setNewControls] = useState<{
    controlId: string; name: string; description: string;
    checkType: string; enforcement: string; severity: string;
  }[]>([]);

  useEffect(() => {
    Promise.all([fetchPolicies(), fetchRepos(), fetchOrgs()]).then(([policies, repos, orgs]) => {
      setPoliciesData(policies);
      setReposData(repos);
      const org = orgs?.organizations?.[0];
      if (org) setOrgUri(org.uri ?? "");
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

  async function handleCreatePack() {
    if (!newPack.name.trim()) return;
    setCreating(true);
    await createPolicyPack({
      orgUri,
      name: newPack.name,
      description: newPack.description || undefined,
      framework: newPack.framework,
      version: newPack.version,
      controls: newControls.length > 0 ? newControls : undefined,
    });
    const res = await fetchPolicies();
    setPoliciesData(res);
    setShowCreateForm(false);
    setNewPack({ name: "", description: "", framework: "custom", version: "1.0" });
    setNewControls([]);
    setCreating(false);
    if (res?.policyPacks?.length) setSelectedIdx(res.policyPacks.length - 1);
  }

  function addControl() {
    setNewControls([...newControls, {
      controlId: `CTL-${newControls.length + 1}`,
      name: "", description: "",
      checkType: "automated", enforcement: "warn", severity: "medium",
    }]);
  }

  if (!selectedPack && !showCreateForm) {
    return (
      <Shell breadcrumbs={[{ label: "Policies" }]}>
        <div className="max-w-5xl mx-auto text-center py-12">
          <Shield size={32} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-400 mb-4">No policy packs found.</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="text-xs font-mono px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            <Plus size={12} className="inline mr-1" />
            Create Policy Pack
          </button>
        </div>
      </Shell>
    );
  }

  const controls = selectedPack?.controls ?? [];
  const bindings = selectedPack?.bindings ?? [];

  async function handleBind() {
    if (!bindRepoUri || !selectedPack) return;
    setBinding(true);
    await createPolicyBinding({
      repoUri: bindRepoUri,
      policyPackUri: selectedPack?.uri ?? selectedPack?.id ?? "",
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
        <div className="flex items-center justify-between">
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
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            {showCreateForm ? <X size={12} /> : <Plus size={12} />}
            {showCreateForm ? "Cancel" : "Create Pack"}
          </button>
        </div>

        {showCreateForm && (
          <Card>
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-zinc-100">New Policy Pack</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Name</label>
                  <input
                    value={newPack.name}
                    onChange={(e) => setNewPack({ ...newPack, name: e.target.value })}
                    placeholder="e.g. GDPR Data Protection Pack"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Framework</label>
                  <select
                    value={newPack.framework}
                    onChange={(e) => setNewPack({ ...newPack, framework: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  >
                    {FRAMEWORKS.map((fw) => (
                      <option key={fw.value} value={fw.value}>{fw.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  value={newPack.description}
                  onChange={(e) => setNewPack({ ...newPack, description: e.target.value })}
                  placeholder="What does this policy pack enforce?"
                  rows={2}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Version</label>
                  <input
                    value={newPack.version}
                    onChange={(e) => setNewPack({ ...newPack, version: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Controls</label>
                  <button
                    onClick={addControl}
                    className="text-[10px] font-mono px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition-colors"
                  >
                    <Plus size={10} className="inline mr-0.5" /> Add Control
                  </button>
                </div>
                {newControls.length > 0 && (
                  <div className="space-y-2">
                    {newControls.map((ctrl, idx) => (
                      <div key={idx} className="p-3 bg-zinc-800/50 border border-zinc-800 rounded space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            value={ctrl.name}
                            onChange={(e) => {
                              const updated = [...newControls];
                              updated[idx] = { ...ctrl, name: e.target.value };
                              setNewControls(updated);
                            }}
                            placeholder="Control name"
                            className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                          />
                          <select
                            value={ctrl.severity}
                            onChange={(e) => {
                              const updated = [...newControls];
                              updated[idx] = { ...ctrl, severity: e.target.value };
                              setNewControls(updated);
                            }}
                            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none"
                          >
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                          <select
                            value={ctrl.checkType}
                            onChange={(e) => {
                              const updated = [...newControls];
                              updated[idx] = { ...ctrl, checkType: e.target.value };
                              setNewControls(updated);
                            }}
                            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none"
                          >
                            <option value="automated">Automated</option>
                            <option value="manual">Manual</option>
                          </select>
                          <button
                            onClick={() => setNewControls(newControls.filter((_, i) => i !== idx))}
                            className="text-zinc-600 hover:text-red-400 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <input
                          value={ctrl.description}
                          onChange={(e) => {
                            const updated = [...newControls];
                            updated[idx] = { ...ctrl, description: e.target.value };
                            setNewControls(updated);
                          }}
                          placeholder="Control description"
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {newControls.length === 0 && (
                  <p className="text-[11px] text-zinc-600 text-center py-3">
                    No controls yet. You can add controls now or after creating the pack.
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleCreatePack}
                  disabled={creating || !newPack.name.trim()}
                  className="text-xs font-mono px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition-colors"
                >
                  {creating ? "Creating..." : "Create Policy Pack"}
                </button>
              </div>
            </div>
          </Card>
        )}

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

        {selectedPack && (
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
        )}
      </div>
    </Shell>
  );
}
