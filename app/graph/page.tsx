"use client";

import { useState, useRef } from "react";
import {
  Network,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RiskBadge } from "@/components/compliance/RiskBadge";
import { mockDependencyGraph, mockRepos, mockPolicyPacks } from "@/lib/mock-data";
import { complianceStatusBg, cn } from "@/lib/utils";
import type { DependencyNode } from "@/types";

const nodeStatusColors: Record<string, string> = {
  compliant:       "#22c55e",
  "at-risk":       "#f59e0b",
  "non-compliant": "#ef4444",
  unknown:         "#71717a",
};

const nodeStatusRing: Record<string, string> = {
  compliant:       "#16a34a",
  "at-risk":       "#d97706",
  "non-compliant": "#dc2626",
  unknown:         "#52525b",
};

const edgeColors = {
  "depends-on":     "#3b82f6",
  "owned-by":       "#8b5cf6",
  "integrates-with":"#06b6d4",
};

const SVG_W = 700;
const SVG_H = 380;
const NODE_R = 22;
const LABEL_H = 14; // px below node center for label

type Positions = Record<string, { x: number; y: number }>;

export default function GraphPage() {
  const { nodes, edges } = mockDependencyGraph;

  const [selected, setSelected] = useState<DependencyNode | null>(null);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [positions, setPositions] = useState<Positions>(() =>
    Object.fromEntries(nodes.map((n) => [n.id, { x: n.x, y: n.y }]))
  );

  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const didDrag = useRef(false);

  function toSVGCoords(clientX: number, clientY: number) {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * SVG_W,
      y: ((clientY - rect.top) / rect.height) * SVG_H,
    };
  }

  function handleNodeMouseDown(e: React.MouseEvent, node: DependencyNode) {
    e.stopPropagation();
    e.preventDefault();
    const { x, y } = toSVGCoords(e.clientX, e.clientY);
    const pos = positions[node.id];
    dragging.current = { nodeId: node.id, offsetX: x - pos.x, offsetY: y - pos.y };
    didDrag.current = false;
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return;
    const { x, y } = toSVGCoords(e.clientX, e.clientY);
    const nx = Math.max(NODE_R + 4, Math.min(SVG_W - NODE_R - 4, x - dragging.current.offsetX));
    const ny = Math.max(NODE_R + 4, Math.min(SVG_H - NODE_R - LABEL_H - 4, y - dragging.current.offsetY));
    didDrag.current = true;
    setPositions((prev) => ({ ...prev, [dragging.current!.nodeId]: { x: nx, y: ny } }));
  }

  function handleMouseUp() {
    dragging.current = null;
  }

  function handleNodeClick(node: DependencyNode) {
    if (didDrag.current) return;
    const next = node === selected ? null : node;
    setSelected(next);
    if (next) {
      const connected = new Set<string>([node.id]);
      edges.forEach((e) => {
        if (e.source === node.id) connected.add(e.target);
        if (e.target === node.id) connected.add(e.source);
      });
      setHighlighted(connected);
    } else {
      setHighlighted(new Set());
    }
  }

  function handleBgClick() {
    setSelected(null);
    setHighlighted(new Set());
  }

  const selectedRepo = selected ? mockRepos.find((r) => r.id === selected.repoId) : null;
  const selectedPacks = selectedRepo ? mockPolicyPacks.filter((p) => selectedRepo.policyPacks.includes(p.id)) : [];
  const selectedEdges = selected
    ? edges.filter((e) => e.source === selected.id || e.target === selected.id)
    : [];

  return (
    <Shell breadcrumbs={[{ label: "Dependency Map" }]}>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Dependency Map</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Repository dependency graph with compliance status overlay
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral" size="sm">{nodes.length} nodes</Badge>
            <Badge variant="neutral" size="sm">{edges.length} edges</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
          {/* Graph */}
          <div className="xl:col-span-3">
            <Card padding={false}>
              {/* Legend */}
              <div className="px-4 py-2.5 border-b border-zinc-800/60 flex items-center gap-6 flex-wrap">
                <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Status:</span>
                {[
                  { status: "compliant",       label: "Compliant",     color: "#22c55e" },
                  { status: "at-risk",          label: "At Risk",       color: "#f59e0b" },
                  { status: "non-compliant",    label: "Non-Compliant", color: "#ef4444" },
                ].map((s) => (
                  <div key={s.status} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-[10px] text-zinc-400">{s.label}</span>
                  </div>
                ))}
                <span className="text-[10px] text-zinc-600 ml-2">Edges:</span>
                {Object.entries(edgeColors).map(([type, color]) => (
                  <div key={type} className="flex items-center gap-1.5">
                    <span className="w-6 h-0.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-[10px] text-zinc-500 capitalize">{type.replace(/-/g, " ")}</span>
                  </div>
                ))}
              </div>

              {/* SVG Graph */}
              <div className="p-4 select-none">
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                  className="w-full"
                  style={{ minWidth: 420, cursor: dragging.current ? "grabbing" : "default" }}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <defs>
                    <marker id="arrow-blue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L6,3 z" fill={edgeColors["depends-on"]} />
                    </marker>
                    <marker id="arrow-purple" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L6,3 z" fill={edgeColors["owned-by"]} />
                    </marker>
                    <marker id="arrow-cyan" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L6,3 z" fill={edgeColors["integrates-with"]} />
                    </marker>
                  </defs>

                  {/* Background click target */}
                  <rect width={SVG_W} height={SVG_H} fill="transparent" onClick={handleBgClick} />

                  {/* Grid dots */}
                  {Array.from({ length: 7 }).map((_, row) =>
                    Array.from({ length: 13 }).map((_, col) => (
                      <circle key={`${row}-${col}`} cx={col * 58 + 22} cy={row * 58 + 22} r={1} fill="#27272a" />
                    ))
                  )}

                  {/* Edges — drawn first so nodes sit on top */}
                  {edges.map((edge) => {
                    const sp = positions[edge.source];
                    const tp = positions[edge.target];
                    if (!sp || !tp) return null;

                    const isHighlighted = highlighted.size === 0 ||
                      (highlighted.has(edge.source) && highlighted.has(edge.target));

                    const dx = tp.x - sp.x;
                    const dy = tp.y - sp.y;
                    const len = Math.sqrt(dx * dx + dy * dy) || 1;
                    const startX = sp.x + (dx / len) * NODE_R;
                    const startY = sp.y + (dy / len) * NODE_R;
                    const endX   = tp.x - (dx / len) * (NODE_R + 6);
                    const endY   = tp.y - (dy / len) * (NODE_R + 6);

                    const markerMap = {
                      "depends-on":     "arrow-blue",
                      "owned-by":       "arrow-purple",
                      "integrates-with":"arrow-cyan",
                    };

                    return (
                      <line
                        key={edge.id}
                        x1={startX} y1={startY}
                        x2={endX}   y2={endY}
                        stroke={edgeColors[edge.type]}
                        strokeWidth={edge.critical ? 2 : 1.5}
                        strokeDasharray={edge.type === "integrates-with" ? "4 3" : undefined}
                        strokeOpacity={isHighlighted ? 0.8 : 0.12}
                        markerEnd={`url(#${markerMap[edge.type]})`}
                        style={{ transition: "stroke-opacity 0.15s" }}
                      />
                    );
                  })}

                  {/* Nodes */}
                  {nodes.map((node) => {
                    const pos = positions[node.id];
                    const isSelected = selected?.id === node.id;
                    const isDimmed = highlighted.size > 0 && !highlighted.has(node.id);
                    const fillColor = nodeStatusColors[node.complianceStatus];
                    const ringColor = nodeStatusRing[node.complianceStatus];

                    return (
                      <g
                        key={node.id}
                        transform={`translate(${pos.x}, ${pos.y})`}
                        style={{ opacity: isDimmed ? 0.25 : 1, cursor: "grab" }}
                        onMouseDown={(e) => handleNodeMouseDown(e, node)}
                        onClick={() => handleNodeClick(node)}
                      >
                        {/* Selection ring */}
                        {isSelected && (
                          <circle r={NODE_R + 6} fill="none" stroke={fillColor} strokeWidth={1.5} strokeDasharray="4 2" opacity={0.7} />
                        )}

                        {/* Node background */}
                        <circle r={NODE_R} fill="#18181b" stroke={ringColor} strokeWidth={isSelected ? 2.5 : 1.5} />

                        {/* Fill tint */}
                        <circle r={NODE_R - 2} fill={fillColor} opacity={0.12} />

                        {/* Status icon */}
                        {node.complianceStatus === "compliant"     && <text x={0} y={5} textAnchor="middle" fontSize={13} fill="#22c55e">✓</text>}
                        {node.complianceStatus === "at-risk"        && <text x={0} y={5} textAnchor="middle" fontSize={13} fill="#f59e0b">⚠</text>}
                        {node.complianceStatus === "non-compliant"  && <text x={0} y={5} textAnchor="middle" fontSize={13} fill="#ef4444">✕</text>}

                        {/* Label */}
                        <text
                          y={NODE_R + 12}
                          textAnchor="middle"
                          fontSize={9}
                          fontFamily="monospace"
                          fill={isSelected ? "#e4e4e7" : "#a1a1aa"}
                          fontWeight={isSelected ? "600" : "400"}
                        >
                          {node.label}
                        </text>

                        {/* Critical badge */}
                        {node.critical && (
                          <circle cx={16} cy={-16} r={5} fill="#ef4444" opacity={0.9} />
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="px-4 py-2 border-t border-zinc-800/60 flex items-center gap-2">
                <Info size={11} className="text-zinc-600" />
                <span className="text-[10px] text-zinc-600">
                  Drag nodes to rearrange · Click to select and highlight connections · Red dot = critical path
                </span>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {selected && selectedRepo ? (
              <>
                <Card>
                  <CardHeader
                    title={selected.label}
                    description="Repository details"
                    action={<RiskBadge tier={selected.riskTier} size="sm" />}
                  />
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-zinc-800/50">
                      <span className="text-zinc-500">Status</span>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded border font-mono", complianceStatusBg(selected.complianceStatus))}>
                        {selected.complianceStatus}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-zinc-800/50">
                      <span className="text-zinc-500">Data Class</span>
                      <Badge variant="neutral" size="sm" className="capitalize">{selectedRepo.dataClassification}</Badge>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-zinc-800/50">
                      <span className="text-zinc-500">Language</span>
                      <span className="text-zinc-300">{selectedRepo.language}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-zinc-800/50">
                      <span className="text-zinc-500">Open PRs</span>
                      <span className="text-zinc-300 font-mono">{selectedRepo.openPRs}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-zinc-500">Critical Path</span>
                      {selected.critical ? (
                        <Badge variant="danger" size="sm">Yes</Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">No</Badge>
                      )}
                    </div>
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Connections" description={`${selectedEdges.length} edges`} />
                  <div className="space-y-1.5">
                    {selectedEdges.map((edge) => {
                      const otherId = edge.source === selected.id ? edge.target : edge.source;
                      const other = nodes.find((n) => n.id === otherId);
                      const direction = edge.source === selected.id ? "→" : "←";
                      return (
                        <div key={edge.id} className="flex items-center gap-2 p-2 bg-zinc-800/40 border border-zinc-800/50">
                          <span className="text-zinc-500 font-mono text-sm">{direction}</span>
                          <span className="text-[10px] font-mono text-zinc-200 flex-1">{other?.label}</span>
                          <span className="text-[9px] font-mono" style={{ color: edgeColors[edge.type] }}>
                            {edge.type.replace(/-/g, " ")}
                          </span>
                          {edge.critical && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                        </div>
                      );
                    })}
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Policy Packs" />
                  <div className="flex flex-wrap gap-1">
                    {selectedPacks.map((p) => (
                      <Badge key={p.id} variant="info" size="sm">{p.framework}</Badge>
                    ))}
                  </div>
                </Card>
              </>
            ) : (
              <Card className="flex flex-col items-center py-10 text-center">
                <Network size={28} className="text-zinc-700 mb-3" />
                <p className="text-sm text-zinc-500 font-medium mb-1">Select a node</p>
                <p className="text-xs text-zinc-600">Click any repository to view details and connections</p>
              </Card>
            )}

            <Card>
              <CardHeader title="Graph Summary" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle size={12} className="text-green-400" />
                  <span className="text-xs text-zinc-400 flex-1">Compliant</span>
                  <span className="text-xs font-mono text-green-400">{nodes.filter((n) => n.complianceStatus === "compliant").length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={12} className="text-amber-400" />
                  <span className="text-xs text-zinc-400 flex-1">At Risk</span>
                  <span className="text-xs font-mono text-amber-400">{nodes.filter((n) => n.complianceStatus === "at-risk").length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle size={12} className="text-red-400" />
                  <span className="text-xs text-zinc-400 flex-1">Non-Compliant</span>
                  <span className="text-xs font-mono text-red-400">{nodes.filter((n) => n.complianceStatus === "non-compliant").length}</span>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-xs text-zinc-400 flex-1">Critical path nodes</span>
                  <span className="text-xs font-mono text-red-400">{nodes.filter((n) => n.critical).length}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Shell>
  );
}
