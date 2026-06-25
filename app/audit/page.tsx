"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Search,
  Filter,
  Cpu,
  ShieldAlert,
  FileCheck,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ScanSearch,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RiskBadge } from "@/components/compliance/RiskBadge";
import { fetchAudit } from "@/lib/api";
import { formatDateTime, formatRelativeTime, cn } from "@/lib/utils";

type AuditType = "agent-run" | "evidence" | "waiver" | "incident" | "scan" | "all";

const typeIcons: Record<string, React.ElementType> = {
  "agent-run": Cpu,
  evidence: FileCheck,
  waiver: ShieldAlert,
  incident: ShieldAlert,
  scan: Cpu,
};

const typeLabels: Record<string, string> = {
  "agent-run": "Agent Run",
  evidence: "Evidence",
  waiver: "Waiver",
  incident: "Incident",
  scan: "AI Scan",
};

const typeColors: Record<string, string> = {
  "agent-run": "bg-blue-500/10 text-blue-400",
  evidence: "bg-green-500/10 text-green-400",
  waiver: "bg-amber-500/10 text-amber-400",
  incident: "bg-red-500/10 text-red-400",
  scan: "bg-purple-500/10 text-purple-400",
};

const allTypes: AuditType[] = ["scan", "incident", "agent-run", "evidence", "waiver"];

