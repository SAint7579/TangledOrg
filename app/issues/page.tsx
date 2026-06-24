"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { fetchIncidents, createIncident } from "@/lib/api";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "open" | "in-progress" | "resolved";

function severityColor(s: string) {
  return s === "critical"
    ? "text-red-400"
    : s === "high"
    ? "text-orange-400"
    : s === "medium"
    ? "text-amber-400"
    : "text-green-400";
}

export default function IssuesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    severity: "medium",
    category: "misconfiguration",
    repoUri: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchIncidents().then((res) => {
      setData(res);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <Shell breadcrumbs={[{ label: "Issues" }]}>
        <div className="flex items-center justify-center h-64">
          <span className="text-zinc-500 text-sm animate-pulse">Loading...</span>
        </div>
      </Shell>
    );
  }

  const incidents = data?.incidents ?? [];

  const filtered = incidents.filter((i: any) => {
    if (activeTab === "all") return true;
    if (activeTab === "open") return i.status === "open";
    if (activeTab === "in-progress") return i.status === "in-progress";
    if (activeTab === "resolved")
      return i.status === "resolved" || i.status === "closed";
    return true;
  });

  const openCount = incidents.filter((i: any) => i.status === "open").length;
  const inProgCount = incidents.filter(
    (i: any) => i.status === "in-progress"
  ).length;

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: `All (${incidents.length})` },
    { id: "open", label: `Open (${openCount})` },
    { id: "in-progress", label: `In Progress (${inProgCount})` },
    { id: "resolved", label: "Resolved" },
  ];

  async function handleCreate() {
    setSubmitting(true);
    await createIncident(formData);
    const res = await fetchIncidents();
    setData(res);
    setShowForm(false);
    setFormData({
      title: "",
      description: "",
      severity: "medium",
      category: "misconfiguration",
      repoUri: "",
    });
    setSubmitting(false);
  }

  return (
    <Shell breadcrumbs={[{ label: "Issues" }]}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">
              Issues
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Incidents tracked across repositories
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-6 text-right">
              <div>
                <span className="text-xl font-mono font-semibold text-red-400">
                  {openCount}
                </span>
                <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em]">
                  open
                </p>
              </div>
              <div>
                <span className="text-xl font-mono font-semibold text-amber-400">
                  {inProgCount}
                </span>
                <p className="text-[10px] text-zinc-600 uppercase tracking-[0.12em]">
                  in progress
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="text-xs font-mono px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            >
              Create Issue
            </button>
          </div>
        </div>

        {showForm && (
          <div className="border border-zinc-700 bg-zinc-900 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-100">
              New Incident
            </h3>
            <input
              type="text"
              placeholder="Title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
            <textarea
              placeholder="Description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 h-20 resize-none"
            />
            <div className="flex gap-3">
              <select
                value={formData.severity}
                onChange={(e) =>
                  setFormData({ ...formData, severity: e.target.value })
                }
                className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              >
                <option value="data-leak">Data Leak</option>
                <option value="unauthorized-access">Unauthorized Access</option>
                <option value="misconfiguration">Misconfiguration</option>
                <option value="vulnerability">Vulnerability</option>
              </select>
              <input
                type="text"
                placeholder="Repo URI (at://...)"
                value={formData.repoUri}
                onChange={(e) =>
                  setFormData({ ...formData, repoUri: e.target.value })
                }
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={submitting || !formData.title}
                className="text-xs font-mono px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition-colors"
              >
                {submitting ? "Creating..." : "Create"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="text-xs font-mono px-3 py-1.5 border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex border-b border-zinc-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab.id
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="border border-zinc-800 px-6 py-12 text-center">
            <p className="text-sm text-zinc-500">
              No issues match this filter.
            </p>
          </div>
        ) : (
          <div className="border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/60">
                  {[
                    "Severity",
                    "Category",
                    "Description",
                    "Status",
                    "SLA Deadline",
                    "SLA Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.12em]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filtered.map((incident: any, idx: number) => (
                  <tr
                    key={incident.id ?? idx}
                    className="hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={cn(
                          "font-mono text-[11px] font-semibold uppercase",
                          severityColor(incident.severity)
                        )}
                      >
                        {incident.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-[11px] text-zinc-500 capitalize">
                        {(incident.category ?? "").replace(/-/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-xs text-zinc-200 leading-snug line-clamp-2">
                        {incident.description ?? incident.title}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={cn(
                          "font-mono text-[11px] font-medium",
                          incident.status === "open"
                            ? "text-red-400"
                            : incident.status === "in-progress"
                            ? "text-amber-400"
                            : incident.status === "resolved"
                            ? "text-green-400"
                            : "text-zinc-600"
                        )}
                      >
                        {incident.status === "in-progress"
                          ? "in progress"
                          : incident.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-[11px] text-zinc-500">
                        {incident.sla?.deadline
                          ? new Date(
                              incident.sla.deadline
                            ).toLocaleDateString()
                          : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={cn(
                          "font-mono text-[11px]",
                          incident.sla?.status === "breached"
                            ? "text-red-400"
                            : incident.sla?.status === "at-risk"
                            ? "text-amber-400"
                            : "text-zinc-500"
                        )}
                      >
                        {incident.sla?.status ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
