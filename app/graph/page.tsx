"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Shell } from "@/components/layout/Shell";
import { fetchGraph, createRepoDependency, createCodeDependency, deleteGraphEdge } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Plus, Trash2, GitBranch, FileCode, X, Network, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  Handle,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type Repo = { id: string; uri: string; name: string };
type RepoDep = { id: string; uri: string; sourceRepo: string; targetRepo: string; dependencyType: string; description?: string };
type CodeDep = { id: string; uri: string; sourceRepo: string; sourcePath: string; sourceLabel?: string; targetRepo: string; targetPath: string; targetLabel?: string; dependencyType: string; description?: string };

const REPO_DEP_TYPES = ["runtime", "build", "test", "api-call", "api", "data", "event"];
const CODE_DEP_TYPES = ["api-call", "import", "shared-model", "event", "event-consumer", "database-shared", "config-ref", "grpc", "graphql"];

const depTypeColor: Record<string, string> = {
  runtime: "#3b82f6",
  build: "#f59e0b",
  test: "#22c55e",
  api: "#a855f7",
  "api-call": "#a855f7",
  data: "#06b6d4",
  import: "#3b82f6",
  "shared-model": "#14b8a6",
  event: "#f97316",
  "event-consumer": "#f97316",
  "database-shared": "#06b6d4",
  "config-ref": "#71717a",
  grpc: "#6366f1",
  graphql: "#ec4899",
};

const riskTierBorder: Record<string, string> = {
  critical: "border-red-500",
  high: "border-orange-400",
  medium: "border-yellow-400",
  low: "border-green-500",
};

const riskTierGlow: Record<string, string> = {
  critical: "shadow-red-500/20",
  high: "shadow-orange-400/20",
  medium: "shadow-yellow-400/10",
  low: "shadow-green-500/10",
};

function repoName(uri: string, repos: Repo[]): string {
  const r = repos.find(r => r.uri === uri);
  return r?.name ?? uri.split("/").pop() ?? uri;
}

