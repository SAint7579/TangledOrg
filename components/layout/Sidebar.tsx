"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderGit2,
  Building2,
  FileText,
  BookOpen,
  Network,
  Users,
  AlertCircle,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/components/auth/AuthProvider";
import { logout } from "@/lib/api";

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, color: "#93c5fd" },
    ],
  },
  {
    label: "Monitor",
    items: [
      { href: "/issues", label: "Issues",  icon: AlertCircle, color: "#fca5a5" },
      { href: "/repos",  label: "Repos",   icon: FolderGit2,  color: "#86efac" },
    ],
  },
  {
    label: "Govern",
    items: [
      { href: "/policies", label: "Policies",     icon: BookOpen,  color: "#fde68a" },
      { href: "/org",      label: "Organization", icon: Building2, color: "#d8b4fe" },
    ],
  },
  {
    label: "Audit",
    items: [
      { href: "/audit",  label: "Audit Log",      icon: FileText, color: "#fdba74" },
      { href: "/graph",  label: "Dependency Map", icon: Network,  color: "#67e8f9" },
      { href: "/people", label: "People",          icon: Users,    color: "#f9a8d4" },
    ],
  },
];

/* Text that fades in when the sidebar is expanded */
function FadeText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150",
        className
      )}
    >
      {children}
    </span>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const displayHandle = user?.handle ?? "anonymous";
  const shortHandle = displayHandle.split(".")[0];

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        "group fixed left-0 top-0 h-screen z-50 flex flex-col overflow-x-hidden",
        "w-14 hover:w-[220px] transition-[width] duration-200 ease-in-out",
        "bg-[rgb(21,21,26)] border-r border-[rgba(230,230,230,0.08)]"
      )}
    >
      {/* ── Logo ─────────────────────────────────────────── */}
      {/*
        Single logo image. The aside's overflow-x-hidden crops it to the
        hex icon mark when collapsed (56px). Full logo visible when expanded.
      */}
      <Link
        href="/"
        className="flex items-center h-14 px-3.5 border-b border-[rgba(230,230,230,0.08)] min-w-[220px]"
      >
        <Image
          src="/hsb-logo-light.png"
          alt="HSB"
          width={320}
          height={100}
          className="h-7 w-auto max-w-none flex-shrink-0"
          priority
        />
      </Link>

      {/* ── Navigation ───────────────────────────────────── */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-2" : ""}>
            {group.label && (
              <div className="px-3.5 pt-3 pb-0.5 min-w-[220px]">
                <FadeText className="text-[9px] text-[rgba(230,230,230,0.22)] uppercase tracking-[0.16em] font-semibold">
                  {group.label}
                </FadeText>
              </div>
            )}

            <ul className="space-y-px">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.label}
                      className={cn(
                        "relative flex items-center h-10 px-3.5 min-w-[220px] transition-colors",
                        active
                          ? "bg-[rgba(230,230,230,0.07)]"
                          : "hover:bg-[rgba(230,230,230,0.04)]"
                      )}
                    >
                      {/* Active left-bar */}
                      {active && (
                        <span
                          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
                          style={{ backgroundColor: item.color }}
                        />
                      )}

                      <Icon
                        size={17}
                        strokeWidth={active ? 2 : 1.5}
                        className="flex-shrink-0 transition-opacity"
                        style={{
                          color: item.color,
                          opacity: active ? 1 : 0.65,
                        }}
                      />

                      <FadeText
                        className={cn(
                          "ml-3 text-[13px] font-medium",
                          active
                            ? "text-[rgb(230,230,230)]"
                            : "text-[rgba(230,230,230,0.6)]"
                        )}
                      >
                        {item.label}
                      </FadeText>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── User footer ──────────────────────────────────── */}
      <div className="border-t border-[rgba(230,230,230,0.08)] px-3 py-3 min-w-[220px]">
        <div className="flex items-center gap-2.5">
          <div className="flex-shrink-0">
            <Avatar displayName={shortHandle} size="sm" />
          </div>

          <div className="flex-1 min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <p className="text-xs font-medium text-[rgba(230,230,230,0.8)] truncate">
              {shortHandle}
            </p>
            <p className="text-[10px] text-[rgba(230,230,230,0.3)] font-mono truncate">
              {displayHandle}
            </p>
          </div>

          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex-shrink-0 text-[rgba(230,230,230,0.3)] hover:text-[rgba(230,230,230,0.7)] opacity-0 group-hover:opacity-100 transition-all duration-150"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
