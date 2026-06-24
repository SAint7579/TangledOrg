import {
  Building2,
  Users,
  FolderGit2,
  GitPullRequest,
  Clock,
  Shield,
} from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { mockOrg, mockTeams, mockMembers } from "@/lib/mock-data";
import { formatRelativeTime, cn } from "@/lib/utils";

const roleColors: Record<string, string> = {
  owner: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  admin: "bg-red-500/10 text-red-400 border-red-500/20",
  maintainer: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  developer: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  viewer: "bg-zinc-700/30 text-zinc-500 border-zinc-700/30",
};

export default function OrgPage() {
  return (
    <Shell breadcrumbs={[{ label: "Organization" }]}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Org Header */}
        <Card>
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <Building2 size={28} className="text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold text-zinc-100">{mockOrg.name}</h1>
                <code className="text-xs font-mono text-zinc-500">@{mockOrg.handle.split(".")[0]}</code>
                <Badge variant="info" size="sm">AT Protocol Org</Badge>
              </div>
              <p className="text-sm text-zinc-400 mb-3">{mockOrg.description}</p>
              <p className="text-[10px] font-mono text-zinc-600 mb-4">{mockOrg.did}</p>
              <div className="flex items-center gap-6 text-sm text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <FolderGit2 size={13} className="text-zinc-500" />
                  <strong className="text-zinc-200">{mockOrg.stats.repos}</strong> repos
                </span>
                <span className="flex items-center gap-1.5">
                  <Users size={13} className="text-zinc-500" />
                  <strong className="text-zinc-200">{mockOrg.stats.members}</strong> members
                </span>
                <span className="flex items-center gap-1.5">
                  <Shield size={13} className="text-zinc-500" />
                  <strong className="text-zinc-200">{mockOrg.stats.teams}</strong> teams
                </span>
                <span className="flex items-center gap-1.5">
                  <GitPullRequest size={13} className="text-zinc-500" />
                  <strong className="text-zinc-200">{mockOrg.stats.openPRs}</strong> open PRs
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Teams Grid */}
        <div>
          <h2 className="text-base font-semibold text-zinc-100 mb-3 flex items-center gap-2">
            <Users size={15} className="text-zinc-400" />
            Teams
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mockTeams.map((team) => {
              const teamMembers = mockMembers.filter((m) => team.members.includes(m.id));
              return (
                <Card key={team.id}>
                  <CardHeader
                    title={team.name}
                    description={`@${team.slug}`}
                    action={
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-zinc-500 font-mono">{team.repoCount} repos</span>
                      </div>
                    }
                  />
                  <p className="text-xs text-zinc-500 mb-3 leading-relaxed">{team.description}</p>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex -space-x-1.5">
                      {teamMembers.slice(0, 4).map((m) => (
                        <Avatar
                          key={m.id}
                          displayName={m.displayName}
                          size="xs"
                          className="ring-2 ring-zinc-900"
                        />
                      ))}
                      {teamMembers.length > 4 && (
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-700 text-[9px] text-zinc-300 ring-2 ring-zinc-900 font-medium">
                          +{teamMembers.length - 4}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-zinc-500">{team.memberCount} members</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral" size="sm">{team.repoCount} repos</Badge>
                    <Badge variant="info" size="sm">{team.memberCount} members</Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Members Table */}
        <div>
          <h2 className="text-base font-semibold text-zinc-100 mb-3 flex items-center gap-2">
            <Users size={15} className="text-zinc-400" />
            Members
          </h2>
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
                  <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider hidden sm:table-cell">
                    Approvals
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Last Active
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {mockMembers.map((member) => {
                  const memberTeams = mockTeams.filter((t) => member.teams.includes(t.id));
                  return (
                    <tr key={member.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar displayName={member.displayName} size="sm" />
                          <div>
                            <p className="text-sm font-medium text-zinc-200">{member.displayName}</p>
                            <p className="text-[10px] font-mono text-zinc-500">@{member.handle.split(".")[0]}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded border font-mono font-semibold uppercase tracking-wider",
                          roleColors[member.role]
                        )}>
                          {member.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {memberTeams.map((t) => (
                            <Badge key={t.id} variant="neutral" size="sm">@{t.slug}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <code className="text-[10px] font-mono text-zinc-600">
                          {member.did.substring(0, 20)}...
                        </code>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <span className="text-sm font-mono text-zinc-300">{member.approvalCount}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center gap-1 justify-end text-xs text-zinc-500">
                          <Clock size={10} />
                          {formatRelativeTime(member.lastActive)}
                        </span>
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
