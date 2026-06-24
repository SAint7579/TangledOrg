"use client";

import { useState } from "react";
import { Users, Plus, CheckCircle } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { mockRepos, mockMembers, mockTeams } from "@/lib/mock-data";
import { cn, formatDate } from "@/lib/utils";

interface CodeOwnerEntry {
  id: string;
  pattern: string;
  ownerType: "person" | "team";
  ownerHandle: string;
  approvalRequired: boolean;
  addedAt: string;
}

const EXTRA_ENTRIES: Record<string, CodeOwnerEntry[]> = {
  "patient-service": [
    { id: "co-extra-1", pattern: "*", ownerHandle: "alice.tngl.sh", ownerType: "person", approvalRequired: true, addedAt: "2023-10-01T00:00:00Z" },
    { id: "co-extra-2", pattern: "api/**", ownerHandle: "bob.tngl.sh", ownerType: "person", approvalRequired: true, addedAt: "2024-01-15T00:00:00Z" },
    { id: "co-extra-3", pattern: "models/patient*.go", ownerHandle: "carol.tngl.sh", ownerType: "person", approvalRequired: true, addedAt: "2026-06-10T00:00:00Z" },
    { id: "co-extra-4", pattern: "migrations/**", ownerHandle: "backend", ownerType: "team", approvalRequired: true, addedAt: "2024-03-01T00:00:00Z" },
  ],
  "billing-service": [
    { id: "co-extra-5", pattern: "*", ownerHandle: "alice.tngl.sh", ownerType: "person", approvalRequired: true, addedAt: "2023-10-01T00:00:00Z" },
    { id: "co-extra-6", pattern: "src/stripe/**", ownerHandle: "bob.tngl.sh", ownerType: "person", approvalRequired: true, addedAt: "2024-06-01T00:00:00Z" },
    { id: "co-extra-7", pattern: "tests/**", ownerHandle: "backend", ownerType: "team", approvalRequired: false, addedAt: "2024-01-01T00:00:00Z" },
  ],
  "auth-service": [
    { id: "co-extra-8", pattern: "*", ownerHandle: "frank.tngl.sh", ownerType: "person", approvalRequired: true, addedAt: "2023-10-01T00:00:00Z" },
    { id: "co-extra-9", pattern: "endpoints/**", ownerHandle: "frank.tngl.sh", ownerType: "person", approvalRequired: true, addedAt: "2024-02-01T00:00:00Z" },
    { id: "co-extra-10", pattern: "config/**", ownerHandle: "security", ownerType: "team", approvalRequired: true, addedAt: "2024-02-01T00:00:00Z" },
  ],
};

