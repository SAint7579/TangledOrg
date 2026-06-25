"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ReactFlow,
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
import { Network, ArrowRight } from "lucide-react";
import { fetchGraph } from "@/lib/api";
import { useTheme } from "@/components/theme/ThemeProvider";

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

function PreviewNode({ data }: NodeProps) {
  const d = data as { label: string; borderColor?: string };
  return (
    <div
      className="px-2 py-1 rounded border text-center"
      style={{
        borderColor: d.borderColor ?? "#3b82f6",
        backgroundColor: "var(--node-bg)",
        minWidth: 80,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 0, height: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 0, height: 0 }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 0, height: 0 }} id="left" />
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 0, height: 0 }} id="right" />
      <span className="text-[9px] font-mono font-medium truncate block max-w-[100px]" style={{ color: "var(--node-text)" }}>{d.label}</span>
    </div>
  );
}

const nodeTypes = { repo: PreviewNode };

function layoutNodes(repos: any[], repoDeps: any[], codeDeps: any[], profiles: Record<string, any>): Node[] {
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
  const xSpacing = 160;
  const yPositions: Record<string, number> = { frontend: 0, gateway: 110, services: 220, infrastructure: 330 };

  for (const [tier, names] of Object.entries(tiers)) {
    const y = yPositions[tier];
    const totalWidth = (names.length - 1) * xSpacing;
    const startX = -totalWidth / 2;
    names.forEach((name, i) => {
      const repo = repos.find((r: any) => r.name === name);
      if (!repo) return;
      const profile = profiles[repo.uri] || {};
      nodes.push({
        id: repo.uri,
        type: "repo",
        position: { x: startX + i * xSpacing, y },
        data: {
          label: repo.name,
          borderColor: riskBorderColor[profile.riskTier ?? "medium"] ?? "#71717a",
        },
      });
    });
  }
  return nodes;
}

function buildEdges(repoDeps: any[]): Edge[] {
  return repoDeps.map((dep: any) => ({
    id: `repo-${dep.id}`,
    source: dep.sourceRepo,
    target: dep.targetRepo,
    type: "default",
    style: { stroke: depTypeColor[dep.dependencyType] || "#555", strokeWidth: 1.5 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: depTypeColor[dep.dependencyType] || "#555",
      width: 12,
      height: 12,
    },
  }));
}

export function GraphPreview() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    fetchGraph()
      .then((data) => {
        if (!data) { setLoading(false); return; }
        const repos = data.repos || [];
        const repoDeps = data.repoDependencies || [];
        const codeDeps = data.codeDependencies || [];
        const profileMap: Record<string, any> = {};
        for (const repo of repos) {
          const p = (data as any).repoProfiles?.[repo.uri];
          if (p) profileMap[repo.uri] = p;
        }
        setNodes(layoutNodes(repos, repoDeps, codeDeps, profileMap));
        setEdges(buildEdges(repoDeps));
        setHasData(repos.length > 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isDark]);

  if (loading) {
    return (
      <div className="h-44 flex items-center justify-center">
        <span className="text-xs animate-pulse" style={{ color: "var(--text-muted)" }}>Loading…</span>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="h-44 flex flex-col items-center justify-center gap-2">
        <Network size={24} className="text-zinc-700" />
        <span className="text-xs text-zinc-600">No graph data yet</span>
        <Link href="/graph" className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 mt-1">
          <Network size={10} /> Open graph <ArrowRight size={9} />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="rounded overflow-hidden"
        style={{ height: 176, backgroundColor: isDark ? "rgb(18,18,20)" : "rgb(240,240,240)" }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      <Link
        href="/graph"
        className="flex items-center gap-1.5 text-[10px] text-blue-400 hover:text-blue-300"
      >
        <Network size={10} /> View full graph <ArrowRight size={9} />
      </Link>
    </div>
  );
}
