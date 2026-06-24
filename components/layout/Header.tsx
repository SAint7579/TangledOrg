"use client";

import { Search, Bell, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { mockMembers } from "@/lib/mock-data";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  notificationCount?: number;
}

const currentUser = mockMembers[0];

export function Header({ breadcrumbs = [], notificationCount = 3 }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 h-14 flex items-center gap-4 px-6 bg-zinc-950/90 backdrop-blur border-b border-zinc-800/70">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm flex-1 min-w-0">
        <span className="text-zinc-500 font-medium text-xs">Tangled Org</span>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight size={12} className="text-zinc-700" />
            {i === breadcrumbs.length - 1 ? (
              <span className="text-zinc-200 font-medium text-xs truncate">{crumb.label}</span>
            ) : (
              <span className="text-zinc-500 text-xs">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Search */}
        <div className="relative hidden md:flex items-center">
          <Search size={13} className="absolute left-2.5 text-zinc-600" />
          <input
            type="text"
            placeholder="Search repos, PRs, policies..."
            className="w-56 bg-zinc-900 border border-zinc-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-zinc-700 transition-all"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
          <Bell size={16} />
          {notificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-red-500 text-white rounded-full">
              {notificationCount}
            </span>
          )}
        </button>

        {/* Avatar */}
        <Avatar displayName={currentUser.displayName} size="sm" />
      </div>
    </header>
  );
}
