"use client";

import { useEffect, useState } from "react";
import { Building2, Users, FolderGit2, Shield, Plus, X } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { fetchOrgs, fetchMembers, addMember } from "@/lib/api";
import { cn } from "@/lib/utils";

const roleColors: Record<string, string> = {
  "org-admin": "bg-red-500/10 text-red-400 border-red-500/20",
  admin: "bg-red-500/10 text-red-400 border-red-500/20",
  owner: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  contributor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  maintainer: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  developer: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  dpo: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  viewer: "bg-zinc-700/30 text-zinc-500 border-zinc-700/30",
};

export default function OrgPage() {
  const [orgData, setOrgData] = useState<any>(null);
  const [membersData, setMembersData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newHandle, setNewHandle] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const loadData = async () => {
    try {
      const orgsRes = await fetchOrgs();
      setOrgData(orgsRes);
      const org = orgsRes?.organizations?.[0];
      if (org) {
        const rkey = org.id ?? org.rkey ?? "default";
        const members = await fetchMembers(rkey);
        setMembersData(members);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddMember = async () => {
    if (!newHandle.trim()) return;
    setAdding(true);
    setAddError("");
    try {
      const org = orgData?.organizations?.[0];
      const orgUri = org?.uri ?? org?.id ?? "";
      await addMember({
        handle: newHandle.trim(),
        orgUri,
        roleUri: selectedRole || undefined,
      });
      setNewHandle("");
      setSelectedRole("");
      setShowAddMember(false);
      await loadData();
    } catch (err: any) {
      setAddError(err?.message ?? "Failed to add member");
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <Shell breadcrumbs={[{ label: "Organization" }]}>
        <div className="flex items-center justify-center h-64">
          <span className="text-zinc-500 text-sm animate-pulse">Loading...</span>
        </div>
      </Shell>
    );
  }

  const org = orgData?.organizations?.[0] ?? { name: "Your Org", description: "" };
  const members = membersData?.members ?? [];
  const teams = membersData?.teams ?? [];

  return (
    <Shell breadcrumbs={[{ label: "Organization" }]}>
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <Building2 size={28} className="text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold text-zinc-100">
                  {org.name ?? org.handle}
                </h1>
                <code className="text-xs font-mono text-zinc-500">
                  @{(org.handle ?? "").split(".")[0]}
                </code>
                <Badge variant="info" size="sm">
                  AT Protocol Org
                </Badge>
              </div>
              <p className="text-sm text-zinc-400 mb-3">
                {org.description ?? ""}
              </p>
              {org.did && (
                <p className="text-[10px] font-mono text-zinc-600 mb-4">
                  {org.did}
                </p>
              )}
              <div className="flex items-center gap-6 text-sm text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Users size={13} className="text-zinc-500" />
                  <strong className="text-zinc-200">{members.length}</strong>{" "}
                  members
                </span>
                <span className="flex items-center gap-1.5">
                  <Shield size={13} className="text-zinc-500" />
                  <strong className="text-zinc-200">{teams.length}</strong> teams
                </span>
              </div>
            </div>
          </div>
        </Card>

        {teams.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-zinc-100 mb-3 flex items-center gap-2">
              <Users size={15} className="text-zinc-400" />
              Teams
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {teams.map((team: any) => (
                <Card key={team.id ?? team.name}>
                  <CardHeader
                    title={team.name}
                    description={team.slug ? `@${team.slug}` : ""}
                  />
                  {team.description && (
                    <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
                      {team.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <Badge variant="info" size="sm">
                      {team.memberCount ?? team.members?.length ?? 0} members
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              <Users size={15} className="text-zinc-400" />
              Members
            </h2>
            <button
              onClick={() => setShowAddMember(!showAddMember)}
              className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            >
              {showAddMember ? <X size={12} /> : <Plus size={12} />}
              {showAddMember ? "Cancel" : "Add Member"}
            </button>
          </div>

          {showAddMember && (
            <Card className="mb-4">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-zinc-100">
                  Invite Member
                </h3>
                <div className="flex gap-3 items-end flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                      Handle
                    </label>
                    <input
                      value={newHandle}
                      onChange={(e) => setNewHandle(e.target.value)}
                      placeholder="e.g. username.tngl.sh"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    />
                  </div>
                  <div className="w-48">
                    <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                      Role
                    </label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    >
                      <option value="">Default (contributor)</option>
                      {(membersData?.roles ?? []).map((role: any) => (
                        <option key={role.id ?? role.uri} value={role.uri ?? role.id}>
                          {role.name ?? role.slug ?? role.id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleAddMember}
                    disabled={adding || !newHandle.trim()}
                    className="text-xs font-mono px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition-colors"
                  >
                    {adding ? "Adding..." : "Add"}
                  </button>
                </div>
                {addError && (
                  <p className="text-xs text-red-400">{addError}</p>
                )}
                <p className="text-[10px] text-zinc-600">
                  Enter the member&apos;s Tangled handle (e.g. username.tngl.sh) to invite them to the organization.
                </p>
              </div>
            </Card>
          )}

          <Card padding={false}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden md:table-cell">
                    Teams
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden lg:table-cell">
                    DID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {members.map((member: any) => {
                  const roleName =
                    member.role?.name ?? member.role?.slug ?? member.role ?? "—";
                  const roleSlug =
                    member.role?.slug ?? member.role ?? "contributor";
                  const memberTeams = member.teams ?? [];
                  return (
                    <tr
                      key={member.id ?? member.did}
                      className="hover:bg-zinc-800/20 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            displayName={
                              member.displayName ?? member.handle ?? member.did
                            }
                            size="sm"
                          />
                          <div>
                            <p className="text-sm font-medium text-zinc-200">
                              {member.displayName ?? member.handle ?? "Unknown"}
                            </p>
                            <p className="text-[10px] font-mono text-zinc-500">
                              {member.handle
                                ? `@${member.handle.split(".")[0]}`
                                : member.did?.substring(0, 20)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded border font-mono font-semibold uppercase tracking-wider",
                            roleColors[roleSlug] ??
                              "bg-zinc-500/10 text-zinc-400 border-zinc-600/30"
                          )}
                        >
                          {roleName}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {memberTeams.map((t: any) => (
                            <Badge
                              key={t.id ?? t.name ?? t}
                              variant="neutral"
                              size="sm"
                            >
                              {typeof t === "string" ? t : `@${t.slug ?? t.name}`}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <code className="text-[10px] font-mono text-zinc-600">
                          {(member.did ?? "").substring(0, 20)}...
                        </code>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
