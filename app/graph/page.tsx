"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Shell } from "@/components/layout/Shell";
import { fetchGraph, createRepoDependency, createCodeDependency, deleteGraphEdge } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Plus, Trash2, GitBranch, FileCode, X, Network } from "lucide-react";
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
import { useTheme } from "@/components/theme/ThemeProvider";

type Repo    = { id: string; uri: string; name: string };
type RepoDep = { id: string; uri: string; sourceRepo: string; targetRepo: string; dependencyType: string; description?: string };
type CodeDep = { id: string; uri: string; sourceRepo: string; sourcePath: string; sourceLabel?: string; targetRepo: string; targetPath: string; targetLabel?: string; dependencyType: string; description?: string };

const REPO_DEP_TYPES = ["runtime", "build", "test", "api-call", "api", "data", "event"];
const CODE_DEP_TYPES = ["api-call", "import", "shared-model", "event", "event-consumer", "database-shared", "config-ref", "grpc", "graphql"];

const depTypeColor: Record<string, string> = {
  runtime: "#3b82f6", build: "#f59e0b", test: "#22c55e",
  api: "#a855f7", "api-call": "#a855f7", data: "#06b6d4",
  import: "#3b82f6", "shared-model": "#14b8a6",
  event: "#f97316", "event-consumer": "#f97316",
  "database-shared": "#06b6d4", "config-ref": "#71717a",
  grpc: "#6366f1", graphql: "#ec4899",
};

const riskBorderColor: Record<string, string> = {
  critical: "#ef4444", high: "#fb923c", medium: "#facc15", low: "#22c55e",
};

function repoName(uri: string, repos: Repo[]): string {
  const r = repos.find(r => r.uri === uri);
  return r?.name ?? uri.split("/").pop() ?? uri;
}

// ── Custom repo node ─────────────────────────────────────────────────────────
function RepoNode({ data }: NodeProps) {
  const d = data as any;
  const risk = d.riskTier || "medium";
  const borderColor = riskBorderColor[risk] ?? "#71717a";

  const riskBg: Record<string, string> = {
    critical: "rgba(239,68,68,0.12)",
    high: "rgba(251,146,60,0.12)",
    medium: "rgba(250,204,21,0.1)",
    low: "rgba(34,197,94,0.1)",
  };

  return (
    <div
      className="px-4 py-3 rounded-lg shadow-md min-w-[140px] text-center border-2"
      style={{ borderColor, backgroundColor: "var(--node-bg)" }}
    >
      <Handle type="target" position={Position.Top}    style={{ background: "var(--text-muted)", width: 8, height: 8, border: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "var(--text-muted)", width: 8, height: 8, border: 0 }} />
      <Handle type="target" position={Position.Left}   style={{ background: "var(--text-muted)", width: 8, height: 8, border: 0 }} id="left" />
      <Handle type="source" position={Position.Right}  style={{ background: "var(--text-muted)", width: 8, height: 8, border: 0 }} id="right" />

      <div className="flex items-center gap-2 justify-center">
        <Network size={14} style={{ color: "#93c5fd", flexShrink: 0 }} />
        <span className="text-xs font-mono font-semibold" style={{ color: "var(--node-text)" }}>
          {d.label}
        </span>
      </div>

      {d.description && (
        <p className="text-[9px] mt-1 leading-tight max-w-[180px]" style={{ color: "var(--text-muted)" }}>
          {d.description}
        </p>
      )}

      <div className="flex gap-2 justify-center mt-2 text-[9px]">
        {d.riskTier && (
          <span
            className="px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider"
            style={{ backgroundColor: riskBg[risk] ?? "transparent", color: borderColor }}
          >
            {risk}
          </span>
        )}
        <span style={{ color: "var(--text-muted)" }}>{d.outgoing}↑ {d.incoming}↓</span>
      </div>
    </div>
  );
}

const nodeTypes = { repo: RepoNode };

// ── Layout ───────────────────────────────────────────────────────────────────
function layoutNodes(repos: Repo[], repoDeps: RepoDep[], codeDeps: CodeDep[], profiles: Record<string, any>): Node[] {
  const tiers: Record<string, string[]> = { frontend: [], gateway: [], services: [], infrastructure: [] };

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
  const xSpacing  = 220;
  const yPositions: Record<string, number> = { frontend: 0, gateway: 160, services: 340, infrastructure: 540 };

  for (const [tier, names] of Object.entries(tiers)) {
    const y = yPositions[tier];
    const totalWidth = (names.length - 1) * xSpacing;
    const startX = -totalWidth / 2;

    names.forEach((name, i) => {
      const repo = repos.find(r => r.name === name);
      if (!repo) return;
      const profile = profiles[repo.uri] || {};
      const outgoing = repoDeps.filter(d => d.sourceRepo === repo.uri).length + codeDeps.filter(d => d.sourceRepo === repo.uri).length;
      const incoming = repoDeps.filter(d => d.targetRepo === repo.uri).length + codeDeps.filter(d => d.targetRepo === repo.uri).length;

      nodes.push({
        id: repo.uri,
        type: "repo",
        position: { x: startX + i * xSpacing, y },
        data: { label: repo.name, description: profile.description || "", riskTier: profile.riskTier || "medium", outgoing, incoming },
      });
    });
  }
  return nodes;
}

