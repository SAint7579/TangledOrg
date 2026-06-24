"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { fetchOrgs, fetchRepos, fetchIncidents } from "@/lib/api";
import { cn } from "@/lib/utils";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em]">
        {children}
      </span>
      <div className="flex-1 border-t border-zinc-800/80" />
    </div>
  );
}

export default function DashboardPage() {
  const [orgData, setOrgData] = useState<any>(null);
  const [reposData, setReposData] = useState<any>(null);
  const [incidentsData, setIncidentsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchOrgs(), fetchRepos(), fetchIncidents()])
      .then(([orgs, repos, incidents]) => {
        setOrgData(orgs);
        setReposData(repos);
        setIncidentsData(incidents);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Shell breadcrumbs={[{ label: "Dashboard" }]}>
        <div className="flex items-center justify-center h-64">
          <span className="text-zinc-500 text-sm animate-pulse">Loading...</span>
        </div>
      </Shell>
    );
  }

  const org = orgData?.organizations?.[0] ?? { name: "Your Org", description: "No org found" };
  const repos = reposData?.repos ?? [];
  const incidents = incidentsData?.incidents ?? [];

  const openIncidents = incidents.filter(
    (i: any) => i.status === "open" || i.status === "in-progress"
  );

  const severityColor = (s: string) =>
    s === "critical"
      ? "text-red-400"
      : s === "high"
      ? "text-orange-400"
      : s === "medium"
      ? "text-amber-400"
      : "text-green-400";

  return (
    <Shell breadcrumbs={[{ label: "Dashboard" }]}>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">
                {org.name ?? org.handle}
              </h1>
              <span className="text-[10px] font-mono text-zinc-600 border border-zinc-800 px-1.5 py-px">
                AT Protocol
              </span>
            </div>
            <p className="text-sm text-zinc-500">
              {org.description ?? "Organization on AT Protocol"}
            </p>
          </div>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 px-5 py-4">
          <div className="flex items-center gap-8 flex-wrap">
            <div>
              <span className="text-4xl font-bold font-mono text-zinc-100">
                {repos.length}
              </span>
              <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em] mt-0.5">
                Repos Governed
              </p>
            </div>
            <div className="flex-1 min-w-0 border-l border-zinc-800 pl-8">
              <div className="flex items-center gap-8 flex-wrap text-sm">
                <div>
                  <span className="text-xl font-mono font-semibold text-zinc-100">
                    {repos.length}
                  </span>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em]">
                    total repos
                  </p>
                </div>
                <div>
                  <span className="text-xl font-mono font-semibold text-red-400">
                    {openIncidents.length}
                  </span>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em]">
                    open incidents
                  </p>
                </div>
                <div>
                  <span className="text-xl font-mono font-semibold text-amber-400">
                    {
                      incidents.filter(
                        (i: any) =>
                          i.sla?.status === "at-risk" ||
                          i.sla?.status === "breached"
                      ).length
                    }
                  </span>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em]">
                    sla at risk
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {openIncidents.length > 0 && (
          <div>
            <SectionLabel>Incidents — {openIncidents.length} open</SectionLabel>
            <div className="border border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/60">
                    {["Severity", "Category", "Description", "Status", "SLA"].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.12em]"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {openIncidents.slice(0, 10).map((incident: any, idx: number) => (
                    <tr
                      key={incident.id ?? idx}
                      className="hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className={cn(
                            "font-mono text-[11px] font-semibold uppercase",
                            severityColor(incident.severity)
                          )}
                        >
                          {incident.severity}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                        {incident.category?.replace(/-/g, " ")}
                      </td>
                      <td className="px-4 py-2.5 max-w-xs">
                        <p className="text-xs text-zinc-200 line-clamp-1">
                          {incident.description ?? incident.title}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className={cn(
                            "font-mono text-[11px] font-medium",
                            incident.status === "open"
                              ? "text-red-400"
                              : incident.status === "in-progress"
                              ? "text-amber-400"
                              : "text-green-400"
                          )}
                        >
                          {incident.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className={cn(
                            "font-mono text-[11px]",
                            incident.sla?.status === "breached" ||
                              incident.sla?.status === "at-risk"
                              ? "text-amber-400"
                              : "text-zinc-500"
                          )}
                        >
                          {incident.sla?.deadline
                            ? new Date(incident.sla.deadline).toLocaleDateString()
                            : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <SectionLabel>Repository Status</SectionLabel>
          <div className="border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/60">
                  {["Repository", "Knot Host", "Classification", "Regulations"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.12em]"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {repos.map((repo: any, idx: number) => (
                  <tr
                    key={repo.id ?? idx}
                    className="hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/repos/${repo.name ?? repo.slug}`}
                        className="font-mono text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {repo.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-500">
                      {repo.knot ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-[11px] text-zinc-400 capitalize">
                        {repo.profile?.dataClassification ??
                          repo.dataClassification ??
                          "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-500">
                      {(
                        repo.profile?.applicableRegulations ??
                        repo.regulations ??
                        []
                      ).join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
