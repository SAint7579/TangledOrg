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
  ChevronRight,
  AlertOctagon,
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
      { href: "/incidents", label: "Incidents", icon: AlertOctagon },
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
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-zinc-800/70">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-600/20 border border-blue-500/30">
          <Shield size={15} className="text-blue-400" strokeWidth={2} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-zinc-100 leading-tight tracking-tight">
            Tangled Org
          </span>
          <span className="text-[9px] text-zinc-500 font-mono tracking-wider uppercase">
            Governance Layer
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
                <div className="mb-1 px-2 py-1">
                  <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold">
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
                          "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all group",
                          active
                            ? "bg-blue-600/15 text-blue-300 border border-blue-500/20"
                            : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent"
                        )}
                      >
                        <Icon
                          size={15}
                          strokeWidth={active ? 2.5 : 2}
                          className={cn(
                            "flex-shrink-0",
                            active ? "text-blue-400" : "text-zinc-500 group-hover:text-zinc-300"
                          )}
                        />
                        <span className={cn("font-medium", active && "text-blue-200")}>
                          {item.label}
                        </span>
                        {active && (
                          <ChevronRight size={12} className="ml-auto text-blue-500/60" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        <div className="mt-4 mb-1 px-2 py-1">
          <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold">
            Active Org
          </span>
        </div>
        <div className="px-2.5 py-2 rounded-md bg-zinc-900/60 border border-zinc-800/50">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <Building2 size={10} className="text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-200 truncate">{mockOrg.name}</p>
              <p className="text-[10px] text-zinc-500 font-mono truncate">@{mockOrg.handle.split(".")[0]}</p>
            </div>
          </div>
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-zinc-800/70 px-3 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar displayName={currentUser.displayName} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-zinc-200 truncate">{currentUser.displayName}</p>
            <p className="text-[10px] text-zinc-500 font-mono truncate">@{currentUser.handle.split(".")[0]}</p>
          </div>
          <div className="flex-shrink-0">
            <span className="text-[9px] bg-blue-600/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded font-mono uppercase tracking-wide">
              {currentUser.role}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
