"use client";

import { useEffect, useState, useCallback } from "react";
import { Shell } from "@/components/layout/Shell";
import { fetchGraph, createRepoDependency, createCodeDependency, deleteGraphEdge } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Plus, Trash2, GitBranch, FileCode, X, Network } from "lucide-react";

type Repo = { id: string; uri: string; name: string };
type RepoDep = { id: string; uri: string; sourceRepo: string; targetRepo: string; dependencyType: string; description?: string };
type CodeDep = { id: string; uri: string; sourceRepo: string; sourcePath: string; sourceLabel?: string; targetRepo: string; targetPath: string; targetLabel?: string; dependencyType: string; description?: string };

const REPO_DEP_TYPES = ["runtime", "build", "test", "api", "data"];
const CODE_DEP_TYPES = ["api-call", "import", "shared-model", "event-consumer", "database-shared", "config-ref", "grpc", "graphql"];

const depTypeColor: Record<string, string> = {
  runtime: "border-blue-500 text-blue-400",
  build: "border-amber-500 text-amber-400",
  test: "border-green-500 text-green-400",
  api: "border-purple-500 text-purple-400",
  data: "border-cyan-500 text-cyan-400",
  "api-call": "border-purple-500 text-purple-400",
  import: "border-blue-500 text-blue-400",
  "shared-model": "border-teal-500 text-teal-400",
  "event-consumer": "border-orange-500 text-orange-400",
  "database-shared": "border-cyan-500 text-cyan-400",
  "config-ref": "border-zinc-500 text-zinc-400",
  grpc: "border-indigo-500 text-indigo-400",
  graphql: "border-pink-500 text-pink-400",
};

function repoName(uri: string, repos: Repo[]): string {
  const r = repos.find(r => r.uri === uri);
  return r?.name ?? uri.split("/").pop() ?? uri;
}