// ── Custom node for repos ──────────────────────────────────────────────────
function RepoNode({ data }: NodeProps) {
  const d = data as any;
  const risk = d.riskTier || "medium";
  return (
    <div
      className={cn(
        "px-4 py-3 bg-zinc-900 border-2 rounded-lg shadow-lg min-w-[140px] text-center",
        riskTierBorder[risk] || "border-zinc-600",
        riskTierGlow[risk] || "",
        "shadow-md"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-zinc-600 !w-2 !h-2 !border-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-zinc-600 !w-2 !h-2 !border-0" />
      <Handle type="target" position={Position.Left} className="!bg-zinc-600 !w-2 !h-2 !border-0" id="left" />
      <Handle type="source" position={Position.Right} className="!bg-zinc-600 !w-2 !h-2 !border-0" id="right" />
      <div className="flex items-center gap-2 justify-center">
        <Network size={14} className="text-blue-400 flex-shrink-0" />
        <span className="text-xs font-mono font-semibold text-zinc-100">{d.label}</span>
      </div>
      {d.description && (
        <p className="text-[9px] text-zinc-500 mt-1 leading-tight max-w-[180px]">{d.description}</p>
      )}
      <div className="flex gap-2 justify-center mt-2 text-[9px]">
        {d.riskTier && (
          <span className={cn(
            "px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider",
            risk === "critical" ? "bg-red-500/20 text-red-400" :
            risk === "high" ? "bg-orange-500/20 text-orange-400" :
            risk === "medium" ? "bg-yellow-500/20 text-yellow-400" :
            "bg-green-500/20 text-green-400"
          )}>
            {risk}
          </span>
        )}
        <span className="text-zinc-600">{d.outgoing}↑ {d.incoming}↓</span>
      </div>
    </div>
  );
}

const nodeTypes = { repo: RepoNode };

// ── Layout: arrange repos in a tiered architecture layout ──────────────────
function layoutNodes(repos: Repo[], repoDeps: RepoDep[], codeDeps: CodeDep[], profiles: Record<string, any>): Node[] {
  const tiers: Record<string, string[]> = {
    frontend: [],
    gateway: [],
    services: [],
    infrastructure: [],
  };

  for (const r of repos) {
    const name = r.name.toLowerCase();
    if (name.includes("portal") || name.includes("web") || name.includes("frontend") || name.includes("ui")) {
      tiers.frontend.push(r.name);
    } else if (name.includes("gateway") || name.includes("bff") || name.includes("proxy")) {
      tiers.gateway.push(r.name);
    } else if (name.includes("audit") || name.includes("notification") || name.includes("log") || name.includes("monitor")) {
      tiers.infrastructure.push(r.name);
    } else {
      tiers.services.push(r.name);
    }
  }

  const nodes: Node[] = [];
  const xSpacing = 220;
  const yPositions = { frontend: 0, gateway: 160, services: 340, infrastructure: 540 };

  for (const [tier, names] of Object.entries(tiers)) {
    const y = yPositions[tier as keyof typeof yPositions];
    const totalWidth = (names.length - 1) * xSpacing;
    const startX = -totalWidth / 2;

    names.forEach((name, i) => {
      const repo = repos.find(r => r.name === name);
      if (!repo) return;
      const profile = profiles[repo.uri] || {};
      const outgoing = repoDeps.filter(d => d.sourceRepo === repo.uri).length
        + codeDeps.filter(d => d.sourceRepo === repo.uri).length;
      const incoming = repoDeps.filter(d => d.targetRepo === repo.uri).length
        + codeDeps.filter(d => d.targetRepo === repo.uri).length;

      nodes.push({
        id: repo.uri,
        type: "repo",
        position: { x: startX + i * xSpacing, y },
        data: {
          label: repo.name,
          description: profile.description || "",
          riskTier: profile.riskTier || "medium",
          outgoing,
          incoming,
        },
      });
    });
  }

  return nodes;
}

function buildEdges(repoDeps: RepoDep[], codeDeps: CodeDep[], repos: Repo[], mode: "repo" | "code" | "all"): Edge[] {
  const edges: Edge[] = [];

  if (mode === "repo" || mode === "all") {
    for (const dep of repoDeps) {
      edges.push({
        id: `repo-${dep.id}`,
        source: dep.sourceRepo,
        target: dep.targetRepo,
        label: dep.dependencyType,
        type: "default",
        animated: dep.dependencyType === "event" || dep.dependencyType === "event-consumer",
        style: { stroke: depTypeColor[dep.dependencyType] || "#555", strokeWidth: 2 },
        labelStyle: { fontSize: 9, fill: "#999", fontFamily: "monospace" },
        labelBgStyle: { fill: "#18181b", fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
        markerEnd: { type: MarkerType.ArrowClosed, color: depTypeColor[dep.dependencyType] || "#555", width: 16, height: 16 },
        data: { collection: "sh.tangled.governance.graph.repoDependency", rkey: dep.id, description: dep.description, kind: "repo" },
      });
    }
  }

  if (mode === "code" || mode === "all") {
    for (const dep of codeDeps) {
      const label = dep.sourceLabel
        ? `${dep.sourceLabel} → ${dep.targetLabel || dep.targetPath}`
        : `${dep.sourcePath} → ${dep.targetPath}`;
      edges.push({
        id: `code-${dep.id}`,
        source: dep.sourceRepo,
        target: dep.targetRepo,
        label: label,
        type: "default",
        animated: dep.dependencyType === "event" || dep.dependencyType === "event-consumer",
        style: { stroke: depTypeColor[dep.dependencyType] || "#555", strokeWidth: 1, strokeDasharray: "4 2" },
        labelStyle: { fontSize: 8, fill: "#888", fontFamily: "monospace" },
        labelBgStyle: { fill: "#18181b", fillOpacity: 0.9 },
        labelBgPadding: [3, 1] as [number, number],
        markerEnd: { type: MarkerType.ArrowClosed, color: depTypeColor[dep.dependencyType] || "#555", width: 12, height: 12 },
        data: { collection: "sh.tangled.governance.graph.codeDependency", rkey: dep.id, description: dep.description, kind: "code" },
      });
    }
  }

  return edges;
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function GraphPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repoDeps, setRepoDeps] = useState<RepoDep[]>([]);
  const [codeDeps, setCodeDeps] = useState<CodeDep[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"repo" | "code" | "all">("all");
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [showAddCode, setShowAddCode] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [newRepoDep, setNewRepoDep] = useState({ sourceRepo: "", targetRepo: "", dependencyType: "api-call", description: "" });
  const [newCodeDep, setNewCodeDep] = useState({ sourceRepo: "", sourcePath: "", sourceLabel: "", targetRepo: "", targetPath: "", targetLabel: "", dependencyType: "api-call", description: "" });

  const loadGraph = useCallback(async () => {
    const data = await fetchGraph();
    if (!data) { setLoading(false); return; }

    const r = data.repos || [];
    const rd = data.repoDependencies || [];
    const cd = data.codeDependencies || [];
    setRepos(r);
    setRepoDeps(rd);
    setCodeDeps(cd);

    const profileMap: Record<string, any> = {};
    for (const repo of r) {
      const p = (data as any).repoProfiles?.[repo.uri];
      if (p) profileMap[repo.uri] = p;
    }
    setProfiles(profileMap);
    setLoading(false);
  }, []);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  useEffect(() => {
    if (repos.length === 0) return;
    const n = layoutNodes(repos, repoDeps, codeDeps, profiles);
    const e = buildEdges(repoDeps, codeDeps, repos, mode);
    setNodes(n);
    setEdges(e);
  }, [repos, repoDeps, codeDeps, profiles, mode, setNodes, setEdges]);

  const handleAddRepoDep = async () => {
    if (!newRepoDep.sourceRepo || !newRepoDep.targetRepo) return;
    await createRepoDependency(newRepoDep);
    setShowAddRepo(false);
    setNewRepoDep({ sourceRepo: "", targetRepo: "", dependencyType: "api-call", description: "" });
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
    setSelectedEdge(null);
    loadGraph();
  };

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    setSelectedEdge(edge);
  }, []);

  const legend = useMemo(() => {
    const types = new Set<string>();
    if (mode !== "code") repoDeps.forEach(d => types.add(d.dependencyType));
    if (mode !== "repo") codeDeps.forEach(d => types.add(d.dependencyType));
    return Array.from(types);
  }, [repoDeps, codeDeps, mode]);

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
      <div className="flex flex-col h-[calc(100vh-120px)]">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/60 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-semibold text-zinc-100">Dependency Map</h1>
            <div className="flex gap-1 bg-zinc-800 rounded p-0.5">
              {(["all", "repo", "code"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "px-3 py-1 text-[10px] font-medium rounded transition-colors",
                    mode === m ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {m === "all" ? "All" : m === "repo" ? "Repo" : "Code"}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-zinc-600">
              {repos.length} repos · {repoDeps.length} repo edges · {codeDeps.length} code edges
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowAddRepo(true)}
              className="flex items-center gap-1 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1.5 rounded transition-colors"
            >
              <GitBranch size={11} /> Repo Edge
            </button>
            <button
              onClick={() => setShowAddCode(true)}
              className="flex items-center gap-1 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1.5 rounded transition-colors"
            >
              <FileCode size={11} /> Code Edge
            </button>
          </div>
        </div>

        {/* Graph canvas */}
        <div className="flex-1 relative">
          {repos.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Network size={32} className="text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No repos found.</p>
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onEdgeClick={onEdgeClick}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              minZoom={0.3}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
              className="bg-zinc-950"
            >
              <Background color="#27272a" gap={20} size={1} />
              <Controls
                showInteractive={false}
                className="!bg-zinc-800 !border-zinc-700 !shadow-lg [&>button]:!bg-zinc-800 [&>button]:!border-zinc-700 [&>button]:!text-zinc-400 [&>button:hover]:!bg-zinc-700"
              />
              <MiniMap
                nodeColor="#3b82f6"
                maskColor="rgba(0,0,0,0.7)"
                className="!bg-zinc-900 !border-zinc-700"
              />
            </ReactFlow>
          )}

          {/* Legend */}
          {legend.length > 0 && (
            <div className="absolute bottom-4 left-4 bg-zinc-900/90 border border-zinc-800 rounded px-3 py-2 flex flex-wrap gap-3 z-10">
              {legend.map(type => (
                <div key={type} className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5 rounded" style={{ backgroundColor: depTypeColor[type] || "#555" }} />
                  <span className="text-[9px] text-zinc-400 font-mono">{type}</span>
                </div>
              ))}
            </div>
          )}

          {/* Edge detail panel */}
          {selectedEdge && (
            <div className="absolute top-4 right-4 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-72 z-10">
              <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  {(selectedEdge.data as any)?.kind === "code" ? "Code" : "Repo"} Edge
                </span>
                <button onClick={() => setSelectedEdge(null)} className="text-zinc-500 hover:text-zinc-300">
                  <X size={14} />
                </button>
              </div>
              <div className="px-3 py-3 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-zinc-200">{repoName(selectedEdge.source, repos)}</span>
                  <span className="text-zinc-600">→</span>
                  <span className="font-mono text-zinc-200">{repoName(selectedEdge.target, repos)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                    style={{ borderColor: depTypeColor[selectedEdge.label as string] || "#555", color: depTypeColor[selectedEdge.label as string] || "#999" }}
                  >
                    {selectedEdge.label}
                  </span>
                </div>
                {(selectedEdge.data as any)?.description && (
                  <p className="text-[11px] text-zinc-500">{(selectedEdge.data as any).description}</p>
                )}
                <button
                  onClick={() => handleDelete((selectedEdge.data as any).collection, (selectedEdge.data as any).rkey)}
                  className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 mt-2"
                >
                  <Trash2 size={11} /> Delete edge
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Add Repo Dependency Modal */}
        {showAddRepo && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-100">Add Repo Dependency</h3>
                <button onClick={() => setShowAddRepo(false)} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Source Repo</label>
                <select value={newRepoDep.sourceRepo} onChange={e => setNewRepoDep(p => ({ ...p, sourceRepo: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 font-mono rounded">
                  <option value="">Select repo...</option>
                  {repos.map(r => <option key={r.uri} value={r.uri}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Target Repo</label>
                <select value={newRepoDep.targetRepo} onChange={e => setNewRepoDep(p => ({ ...p, targetRepo: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 font-mono rounded">
                  <option value="">Select repo...</option>
                  {repos.map(r => <option key={r.uri} value={r.uri}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Type</label>
                <select value={newRepoDep.dependencyType} onChange={e => setNewRepoDep(p => ({ ...p, dependencyType: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 font-mono rounded">
                  {REPO_DEP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Description</label>
                <input value={newRepoDep.description} onChange={e => setNewRepoDep(p => ({ ...p, description: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 rounded" placeholder="Why does this dependency exist?" />
              </div>
              <button onClick={handleAddRepoDep} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium py-2 rounded transition-colors">
                Create Dependency
              </button>
            </div>
          </div>
        )}

        {/* Add Code Dependency Modal */}
        {showAddCode && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-100">Add Code Dependency</h3>
                <button onClick={() => setShowAddCode(false)} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Source Repo</label>
                  <select value={newCodeDep.sourceRepo} onChange={e => setNewCodeDep(p => ({ ...p, sourceRepo: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 font-mono rounded">
                    <option value="">Select...</option>
                    {repos.map(r => <option key={r.uri} value={r.uri}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Target Repo</label>
                  <select value={newCodeDep.targetRepo} onChange={e => setNewCodeDep(p => ({ ...p, targetRepo: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 font-mono rounded">
                    <option value="">Select...</option>
                    {repos.map(r => <option key={r.uri} value={r.uri}>{r.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Source Path</label>
                  <input value={newCodeDep.sourcePath} onChange={e => setNewCodeDep(p => ({ ...p, sourcePath: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 font-mono rounded" placeholder="main.py" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Target Path</label>
                  <input value={newCodeDep.targetPath} onChange={e => setNewCodeDep(p => ({ ...p, targetPath: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 font-mono rounded" placeholder="main.py" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Source Label</label>
                  <input value={newCodeDep.sourceLabel} onChange={e => setNewCodeDep(p => ({ ...p, sourceLabel: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 font-mono rounded" placeholder="handleLogin()" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Target Label</label>
                  <input value={newCodeDep.targetLabel} onChange={e => setNewCodeDep(p => ({ ...p, targetLabel: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 font-mono rounded" placeholder="verifyToken()" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Type</label>
                <select value={newCodeDep.dependencyType} onChange={e => setNewCodeDep(p => ({ ...p, dependencyType: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 font-mono rounded">
                  {CODE_DEP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-1">Description</label>
                <input value={newCodeDep.description} onChange={e => setNewCodeDep(p => ({ ...p, description: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3 py-2 rounded" placeholder="Explain the dependency..." />
              </div>
              <button onClick={handleAddCodeDep} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium py-2 rounded transition-colors">
                Create Code Dependency
              </button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
