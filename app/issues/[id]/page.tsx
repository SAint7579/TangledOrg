"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderGit2, Clock, Tag, AlertCircle } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { RiskBadge } from "@/components/compliance/RiskBadge";
import { fetchIncidents } from "@/lib/api";
import { formatRelativeTime, cn } from "@/lib/utils";

const statusLabel: Record<string, string> = {
  open: "Open", "in-progress": "In Progress", resolved: "Resolved", closed: "Closed",
};

const statusColor: Record<string, string> = {
  open: "text-red-400 border-red-900", "in-progress": "text-amber-400 border-amber-900",
  resolved: "text-green-400 border-green-900", closed: "text-zinc-500 border-zinc-700",
};

const slaStatusColor: Record<string, string> = {
  open: "text-zinc-400", "at-risk": "text-amber-400", breached: "text-red-400", resolved: "text-green-400",
};

function categoryLabel(c: string) {
  return c.replace(/-/g, " ");
}

function SLABar({ deadline, status }: { deadline: string; status: string }) {
  const now = Date.now();
  const deadlineMs = new Date(deadline).getTime();
  const hoursRemaining = Math.max(0, (deadlineMs - now) / (1000 * 60 * 60));
  const breached = status === "breached" || hoursRemaining <= 0;

  const barColor = breached ? "bg-red-500" : status === "at-risk" ? "bg-amber-500" : "bg-green-500";
  const label = breached
    ? "OVERDUE"
    : hoursRemaining >= 24
      ? `${Math.ceil(hoursRemaining / 24)}d remaining`
      : `${Math.round(hoursRemaining)}h remaining`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className={cn("font-mono text-xs font-medium", slaStatusColor[status] || "text-zinc-400")}>{label}</span>
      </div>
      <div className="h-1 bg-zinc-800 w-full">
        <div className={cn("h-full transition-all", barColor)} style={{ width: `${Math.min(100, hoursRemaining / 48 * 100)}%` }} />
      </div>
      <p className="text-[10px] font-mono text-zinc-600">
        Deadline: {new Date(deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}

export default function IssueDetailPage({ params }: { params: { id: string } }) {
  const [incident, setIncident] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIncidents().then(data => {
      const found = data?.incidents?.find((i: any) => i.id === params.id);
      setIncident(found || null);
      setLoading(false);
    });
  }, [params.id]);

  if (loading) {
    return (
      <Shell breadcrumbs={[{ label: "Issues", href: "/issues" }, { label: params.id }]}>
        <div className="flex items-center justify-center h-64">
          <span className="text-zinc-500 text-sm animate-pulse">Loading...</span>
        </div>
      </Shell>
    );
  }

  if (!incident) {
    return (
      <Shell breadcrumbs={[{ label: "Issues", href: "/issues" }, { label: params.id }]}>
        <div className="text-center py-12">
          <AlertCircle size={32} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Incident not found.</p>
          <Link href="/issues" className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block">Back to Issues</Link>
        </div>
      </Shell>
    );
  }

  const status = incident.status || "open";

  return (
    <Shell breadcrumbs={[{ label: "Issues", href: "/issues" }, { label: incident.id }]}>
      <div className="max-w-4xl mx-auto space-y-6">

        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={cn("font-mono text-xs px-2 py-0.5 border", statusColor[status] || statusColor.open)}>
              {statusLabel[status] || status}
            </span>
            <RiskBadge tier={incident.severity} />
            <span className="font-mono text-[11px] text-zinc-500 capitalize">{categoryLabel(incident.category)}</span>
            {incident.sla?.status === "at-risk" && (
              <span className="font-mono text-[11px] text-amber-400 flex items-center gap-1">
                <AlertCircle size={11} /> SLA at risk
              </span>
            )}
          </div>
          <h1 className="text-lg font-semibold text-zinc-100 leading-snug">
            {incident.description?.substring(0, 100) || `Incident ${incident.id}`}
          </h1>
          <p className="text-[11px] font-mono text-zinc-600">
            {incident.id} · opened {incident.createdAt ? formatRelativeTime(incident.createdAt) : "recently"}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-5">
            <div className="border border-zinc-800 bg-zinc-900/30 px-5 py-4">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-3">Description</p>
              <p className="text-sm text-zinc-300 leading-relaxed">{incident.description}</p>
            </div>

            {(incident.cveIds?.length > 0 || incident.affectedPackage) && (
              <div className="border border-zinc-800 bg-zinc-900/30 px-5 py-4 space-y-3">
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em]">Vulnerability Details</p>
                {incident.affectedPackage && (
                  <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
                    <span className="text-xs text-zinc-500">Affected Package</span>
                    <code className="font-mono text-xs text-zinc-200 bg-zinc-800 px-2 py-0.5">{incident.affectedPackage}</code>
                  </div>
                )}
                {incident.cveIds?.map((cve: string) => (
                  <div key={cve} className="flex items-center justify-between py-1.5 border-b border-zinc-800/50 last:border-0">
                    <span className="text-xs text-zinc-500">CVE</span>
                    <span className="font-mono text-xs text-red-400 font-semibold">{cve}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {incident.sla && (
              <div className="border border-zinc-800 bg-zinc-900/30 px-4 py-4 space-y-3">
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em]">SLA</p>
                <SLABar deadline={incident.sla.deadline} status={incident.sla.status} />
              </div>
            )}

            <div className="border border-zinc-800 bg-zinc-900/30 px-4 py-4 space-y-3">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em]">Details</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-600 flex items-center gap-1.5"><FolderGit2 size={11} /> Repo</span>
                <span className="font-mono text-zinc-400 text-[11px] truncate max-w-[150px]">{incident.repo?.split("/").pop() || "—"}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-600 flex items-center gap-1.5"><Tag size={11} /> Category</span>
                <span className="font-mono text-zinc-400 text-[11px] capitalize">{categoryLabel(incident.category)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-600 flex items-center gap-1.5"><Clock size={11} /> Opened</span>
                <span className="font-mono text-zinc-400 text-[11px]">{incident.createdAt ? formatRelativeTime(incident.createdAt) : "—"}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-600">AT-URI</span>
                <span className="font-mono text-zinc-600 text-[10px] truncate max-w-[150px]">{incident.uri || "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
