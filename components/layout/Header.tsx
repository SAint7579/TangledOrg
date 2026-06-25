"use client";

import { Search, Bell, ChevronRight, Sun, Moon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTheme } from "@/components/theme/ThemeProvider";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  notificationCount?: number;
}

export function Header({ breadcrumbs = [], notificationCount = 0 }: HeaderProps) {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const displayName = user?.handle?.split(".")[0] ?? "user";

  return (
    <header
      className="sticky top-0 z-30 h-14 flex items-center gap-4 px-6 border-b backdrop-blur"
      style={{
        backgroundColor: "var(--header-bg)",
        borderColor: "var(--border-subtle)",
      }}
    >
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm flex-1 min-w-0">
        <span
          className="font-medium text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          HSB
        </span>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />
            {i === breadcrumbs.length - 1 ? (
              <span
                className="font-medium text-xs truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {crumb.label}
              </span>
            ) : (
              <span
                className="text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Search */}
        <div className="relative hidden md:flex items-center">
          <Search
            size={13}
            className="absolute left-2.5"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="text"
            placeholder="Search repos, policies…"
            className="w-52 rounded-md pl-8 pr-3 py-1.5 text-xs transition-all focus:outline-none"
            style={{
              backgroundColor: "var(--input-bg)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: "var(--text-secondary)" }}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Notifications */}
        <button
          className="relative p-1.5 rounded-md transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          <Bell size={15} />
          {notificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-[#fca5a5] text-[rgb(21,21,26)] rounded-full">
              {notificationCount}
            </span>
          )}
        </button>

        <Avatar displayName={displayName} size="sm" />
      </div>
    </header>
  );
}
