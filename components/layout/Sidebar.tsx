"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  LayoutDashboard,
  FolderGit2,
  Building2,
  FileText,
  BookOpen,
  Network,
  Users,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { mockOrg, mockMembers } from "@/lib/mock-data";

const navGroups = [
  {
    label: null,
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Monitor",
    items: [
      { href: "/issues", label: "Issues", icon: AlertCircle },
      { href: "/repos", label: "Repos", icon: FolderGit2 },
    ],
  },
  {
    label: "Govern",
    items: [
      { href: "/policies", label: "Policies", icon: BookOpen },
      { href: "/org", label: "Organization", icon: Building2 },
    ],
  },
  {
    label: "Audit",
    items: [
      { href: "/audit", label: "Audit Log", icon: FileText },
      { href: "/graph", label: "Dependency Map", icon: Network },
      { href: "/people", label: "People", icon: Users },
    ],
  },
];

const currentUser = mockMembers[0]; // Elena Vasquez as current user

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[240px] flex flex-col bg-zinc-950 border-r border-zinc-800/70 z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-zinc-800">
        <Shield size={14} className="text-blue-400 flex-shrink-0" strokeWidth={2} />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-zinc-100 tracking-tight leading-none">
            Tangled Org
          </span>
          <span className="text-[9px] text-zinc-600 font-mono tracking-[0.12em] uppercase mt-0.5">
            Governance
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {navGroups.map((group, gi) => {
          const isActive = (href: string) =>
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <div key={gi} className={gi > 0 ? "mt-4" : ""}>
              {group.label && (
                <div className="mb-1 px-3 pt-1">
                  <span className="text-[9px] text-zinc-700 uppercase tracking-[0.15em] font-semibold">
                    {group.label}
                  </span>
                </div>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 py-1.5 pr-3 text-sm transition-colors group",
                          active
                            ? "border-l-2 border-blue-400 pl-[9px] text-zinc-100 bg-zinc-800/50"
                            : "border-l-2 border-transparent pl-[9px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30"
                        )}
                      >
                        <Icon
                          size={14}
                          strokeWidth={active ? 2 : 1.5}
                          className={cn(
                            "flex-shrink-0",
                            active ? "text-blue-400" : "text-zinc-600 group-hover:text-zinc-400"
                          )}
                        />
                        <span className="font-medium text-[13px]">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        <div className="mt-4 mb-1 px-3 pt-1">
          <span className="text-[9px] text-zinc-700 uppercase tracking-[0.15em] font-semibold">
            Organization
          </span>
        </div>
        <div className="mx-2 px-3 py-2 border border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-2">
            <Building2 size={11} className="text-zinc-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-300 truncate">{mockOrg.name}</p>
              <p className="text-[10px] text-zinc-600 font-mono truncate">{mockOrg.handle.split(".")[0]}.tngl.sh</p>
            </div>
          </div>
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-zinc-800 px-3 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar displayName={currentUser.displayName} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-zinc-300 truncate">{currentUser.displayName}</p>
            <p className="text-[10px] text-zinc-600 font-mono truncate">{currentUser.handle.split(".")[0]}.tngl.sh</p>
          </div>
          <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-wide flex-shrink-0">
            {currentUser.role}
          </span>
        </div>
      </div>
    </aside>
  );
}