function buildEdges(repoDeps: RepoDep[], codeDeps: CodeDep[], repos: Repo[], mode: "repo" | "code" | "all", isDark: boolean): Edge[] {
  const edges: Edge[] = [];
  const labelFill = isDark ? "#18181b" : "rgb(230,230,230)";
  const labelTextColor = isDark ? "#999" : "rgba(21,21,26,0.6)";

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
        labelStyle: { fontSize: 9, fill: labelTextColor, fontFamily: "Tahoma, sans-serif" },
        labelBgStyle: { fill: labelFill, fillOpacity: 0.92 },
        labelBgPadding: [4, 2] as [number, number],
        markerEnd: { type: MarkerType.ArrowClosed, color: depTypeColor[dep.dependencyType] || "#555", width: 16, height: 16 },
        data: { collection: "sh.tangled.governance.graph.repoDependency", rkey: dep.id, description: dep.description, kind: "repo" },
      });
    }
  }

  if (mode === "code" || mode === "all") {
    for (const dep of codeDeps) {
      const label = dep.sourceLabel ? `${dep.sourceLabel} → ${dep.targetLabel || dep.targetPath}` : `${dep.sourcePath} → ${dep.targetPath}`;
      edges.push({
        id: `code-${dep.id}`,
        source: dep.sourceRepo,
        target: dep.targetRepo,
        label,
        type: "default",
        animated: dep.dependencyType === "event" || dep.dependencyType === "event-consumer",
        style: { stroke: depTypeColor[dep.dependencyType] || "#555", strokeWidth: 1, strokeDasharray: "4 2" },
        labelStyle: { fontSize: 8, fill: labelTextColor, fontFamily: "Tahoma, sans-serif" },
        labelBgStyle: { fill: labelFill, fillOpacity: 0.92 },
        labelBgPadding: [3, 1] as [number, number],
        markerEnd: { type: MarkerType.ArrowClosed, color: depTypeColor[dep.dependencyType] || "#555", width: 12, height: 12 },
        data: { collection: "sh.tangled.governance.graph.codeDependency", rkey: dep.id, description: dep.description, kind: "code" },
      });
    }
  }

  return edges;
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function GraphPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [repos, setRepos]       = useState<Repo[]>([]);
  const [repoDeps, setRepoDeps] = useState<RepoDep[]>([]);
  const [codeDeps, setCodeDeps] = useState<CodeDep[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading]   = useState(true);
  const [mode, setMode]         = useState<"repo" | "code" | "all">("all");
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
    const r  = data.repos || [];
    const rd = data.repoDependencies || [];
    const cd = data.codeDependencies || [];
    setRepos(r); setRepoDeps(rd); setCodeDeps(cd);
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
    setNodes(layoutNodes(repos, repoDeps, codeDeps, profiles));
    setEdges(buildEdges(repoDeps, codeDeps, repos, mode, isDark));
  }, [repos, repoDeps, codeDeps, profiles, mode, isDark, setNodes, setEdges]);

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

  const onEdgeClick = useCallback((_: any, edge: Edge) => { setSelectedEdge(edge); }, []);

  const legend = useMemo(() => {
    const types = new Set<string>();
    if (mode !== "code") repoDeps.forEach(d => types.add(d.dependencyType));
    if (mode !== "repo") codeDeps.forEach(d => types.add(d.dependencyType));
    return Array.from(types);
  }, [repoDeps, codeDeps, mode]);

  // Shared inline style helpers
  const panelStyle: React.CSSProperties = {
    backgroundColor: "var(--panel-bg)",
    borderColor: "var(--panel-border)",
    color: "var(--text-primary)",
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: "var(--input-bg)",
    borderColor: "var(--border-subtle)",
    color: "var(--text-primary)",
  };

  const labelStyle: React.CSSProperties = { color: "var(--text-muted)" };

  if (loading) {
    return (
      <Shell breadcrumbs={[{ label: "Dependency Map" }]}>
        <div className="flex items-center justify-center h-64">
          <span className="text-sm animate-pulse" style={{ color: "var(--text-muted)" }}>Loading graph…</span>
        </div>
      </Shell>
    );
  }

  return (
    <Shell breadcrumbs={[{ label: "Dependency Map" }]}>
      <div className="flex flex-col h-[calc(100vh-120px)]">

        {/* ── Toolbar ─────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
          style={{ backgroundColor: "var(--panel-bg)", borderColor: "var(--panel-border)" }}
        >
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Dependency Map</h1>

            {/* Mode tabs */}
            <div className="flex gap-0.5 rounded p-0.5" style={{ backgroundColor: "var(--hover-bg)" }}>
              {(["all", "repo", "code"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="px-3 py-1 text-[10px] font-medium rounded transition-colors"
                  style={mode === m
                    ? { backgroundColor: "#8b5cf6", color: "white" }
                    : { color: "var(--text-secondary)" }
                  }
                >
                  {m === "all" ? "All" : m === "repo" ? "Repo" : "Code"}
                </button>
              ))}
            </div>

            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {repos.length} repos · {repoDeps.length} repo edges · {codeDeps.length} code edges
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowAddRepo(true)}
              className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded border transition-colors"
              style={{ ...panelStyle, borderColor: "var(--border-subtle)" }}
            >
              <GitBranch size={11} /> Repo Edge
            </button>
            <button
              onClick={() => setShowAddCode(true)}
              className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded border transition-colors"
              style={{ ...panelStyle, borderColor: "var(--border-subtle)" }}
            >
              <FileCode size={11} /> Code Edge
            </button>
          </div>
        </div>

        {/* ── Graph canvas ─────────────────────────────────────── */}
        <div className="flex-1 relative">
          {repos.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Network size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No repos found.</p>
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
              style={{ backgroundColor: "var(--graph-bg)" }}
            >
              <Background color={isDark ? "#27272a" : "rgba(21,21,26,0.09)"} gap={20} size={1} />
              <Controls
                showInteractive={false}
                style={{
                  backgroundColor: "var(--panel-bg)",
                  border: "1px solid var(--panel-border)",
                }}
              />
              <MiniMap
                nodeColor={(n) => riskBorderColor[(n.data as any)?.riskTier ?? "medium"] ?? "#71717a"}
                maskColor={isDark ? "rgba(0,0,0,0.6)" : "rgba(230,230,230,0.5)"}
                style={{ backgroundColor: "var(--panel-bg)", border: "1px solid var(--panel-border)" }}
              />
            </ReactFlow>
          )}

          {/* Legend */}
          {legend.length > 0 && (
            <div
              className="absolute bottom-4 left-4 rounded border px-3 py-2 flex flex-wrap gap-3 z-10"
              style={{ backgroundColor: "var(--panel-bg)", borderColor: "var(--panel-border)" }}
            >
              {legend.map(type => (
                <div key={type} className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5 rounded" style={{ backgroundColor: depTypeColor[type] || "#555" }} />
                  <span className="text-[9px] font-mono" style={{ color: "var(--text-secondary)" }}>{type}</span>
                </div>
              ))}
            </div>
          )}

          {/* Edge detail panel */}
          {selectedEdge && (
            <div
              className="absolute top-4 right-4 rounded-lg shadow-xl w-72 z-10 border"
              style={panelStyle}
            >
              <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "var(--panel-border)" }}>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                  {(selectedEdge.data as any)?.kind === "code" ? "Code" : "Repo"} Edge
                </span>
                <button onClick={() => setSelectedEdge(null)} style={{ color: "var(--text-muted)" }}>
                  <X size={14} />
                </button>
              </div>
              <div className="px-3 py-3 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono" style={{ color: "var(--text-primary)" }}>{repoName(selectedEdge.source, repos)}</span>
                  <span style={{ color: "var(--text-muted)" }}>→</span>
                  <span className="font-mono" style={{ color: "var(--text-primary)" }}>{repoName(selectedEdge.target, repos)}</span>
                </div>
                <div>
                  <span
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                    style={{ borderColor: depTypeColor[selectedEdge.label as string] || "#555", color: depTypeColor[selectedEdge.label as string] || "var(--text-muted)" }}
                  >
                    {selectedEdge.label}
                  </span>
                </div>
                {(selectedEdge.data as any)?.description && (
                  <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{(selectedEdge.data as any).description}</p>
                )}
                <button
                  onClick={() => handleDelete((selectedEdge.data as any).collection, (selectedEdge.data as any).rkey)}
                  className="flex items-center gap-1 text-[10px] mt-2"
                  style={{ color: "var(--badge-danger-text)" }}
                >
                  <Trash2 size={11} /> Delete edge
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Add Repo Dependency Modal ─────────────────────────── */}
        {showAddRepo && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="rounded-lg w-full max-w-md p-6 space-y-4 border shadow-xl" style={panelStyle}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Add Repo Dependency</h3>
                <button onClick={() => setShowAddRepo(false)} style={{ color: "var(--text-muted)" }}><X size={16} /></button>
              </div>
              {(["Source Repo", "Target Repo"] as const).map((lbl, i) => (
                <div key={lbl}>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] mb-1" style={labelStyle}>{lbl}</label>
                  <select
                    value={i === 0 ? newRepoDep.sourceRepo : newRepoDep.targetRepo}
                    onChange={e => setNewRepoDep(p => ({ ...p, [i === 0 ? "sourceRepo" : "targetRepo"]: e.target.value }))}
                    className="w-full text-xs px-3 py-2 font-mono rounded border"
                    style={inputStyle}
                  >
                    <option value="">Select repo…</option>
                    {repos.map(r => <option key={r.uri} value={r.uri}>{r.name}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] mb-1" style={labelStyle}>Type</label>
                <select value={newRepoDep.dependencyType} onChange={e => setNewRepoDep(p => ({ ...p, dependencyType: e.target.value }))}
                  className="w-full text-xs px-3 py-2 font-mono rounded border" style={inputStyle}>
                  {REPO_DEP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] mb-1" style={labelStyle}>Description</label>
                <input value={newRepoDep.description} onChange={e => setNewRepoDep(p => ({ ...p, description: e.target.value }))}
                  className="w-full text-xs px-3 py-2 rounded border" style={inputStyle} placeholder="Why does this dependency exist?" />
              </div>
              <button onClick={handleAddRepoDep}
                className="w-full text-white text-xs font-medium py-2 rounded transition-colors"
                style={{ backgroundColor: "#8b5cf6" }}>
                Create Dependency
              </button>
            </div>
          </div>
        )}

        {/* ── Add Code Dependency Modal ─────────────────────────── */}
        {showAddCode && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="rounded-lg w-full max-w-lg p-6 space-y-4 border shadow-xl" style={panelStyle}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Add Code Dependency</h3>
                <button onClick={() => setShowAddCode(false)} style={{ color: "var(--text-muted)" }}><X size={16} /></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {(["Source Repo", "Target Repo"] as const).map((lbl, i) => (
                  <div key={lbl}>
                    <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] mb-1" style={labelStyle}>{lbl}</label>
                    <select
                      value={i === 0 ? newCodeDep.sourceRepo : newCodeDep.targetRepo}
                      onChange={e => setNewCodeDep(p => ({ ...p, [i === 0 ? "sourceRepo" : "targetRepo"]: e.target.value }))}
                      className="w-full text-xs px-3 py-2 font-mono rounded border" style={inputStyle}>
                      <option value="">Select…</option>
                      {repos.map(r => <option key={r.uri} value={r.uri}>{r.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { lbl: "Source Path", key: "sourcePath", ph: "main.py" },
                  { lbl: "Target Path", key: "targetPath", ph: "main.py" },
                ].map(({ lbl, key, ph }) => (
                  <div key={key}>
                    <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] mb-1" style={labelStyle}>{lbl}</label>
                    <input value={(newCodeDep as any)[key]} onChange={e => setNewCodeDep(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full text-xs px-3 py-2 font-mono rounded border" style={inputStyle} placeholder={ph} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { lbl: "Source Label", key: "sourceLabel", ph: "handleLogin()" },
                  { lbl: "Target Label", key: "targetLabel", ph: "verifyToken()" },
                ].map(({ lbl, key, ph }) => (
                  <div key={key}>
                    <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] mb-1" style={labelStyle}>{lbl}</label>
                    <input value={(newCodeDep as any)[key]} onChange={e => setNewCodeDep(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full text-xs px-3 py-2 font-mono rounded border" style={inputStyle} placeholder={ph} />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] mb-1" style={labelStyle}>Type</label>
                <select value={newCodeDep.dependencyType} onChange={e => setNewCodeDep(p => ({ ...p, dependencyType: e.target.value }))}
                  className="w-full text-xs px-3 py-2 font-mono rounded border" style={inputStyle}>
                  {CODE_DEP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] mb-1" style={labelStyle}>Description</label>
                <input value={newCodeDep.description} onChange={e => setNewCodeDep(p => ({ ...p, description: e.target.value }))}
                  className="w-full text-xs px-3 py-2 rounded border" style={inputStyle} placeholder="Explain the dependency…" />
              </div>
              <button onClick={handleAddCodeDep}
                className="w-full text-white text-xs font-medium py-2 rounded transition-colors"
                style={{ backgroundColor: "#8b5cf6" }}>
                Create Code Dependency
              </button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
