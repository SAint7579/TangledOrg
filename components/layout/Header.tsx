"use client";

import { ChevronRight, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  notificationCount?: number;
}

export function Header({ breadcrumbs = [] }: HeaderProps) {
  const { theme, toggle } = useTheme();

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
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: "var(--text-secondary)" }}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </header>
  );
}