export default function AuditPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<AuditType>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchAudit().then((res) => {
      setData(res);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <Shell breadcrumbs={[{ label: "Audit Log" }]}>
        <div className="flex items-center justify-center h-64">
          <span className="text-zinc-500 text-sm animate-pulse">Loading...</span>
        </div>
      </Shell>
    );
  }

  const entries = data?.entries ?? [];

  const filtered = entries
    .filter((e: any) => typeFilter === "all" || e.type === typeFilter)
    .filter((e: any) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (e.description ?? "").toLowerCase().includes(q) ||
        (e.actorHandle ?? "").toLowerCase().includes(q) ||
        (e.targetLabel ?? "").toLowerCase().includes(q)
      );
    });

  return (
    <Shell breadcrumbs={[{ label: "Audit Log" }]}>
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Audit Log</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Immutable record of compliance events and agent runs
            </p>
          </div>
          <Badge variant="info" size="sm">
            {entries.length} entries
          </Badge>
        </div>

        <Card className="flex items-center gap-3 flex-wrap">
          <div className="relative flex items-center flex-1 min-w-[160px]">
            <Search size={13} className="absolute left-2.5 text-zinc-600" />
            <input
              type="text"
              placeholder="Search entries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md pl-8 pr-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter size={12} className="text-zinc-600" />
            <button
              onClick={() => setTypeFilter("all")}
              className={cn(
                "text-[10px] px-2 py-1 rounded font-mono font-medium border transition-colors",
                typeFilter === "all"
                  ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                  : "bg-transparent text-zinc-500 border-zinc-700 hover:border-zinc-600 hover:text-zinc-300"
              )}
            >
              All
            </button>
            {allTypes.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "text-[10px] px-2 py-1 rounded font-mono font-medium border transition-colors",
                  typeFilter === t
                    ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                    : "bg-transparent text-zinc-500 border-zinc-700 hover:border-zinc-600 hover:text-zinc-300"
                )}
              >
                {typeLabels[t]}
              </button>
            ))}
          </div>
        </Card>

        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-zinc-800" />

          <div className="space-y-2">
            {filtered.length === 0 ? (
              <Card className="text-center py-12 ml-12">
                <Activity size={28} className="text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">
                  No entries match your filters.
                </p>
              </Card>
            ) : (
              filtered.map((entry: any, idx: number) => {
                const TypeIcon =
                  typeIcons[entry.type] ?? Activity;
                const colorClass =
                  typeColors[entry.type] ?? "bg-zinc-800 text-zinc-400";
                const bgColor = colorClass.split(" ").find((c: string) => c.startsWith("bg-")) ?? "bg-zinc-800";
                const textColor = colorClass.split(" ").find((c: string) => c.startsWith("text-")) ?? "text-zinc-400";
                const isScan = entry.type === "scan";
                const isExpanded = expandedId === (entry.id ?? idx);
                const scanFindings = isScan && entry.findingsJson ? (() => { try { return JSON.parse(entry.findingsJson); } catch { return []; } })() : [];

                return (
                  <div key={entry.id ?? idx} className="flex items-start gap-4">
                    <div
                      className={cn(
                        "relative z-10 flex items-center justify-center w-12 h-12 rounded-full flex-shrink-0",
                        bgColor
                      )}
                    >
                      {isScan ? <ScanSearch size={16} className={textColor} /> : <TypeIcon size={16} className={textColor} />}
                    </div>

                    <Card className="flex-1 py-0 px-0 overflow-hidden">
                      <button
                        onClick={() => isScan ? setExpandedId(isExpanded ? null : (entry.id ?? idx)) : undefined}
                        className={cn(
                          "w-full text-left py-3 px-4",
                          isScan && "hover:bg-zinc-800/30 cursor-pointer transition-colors"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {isScan && (
                                isExpanded
                                  ? <ChevronDown size={12} className="text-zinc-500" />
                                  : <ChevronRight size={12} className="text-zinc-500" />
                              )}
                              <span
                                className={cn(
                                  "text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase tracking-wider",
                                  colorClass
                                )}
                              >
                                {typeLabels[entry.type] ?? entry.type}
                              </span>
                              {isScan && entry.metadata?.risk && (
                                <RiskBadge tier={entry.metadata.risk as any} size="sm" />
                              )}
                              {entry.targetLabel && (
                                <span className="text-[10px] font-mono text-zinc-500">
                                  → {entry.targetLabel}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-zinc-200 leading-snug">
                              {entry.description}
                            </p>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            {entry.createdAt && (
                              <>
                                <p className="text-[10px] text-zinc-600 font-mono">
                                  {formatRelativeTime(entry.createdAt)}
                                </p>
                                <p className="text-[9px] text-zinc-700 font-mono">
                                  {formatDateTime(entry.createdAt)}
                                </p>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          {isScan && (
                            <>
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-zinc-600">files:</span>
                                <code className="text-[9px] font-mono text-zinc-400 bg-zinc-800 px-1 rounded">{entry.metadata?.files ?? 0}</code>
                              </div>
                              <div className="flex items-center gap-1">
                                <CheckCircle2 size={9} className="text-green-400" />
                                <code className="text-[9px] font-mono text-green-400">{entry.metadata?.passed ?? 0}</code>
                              </div>
                              <div className="flex items-center gap-1">
                                <AlertTriangle size={9} className="text-yellow-400" />
                                <code className="text-[9px] font-mono text-yellow-400">{entry.metadata?.warning ?? 0}</code>
                              </div>
                              <div className="flex items-center gap-1">
                                <XCircle size={9} className="text-red-400" />
                                <code className="text-[9px] font-mono text-red-400">{entry.metadata?.failed ?? 0}</code>
                              </div>
                              {entry.metadata?.duration && (
                                <code className="text-[9px] font-mono text-zinc-600">{entry.metadata.duration}</code>
                              )}
                            </>
                          )}
                          {!isScan && entry.metadata &&
                            Object.entries(entry.metadata)
                              .slice(0, 3)
                              .map(([k, v]) => (
                                <div key={k} className="flex items-center gap-1">
                                  <span className="text-[9px] text-zinc-600">{k}:</span>
                                  <code className="text-[9px] font-mono text-zinc-400 bg-zinc-800 px-1 py-0 rounded">
                                    {String(v)}
                                  </code>
                                </div>
                              ))}
                        </div>
                      </button>

                      {isScan && isExpanded && (
                        <div className="border-t border-zinc-800 bg-zinc-900/50 px-4 py-4 space-y-4">
                          <div>
                            <p className="text-xs text-zinc-500 mb-1">Policy: {entry.policyPack}</p>
                            <p className="text-sm text-zinc-300">{entry.summary}</p>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div className="flex items-center gap-2 p-2 bg-green-950/30 border border-green-900/30 rounded">
                              <CheckCircle2 size={13} className="text-green-400" />
                              <div>
                                <p className="text-sm font-bold text-green-400">{entry.metadata?.passed ?? 0}</p>
                                <p className="text-[9px] text-zinc-500">Passed</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 p-2 bg-yellow-950/30 border border-yellow-900/30 rounded">
                              <AlertTriangle size={13} className="text-yellow-400" />
                              <div>
                                <p className="text-sm font-bold text-yellow-400">{entry.metadata?.warning ?? 0}</p>
                                <p className="text-[9px] text-zinc-500">Warnings</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 p-2 bg-red-950/30 border border-red-900/30 rounded">
                              <XCircle size={13} className="text-red-400" />
                              <div>
                                <p className="text-sm font-bold text-red-400">{entry.metadata?.failed ?? 0}</p>
                                <p className="text-[9px] text-zinc-500">Failed</p>
                              </div>
                            </div>
                          </div>

                          {scanFindings.length > 0 && (
                            <div className="space-y-1.5">
                              <h4 className="text-xs text-zinc-500">Findings ({scanFindings.length})</h4>
                              <div className="divide-y divide-zinc-800/60">
                                {scanFindings.map((f: any, fi: number) => {
                                  const sevColor: Record<string, string> = {
                                    critical: "text-red-400",
                                    high: "text-orange-400",
                                    medium: "text-yellow-400",
                                    low: "text-blue-400",
                                  };
                                  return (
                                    <div key={fi} className="py-2 first:pt-0">
                                      <div className="flex items-start gap-2">
                                        <span className={cn("text-[10px] font-bold uppercase flex-shrink-0", sevColor[f.severity] || "text-zinc-400")}>
                                          {f.severity}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs text-zinc-200">{f.title}</p>
                                          <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                            {f.file}{f.line ? `:${f.line}` : ""}
                                            <span className="ml-2 text-zinc-600">{f.control_id}</span>
                                          </p>
                                          {f.description && (
                                            <p className="text-[10px] text-zinc-600 mt-0.5">{f.description}</p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {(entry.metadata?.issues ?? 0) > 0 && (
                            <p className="text-[10px] text-zinc-600">
                              {entry.metadata.issues} issues auto-created
                            </p>
                          )}

                          {entry.error && (
                            <p className="text-xs text-yellow-400/70">{entry.error}</p>
                          )}
                        </div>
                      )}
                    </Card>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
