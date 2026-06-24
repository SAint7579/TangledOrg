"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { fetchOrgs, fetchMembers } from "@/lib/api";
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

export default function PeoplePage() {
  const [membersData, setMembersData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrgs().then(async (orgsRes) => {
      const org = orgsRes?.organizations?.[0];
      if (org) {
        const rkey = org.id ?? org.rkey ?? "default";
        const members = await fetchMembers(rkey);
        setMembersData(members);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <Shell breadcrumbs={[{ label: "People" }]}>
        <div className="flex items-center justify-center h-64">
          <span className="text-zinc-500 text-sm animate-pulse">Loading...</span>
        </div>
      </Shell>
    );
  }

  const members = membersData?.members ?? [];
  const teams = membersData?.teams ?? [];

  return (
    <Shell breadcrumbs={[{ label: "People" }]}>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">People & Teams</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {members.length} members · {teams.length} teams
          </p>
        </div>

        {teams.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-zinc-100 mb-3 flex items-center gap-2">
              <Users size={15} className="text-zinc-400" />
              Teams
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {teams.map((team: any) => (
                <Card key={team.id ?? team.name}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-zinc-100">
                      {team.name}
                    </span>
                  </div>
                  {team.description && (
                    <p className="text-xs text-zinc-500 mb-2">
                      {team.description}
                    </p>
                  )}
                  <Badge variant="info" size="sm">
                    {team.memberCount ?? team.members?.length ?? 0} members
                  </Badge>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-base font-semibold text-zinc-100 mb-3 flex items-center gap-2">
            <Users size={15} className="text-zinc-400" />
            Members
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {members.map((member: any) => {
              const roleName =
                member.role?.name ?? member.role?.slug ?? member.role ?? "—";
              const roleSlug =
                member.role?.slug ?? member.role ?? "contributor";
              const memberTeams = member.teams ?? [];
              return (
                <Card key={member.id ?? member.did}>
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar
                      displayName={
                        member.displayName ?? member.handle ?? member.did
                      }
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold text-zinc-100">
                          {member.displayName ?? member.handle ?? "Unknown"}
                        </span>
                        <span
                          className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded border font-mono font-semibold uppercase tracking-wider",
                            roleColors[roleSlug] ??
                              "bg-zinc-500/10 text-zinc-400 border-zinc-600/30"
                          )}
                        >
                          {roleName}
                        </span>
                      </div>
                      {member.handle && (
                        <p className="text-[10px] font-mono text-blue-400">
                          @{member.handle.split(".")[0]}
                        </p>
                      )}
                      <p className="text-[10px] font-mono text-zinc-700 mt-0.5">
                        {(member.did ?? "").substring(0, 22)}...
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
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
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </Shell>
  );
}
