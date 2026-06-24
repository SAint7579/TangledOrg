"use client";

import { useState } from "react";
import {
  Activity,
  Search,
  Filter,
  Cpu,
  ShieldAlert,
  FileCheck,
  GitMerge,
  AlertTriangle,
  Users,
  Settings,
  Clock,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { mockAuditEntries } from "@/lib/mock-data";
import { auditTypeColor, formatDateTime, formatRelativeTime, truncateDid, cn } from "@/lib/utils";
import type { AuditEntryType } from "@/types";

const typeIcons: Record<AuditEntryType, React.ElementType> = {
  assessment: Cpu,
  waiver: ShieldAlert,
  evidence: FileCheck,
  "agent-run": Activity,
  "policy-change": Settings,
  "member-action": Users,
  "merge-gate": GitMerge,
};

const typeLabels: Record<AuditEntryType, string> = {
  assessment: "Assessment",
  waiver: "Waiver",
  evidence: "Evidence",
  "agent-run": "Agent Run",
  "policy-change": "Policy Change",
  "member-action": "Member Action",
  "merge-gate": "Merge Gate",
};

const allTypes: AuditEntryType[] = [
  "assessment",
  "agent-run",
  "evidence",
  "merge-gate",
  "waiver",
  "policy-change",
  "member-action",
];

export default function AuditPage() {
  const [typeFilter, setTypeFilter] = useState<AuditEntryType | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = mockAuditEntries
    .filter((e) => typeFilter === "all" || e.type === typeFilter)
    .filter((e) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        e.description.toLowerCase().includes(q) ||
        e.actorHandle.toLowerCase().includes(q) ||
        e.targetLabel.toLowerCase().includes(q)
      );
    });

  return (
    <Shell breadcrumbs={[{ label: "Audit Log" }]}>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Audit Log</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Immutable record of all compliance events, agent runs, and policy changes
            </p>
          </div>
          <Badge variant="info" size="sm">{mockAuditEntries.length} entries</Badge>
        </div>

        {/* Filters */}
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

        {/* Timeline */}
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-zinc-800" />

          <div className="space-y-2">
            {filtered.length === 0 ? (
              <Card className="text-center py-12 ml-12">
                <Activity size={28} className="text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No entries match your filters.</p>
              </Card>
            ) : (
              filtered.map((entry) => {
                const TypeIcon = typeIcons[entry.type];
                const colorClass = auditTypeColor(entry.type);
                const [bgColor] = colorClass.split(" ").filter((c) => c.startsWith("bg-"));

                return (
                  <div key={entry.id} className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={cn(
                      "relative z-10 flex items-center justify-center w-12 h-12 rounded-full flex-shrink-0 mt-0",
                      bgColor ?? "bg-zinc-800"
                    )}>
                      <TypeIcon size={16} className={colorClass.split(" ").find((c) => c.startsWith("text-")) ?? "text-zinc-400"} />
                    </div>

                    {/* Content */}
                    <Card className="flex-1 py-3 px-4">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase tracking-wider", colorClass)}>
                              {typeLabels[entry.type]}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500">
                              → {entry.targetLabel}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-200 leading-snug">{entry.description}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-[10px] text-zinc-600 font-mono">{formatRelativeTime(entry.createdAt)}</p>
                          <p className="text-[9px] text-zinc-700 font-mono">{formatDateTime(entry.createdAt)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-zinc-500">actor:</span>
                          <span className="text-[10px] font-mono text-blue-400">
                            @{entry.actorHandle.split(".")[0]}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-zinc-600 font-mono">{truncateDid(entry.actorDid)}</span>
                        </div>

                        {/* Metadata badges */}
                        {Object.entries(entry.metadata).slice(0, 3).map(([k, v]) => (
                          <div key={k} className="flex items-center gap-1">
                            <span className="text-[9px] text-zinc-600">{k}:</span>
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
