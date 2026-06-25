"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Search,
  Filter,
  Cpu,
  ShieldAlert,
  FileCheck,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { fetchAudit } from "@/lib/api";
import { formatDateTime, formatRelativeTime, cn } from "@/lib/utils";

type AuditType = "agent-run" | "evidence" | "waiver" | "incident" | "all";

const typeIcons: Record<string, React.ElementType> = {
  "agent-run": Cpu,
  evidence: FileCheck,
  waiver: ShieldAlert,
  incident: ShieldAlert,
};

const typeLabels: Record<string, string> = {
  "agent-run": "Agent Run",
  evidence: "Evidence",
  waiver: "Waiver",
  incident: "Incident",
};

const typeColors: Record<string, string> = {
  "agent-run": "bg-blue-500/10 text-blue-400",
  evidence: "bg-green-500/10 text-green-400",
  waiver: "bg-amber-500/10 text-amber-400",
  incident: "bg-red-500/10 text-red-400",
};

const allTypes: AuditType[] = ["agent-run", "evidence", "waiver", "incident"];

export default function AuditPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<AuditType>("all");
  const [search, setSearch] = useState("");

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

                return (
                  <div key={entry.id ?? idx} className="flex items-start gap-4">
                    <div
                      className={cn(
                        "relative z-10 flex items-center justify-center w-12 h-12 rounded-full flex-shrink-0",
                        bgColor
                      )}
                    >
                      <TypeIcon size={16} className={textColor} />
                    </div>

                    <Card className="flex-1 py-3 px-4">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span
                              className={cn(
                                "text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase tracking-wider",
                                colorClass
                              )}
                            >
                              {typeLabels[entry.type] ?? entry.type}
                            </span>
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
                        {entry.actorHandle && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-zinc-500">
                              actor:
                            </span>
                            <span className="text-[10px] font-mono text-blue-400">
                              @{entry.actorHandle.split(".")[0]}
                            </span>
                          </div>
                        )}
                        {entry.actorDid && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-zinc-600 font-mono">
                              {entry.actorDid.substring(0, 20)}...
                            </span>
                          </div>
                        )}
                        {entry.metadata &&
                          Object.entries(entry.metadata)
                            .slice(0, 3)
                            .map(([k, v]) => (
                              <div key={k} className="flex items-center gap-1">
                                <span className="text-[9px] text-zinc-600">
                                  {k}:
                                </span>
                                <code className="text-[9px] font-mono text-zinc-400 bg-zinc-800 px-1 py-0 rounded">
                                  {String(v)}
                                </code>
                              </div>
                            ))}
                      </div>
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