export default function RepoOwnersPage({ params }: { params: { repo: string } }) {
  const repo = mockRepos.find((r) => r.slug === params.repo) ?? mockRepos[0];
  const entries: CodeOwnerEntry[] = EXTRA_ENTRIES[repo.slug] ?? repo.codeOwners.map((co, i) => ({
    id: `co-${i}`,
    pattern: co.pattern,
    ownerHandle: co.owners[0]?.replace("@", "") ?? co.teamOwners[0]?.replace("@", "") ?? "unknown",
    ownerType: co.owners.length > 0 ? "person" as const : "team" as const,
    approvalRequired: true,
    addedAt: "2024-01-01T00:00:00Z",
  }));

  const [showAddForm, setShowAddForm] = useState(false);
  const [newPattern, setNewPattern] = useState("");
  const [newOwnerType, setNewOwnerType] = useState<"person" | "team">("person");
  const [newOwnerHandle, setNewOwnerHandle] = useState("");
  const [newApprovalRequired, setNewApprovalRequired] = useState(true);
  const [localEntries, setLocalEntries] = useState<CodeOwnerEntry[]>(entries);

  function handleAdd() {
    if (!newPattern || !newOwnerHandle) return;
    const entry: CodeOwnerEntry = {
      id: `co-new-${Date.now()}`,
      pattern: newPattern,
      ownerType: newOwnerType,
      ownerHandle: newOwnerHandle,
      approvalRequired: newApprovalRequired,
      addedAt: new Date().toISOString(),
    };
    setLocalEntries((prev) => [...prev, entry]);
    setNewPattern("");
    setNewOwnerHandle("");
    setShowAddForm(false);
  }

  function getDisplayName(handle: string, ownerType: "person" | "team"): string {
    if (ownerType === "team") {
      return `@${handle}`;
    }
    const member = mockMembers.find((m) => m.handle === handle);
    return member ? `@${handle.split(".")[0]}` : `@${handle}`;
  }

  function getOwnerRole(handle: string): string | undefined {
    const member = mockMembers.find((m) => m.handle === handle);
    return member?.role;
  }

  return (
    <Shell
      breadcrumbs={[
        { label: "Repos", href: "/repos" },
        { label: repo.name, href: `/repos/${repo.slug}` },
        { label: "Code Owners" },
      ]}
    >
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-100">
              <span className="font-mono">{repo.name}</span>
              <span className="text-zinc-500 font-normal"> — Code Owners</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Define who owns each path pattern and must approve changes.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
          >
            <Plus size={14} />
            Add Pattern
          </button>
        </div>

        {/* Table */}
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center gap-2">
            <Users size={13} className="text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-100">CODEOWNERS</span>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">{localEntries.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/40">
                  <th className="text-left px-4 py-2.5 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Pattern</th>
                  <th className="text-left px-4 py-2.5 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Owner</th>
                  <th className="text-left px-4 py-2.5 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Approval Required</th>
                  <th className="text-left px-4 py-2.5 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30">
                {localEntries.map((entry) => {
                  const role = entry.ownerType === "person" ? getOwnerRole(entry.ownerHandle) : undefined;
                  return (
                    <tr key={entry.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-4 py-3">
                        <code className="text-xs font-mono text-zinc-300 bg-zinc-800/60 px-2 py-0.5 rounded">
                          {entry.pattern}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs font-mono",
                            entry.ownerType === "person" ? "text-blue-400" : "text-purple-400"
                          )}>
                            {getDisplayName(entry.ownerHandle, entry.ownerType)}
                          </span>
                          {role && (
                            <span className="text-[9px] bg-zinc-800 text-zinc-500 border border-zinc-700 px-1.5 py-0.5 rounded font-mono capitalize">
                              {role}
                            </span>
                          )}
                          {entry.ownerType === "team" && (
                            <Badge variant="neutral" size="sm">team</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {entry.approvalRequired ? (
                          <div className="flex items-center gap-1.5">
                            <CheckCircle size={12} className="text-green-400" />
                            <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded font-semibold">Required</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-zinc-500 bg-zinc-800/60 border border-zinc-700/40 px-1.5 py-0.5 rounded">Optional</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-zinc-500">{formatDate(entry.addedAt)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Add Pattern Form */}
        {showAddForm && (
          <Card>
            <CardHeader title="Add Pattern" description="Define a new file pattern and assign an owner." />
            <div className="space-y-4">
              {/* Pattern */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">File Pattern</label>
                <input
                  type="text"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  placeholder="e.g.  api/**  or  models/*.go  or  *"
                  className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-md px-3 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 placeholder:text-zinc-600"
                />
                <p className="text-[10px] text-zinc-600 mt-1">Glob patterns. Use <code className="font-mono">**</code> for recursive match.</p>
              </div>

              {/* Owner type toggle */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Owner Type</label>
                <div className="flex gap-2">
                  {(["person", "team"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewOwnerType(type)}
                      className={cn(
                        "flex-1 py-2 rounded-md text-xs font-medium border transition-all capitalize",
                        newOwnerType === type
                          ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                          : "bg-zinc-800/40 text-zinc-500 border-zinc-700/40 hover:border-zinc-600"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Handle / Team selector */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  {newOwnerType === "person" ? "Member Handle" : "Team Slug"}
                </label>
                {newOwnerType === "person" ? (
                  <select
                    value={newOwnerHandle}
                    onChange={(e) => setNewOwnerHandle(e.target.value)}
                    className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30"
                  >
                    <option value="">Select a member…</option>
                    {mockMembers.map((m) => (
                      <option key={m.id} value={m.handle}>
                        @{m.handle.split(".")[0]} ({m.displayName} · {m.role})
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={newOwnerHandle}
                    onChange={(e) => setNewOwnerHandle(e.target.value)}
                    className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30"
                  >
                    <option value="">Select a team…</option>
                    {mockTeams.map((t) => (
                      <option key={t.id} value={t.slug}>
                        @{t.slug} ({t.name})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Approval checkbox */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={newApprovalRequired}
                  onChange={(e) => setNewApprovalRequired(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-500"
                />
                <div>
                  <p className="text-xs font-semibold text-zinc-300">Approval Required</p>
                  <p className="text-[10px] text-zinc-600">PRs touching this pattern require explicit approval from this owner.</p>
                </div>
              </label>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAdd}
                  disabled={!newPattern || !newOwnerHandle}
                  className="flex-1 py-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-semibold transition-colors"
                >
                  Add Pattern
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Shell>
  );
}