export default function GraphPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repoDeps, setRepoDeps] = useState<RepoDep[]>([]);
  const [codeDeps, setCodeDeps] = useState<CodeDep[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [showAddCode, setShowAddCode] = useState(false);
  const [tab, setTab] = useState<"repo" | "code">("repo");

  const [newRepoDep, setNewRepoDep] = useState({ sourceRepo: "", targetRepo: "", dependencyType: "runtime", description: "" });
  const [newCodeDep, setNewCodeDep] = useState({ sourceRepo: "", sourcePath: "", sourceLabel: "", targetRepo: "", targetPath: "", targetLabel: "", dependencyType: "api-call", description: "" });

  const loadGraph = useCallback(async () => {
    const data = await fetchGraph();
    if (data) {
      setRepos(data.repos || []);
      setRepoDeps(data.repoDependencies || []);
      setCodeDeps(data.codeDependencies || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  const handleAddRepoDep = async () => {
    if (!newRepoDep.sourceRepo || !newRepoDep.targetRepo) return;
    await createRepoDependency(newRepoDep);
    setShowAddRepo(false);
    setNewRepoDep({ sourceRepo: "", targetRepo: "", dependencyType: "runtime", description: "" });
    loadGraph();
  };

  const handleAddCodeDep = async () => {
    if (!newCodeDep.sourceRepo || !newCodeDep.targetRepo || !newCodeDep.sourcePath || !newCodeDep.targetPath) return;
    await createCodeDependency(newCodeDep);
    setShowAddCode(false);
    setNewCodeDep({ sourceRepo: "", sourcePath: "", sourceLabel: "", targetRepo: "", targetPath: "", targetLabel: "", dependencyType: "api-call", description: "" });
    loadGraph();
  };

  const handleDelete = async (collection: string, rkey: string) => {
    await deleteGraphEdge(collection, rkey);
    loadGraph();
  };

  if (loading) {
    return (
      <Shell breadcrumbs={[{ label: "Dependency Map" }]}>
        <div className="flex items-center justify-center h-64">
          <span className="text-zinc-500 text-sm animate-pulse">Loading graph...</span>
        </div>
      </Shell>
    );
  }

  return (
    <Shell breadcrumbs={[{ label: "Dependency Map" }]}>
      <div className="max-w-5xl mx-auto space-y-6">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">Dependency Map</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {repos.length} repos · {repoDeps.length} repo edges · {codeDeps.length} code edges
            </p>
          </div>
          <button
            onClick={() => tab === "repo" ? setShowAddRepo(true) : setShowAddCode(true)}
            className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 transition-colors"
          >
            <Plus size={13} /> Add Edge
          </button>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 border-b border-zinc-800">
          <button
            onClick={() => setTab("repo")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors",
              tab === "repo" ? "border-blue-400 text-blue-400" : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            <GitBranch size={13} /> Repo Dependencies ({repoDeps.length})
          </button>
          <button
            onClick={() => setTab("code")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors",
              tab === "code" ? "border-blue-400 text-blue-400" : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            <FileCode size={13} /> Code Dependencies ({codeDeps.length})
          </button>
        </div>

        {/* Visual graph (compact node diagram) */}
        {repos.length > 0 && (
          <div className="border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="flex flex-wrap gap-4 justify-center">
              {repos.map(repo => {
                const outgoing = repoDeps.filter(d => d.sourceRepo === repo.uri).length
                  + codeDeps.filter(d => d.sourceRepo === repo.uri).length;
                const incoming = repoDeps.filter(d => d.targetRepo === repo.uri).length
                  + codeDeps.filter(d => d.targetRepo === repo.uri).length;
                return (
                  <div key={repo.id} className="flex flex-col items-center gap-1.5 px-4 py-3 border border-zinc-700 bg-zinc-800/50 min-w-[120px]">
                    <Network size={16} className="text-blue-400" />
                    <span className="text-xs font-mono text-zinc-200">{repo.name}</span>
                    <div className="flex gap-3 text-[10px] text-zinc-500">
                      <span>{outgoing} out</span>
                      <span>{incoming} in</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {repos.length > 0 && (repoDeps.length > 0 || codeDeps.length > 0) && (
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {(tab === "repo" ? repoDeps : codeDeps).map((dep: any) => (
                  <div key={dep.id} className="flex items-center gap-1 text-[10px] text-zinc-500">
                    <span className="font-mono text-zinc-400">{repoName(dep.sourceRepo, repos)}</span>
                    <span className={cn("border px-1 py-px text-[9px]", depTypeColor[dep.dependencyType] || "border-zinc-600 text-zinc-500")}>
                      {dep.dependencyType}
                    </span>
                    <span>→</span>
                    <span className="font-mono text-zinc-400">{repoName(dep.targetRepo, repos)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {repos.length === 0 && (
          <div className="border border-zinc-800 bg-zinc-900/40 p-12 text-center">
            <Network size={32} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">No repos found. Create repos on Tangled first.</p>
          </div>
        )}

        {/* Edge list */}
        {tab === "repo" && (
          <div className="border border-zinc-800">
            <div className="px-4 py-2 bg-zinc-900/60 border-b border-zinc-800">
              <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em]">
                Repo-level dependencies
              </span>
            </div>
            {repoDeps.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-600">
                No repo dependencies. Click &ldquo;Add Edge&rdquo; to create one.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/60">
                {repoDeps.map(dep => (
                  <div key={dep.id} className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-800/30 transition-colors group">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-mono text-xs text-zinc-200 truncate">{repoName(dep.sourceRepo, repos)}</span>
                      <span className={cn("border px-1.5 py-0.5 text-[10px] font-mono", depTypeColor[dep.dependencyType] || "border-zinc-600 text-zinc-500")}>
                        {dep.dependencyType}
                      </span>
                      <span className="text-zinc-600">→</span>
                      <span className="font-mono text-xs text-zinc-200 truncate">{repoName(dep.targetRepo, repos)}</span>
                    </div>
                    {dep.description && (
                      <span className="text-[11px] text-zinc-500 truncate max-w-[200px]">{dep.description}</span>
                    )}
                    <button
                      onClick={() => handleDelete("sh.tangled.governance.graph.repoDependency", dep.id)}
                      className="text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "code" && (
          <div className="border border-zinc-800">
            <div className="px-4 py-2 bg-zinc-900/60 border-b border-zinc-800">
              <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em]">
                Code-level dependencies
              </span>
            </div>
            {codeDeps.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-600">
                No code dependencies. Click &ldquo;Add Edge&rdquo; to link specific files across repos.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/60">
                {codeDeps.map(dep => (
                  <div key={dep.id} className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-800/30 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-zinc-200">{repoName(dep.sourceRepo, repos)}</span>
                        <span className="text-[10px] text-zinc-600 font-mono">{dep.sourcePath}</span>
                        <span className={cn("border px-1.5 py-0.5 text-[10px] font-mono", depTypeColor[dep.dependencyType] || "border-zinc-600 text-zinc-500")}>
                          {dep.dependencyType}
                        </span>
                        <span className="text-zinc-600">→</span>
                        <span className="font-mono text-xs text-zinc-200">{repoName(dep.targetRepo, repos)}</span>
                        <span className="text-[10px] text-zinc-600 font-mono">{dep.targetPath}</span>
                      </div>
                      {dep.description && (
                        <p className="text-[11px] text-zinc-500 mt-1">{dep.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete("sh.tangled.governance.graph.codeDependency", dep.id)}
                      className="text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add Repo Dependency Modal */}
        {showAddRepo && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-700 w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-100">Add Repo Dependency</h3>
                <button onClick={() => setShowAddRepo(false)} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Source Repo</label>
                <select value={newRepoDep.sourceRepo} onChange={e => setNewRepoDep(p => ({ ...p, sourceRepo: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 font-mono">
                  <option value="">Select repo...</option>
                  {repos.map(r => <option key={r.uri} value={r.uri}>{r.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Target Repo</label>
                <select value={newRepoDep.targetRepo} onChange={e => setNewRepoDep(p => ({ ...p, targetRepo: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 font-mono">
                  <option value="">Select repo...</option>
                  {repos.map(r => <option key={r.uri} value={r.uri}>{r.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Type</label>
                <select value={newRepoDep.dependencyType} onChange={e => setNewRepoDep(p => ({ ...p, dependencyType: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 font-mono">
                  {REPO_DEP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Description (optional)</label>
                <input value={newRepoDep.description} onChange={e => setNewRepoDep(p => ({ ...p, description: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2" placeholder="Why does this dependency exist?" />
              </div>

              <button onClick={handleAddRepoDep} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium py-2 transition-colors">
                Create Dependency
              </button>
            </div>
          </div>
        )}

        {/* Add Code Dependency Modal */}
        {showAddCode && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-700 w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-100">Add Code Dependency</h3>
                <button onClick={() => setShowAddCode(false)} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Source Repo</label>
                  <select value={newCodeDep.sourceRepo} onChange={e => setNewCodeDep(p => ({ ...p, sourceRepo: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 font-mono">
                    <option value="">Select...</option>
                    {repos.map(r => <option key={r.uri} value={r.uri}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Target Repo</label>
                  <select value={newCodeDep.targetRepo} onChange={e => setNewCodeDep(p => ({ ...p, targetRepo: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 font-mono">
                    <option value="">Select...</option>
                    {repos.map(r => <option key={r.uri} value={r.uri}>{r.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Source Path</label>
                  <input value={newCodeDep.sourcePath} onChange={e => setNewCodeDep(p => ({ ...p, sourcePath: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 font-mono" placeholder="src/api/handler.go" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Target Path</label>
                  <input value={newCodeDep.targetPath} onChange={e => setNewCodeDep(p => ({ ...p, targetPath: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 font-mono" placeholder="src/models/patient.ts" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Type</label>
                <select value={newCodeDep.dependencyType} onChange={e => setNewCodeDep(p => ({ ...p, dependencyType: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 font-mono">
                  {CODE_DEP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Description (optional)</label>
                <input value={newCodeDep.description} onChange={e => setNewCodeDep(p => ({ ...p, description: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2" placeholder="Explain the dependency..." />
              </div>

              <button onClick={handleAddCodeDep} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium py-2 transition-colors">
                Create Code Dependency
              </button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
