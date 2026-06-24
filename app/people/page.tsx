import {
  Users,
  FolderGit2,
  CheckCircle,
  Minus,
  Crown,
  Eye,
  Clock,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { mockMembers, mockRepos, mockTeams } from "@/lib/mock-data";
import { formatRelativeTime, cn } from "@/lib/utils";

// Ownership type per repo/member
type OwnershipType = "owner" | "reviewer" | "member" | "none";

function getOwnership(memberId: string, repoId: string): OwnershipType {
  const repo = mockRepos.find((r) => r.id === repoId);
  const member = mockMembers.find((m) => m.id === memberId);
  if (!repo || !member) return "none";

  // Check if member is in the team that owns the repo
  const isTeamMember = member.teams.includes(repo.teamId);
  if (!isTeamMember) return "none";

  // Check if member is a code owner
  const isOwner = repo.codeOwners.some((co) =>
    co.owners.includes(`@${member.handle}`)
  );
  if (isOwner) return "owner";

  // Check role
  if (member.role === "maintainer" || member.role === "admin" || member.role === "owner") {
    return "reviewer";
  }

  return "member";
}

const ownershipConfig = {
  owner: {
    icon: Crown,
    label: "Owner",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  reviewer: {
    icon: Eye,
    label: "Reviewer",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  member: {
    icon: CheckCircle,
    label: "Member",
    className: "bg-zinc-500/10 text-zinc-400 border-zinc-600/30",
  },
  none: {
    icon: Minus,
    label: "—",
    className: "text-zinc-700",
  },
};

export default function PeoplePage() {
  // People with their repo count and info
  const peopleWithRepos = mockMembers.map((member) => {
    const memberTeams = mockTeams.filter((t) => member.teams.includes(t.id));
    const memberRepos = mockRepos.filter((r) => member.teams.includes(r.teamId));
    return { member, memberTeams, memberRepos };
  });

  return (
    <Shell breadcrumbs={[{ label: "People" }]}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-zinc-100">People & Ownership</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {mockMembers.length} members · ownership matrix and approval history
          </p>
        </div>

        {/* Ownership Matrix */}
        <div>
          <h2 className="text-base font-semibold text-zinc-100 mb-3 flex items-center gap-2">
            <FolderGit2 size={15} className="text-zinc-400" />
            Repo Ownership Matrix
          </h2>
          <Card padding={false} className="overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-zinc-800/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider sticky left-0 bg-zinc-900/90 backdrop-blur z-10 min-w-[140px]">
                    Repo
                  </th>
                  {mockMembers.map((member) => (
                    <th key={member.id} className="px-2 py-3 min-w-[80px]">
                      <div className="flex flex-col items-center gap-1">
                        <Avatar displayName={member.displayName} size="xs" />
                        <span className="text-[9px] text-zinc-500 font-mono">
                          {member.handle.split(".")[0].substring(0, 6)}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30">
                {mockRepos.map((repo) => (
                  <tr key={repo.id} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="px-4 py-2.5 sticky left-0 bg-zinc-900/90 backdrop-blur z-10">
                      <div>
                        <p className="font-mono text-zinc-200 font-medium">{repo.name}</p>
                        <p className="text-[10px] text-zinc-600 capitalize mt-0.5">{repo.riskTier} risk</p>
                      </div>
                    </td>
                    {mockMembers.map((member) => {
                      const ownership = getOwnership(member.id, repo.id);
                      const config = ownershipConfig[ownership];
                      const Icon = config.icon;
                      return (
                        <td key={member.id} className="px-2 py-2.5 text-center">
                          {ownership !== "none" ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[9px] font-mono font-medium",
                                config.className
                              )}
                              title={config.label}
                            >
                              <Icon size={8} />
                              {config.label}
                            </span>
                          ) : (
                            <Minus size={12} className="text-zinc-800 mx-auto" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-2 px-1">
            {(["owner", "reviewer", "member"] as OwnershipType[]).map((t) => {
              const config = ownershipConfig[t];
              const Icon = config.icon;
              return (
                <div key={t} className="flex items-center gap-1.5">
                  <span className={cn("flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[9px] font-mono font-medium", config.className)}>
                    <Icon size={8} />
                    {config.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* People List */}
        <div>
          <h2 className="text-base font-semibold text-zinc-100 mb-3 flex items-center gap-2">
            <Users size={15} className="text-zinc-400" />
            Team Members
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {peopleWithRepos.map(({ member, memberTeams, memberRepos }) => {
              const ownedRepos = memberRepos.filter((r) =>
                r.codeOwners.some((co) => co.owners.includes(`@${member.handle}`))
              );
              return (
                <Card key={member.id}>
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar displayName={member.displayName} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold text-zinc-100">{member.displayName}</span>
                        <span className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded border font-mono font-semibold uppercase tracking-wider",
                          member.role === "owner" ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : member.role === "admin" ? "bg-red-500/10 text-red-400 border-red-500/20"
                          : member.role === "maintainer" ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : "bg-zinc-500/10 text-zinc-400 border-zinc-600/30"
                        )}>
                          {member.role}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono text-blue-400">@{member.handle.split(".")[0]}</p>
                      <p className="text-[10px] font-mono text-zinc-700 mt-0.5">{member.did.substring(0, 22)}...</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center p-2 rounded bg-zinc-800/40 border border-zinc-800/50">
                      <p className="text-base font-bold text-zinc-100 font-mono">{memberRepos.length}</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5">Repos</p>
                    </div>
                    <div className="text-center p-2 rounded bg-zinc-800/40 border border-zinc-800/50">
                      <p className="text-base font-bold text-amber-400 font-mono">{ownedRepos.length}</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5">Owned</p>
                    </div>
                    <div className="text-center p-2 rounded bg-zinc-800/40 border border-zinc-800/50">
                      <p className="text-base font-bold text-blue-400 font-mono">{member.approvalCount}</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5">Approvals</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {memberTeams.map((t) => (
                        <Badge key={t.id} variant="neutral" size="sm">@{t.slug}</Badge>
                      ))}
                    </div>
                    <span className="flex items-center gap-1 text-[10px] text-zinc-600">
                      <Clock size={9} />
                      {formatRelativeTime(member.lastActive)}
                    </span>
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
