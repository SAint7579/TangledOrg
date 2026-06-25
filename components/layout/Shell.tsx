import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface ShellProps {
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  notificationCount?: number;
}

export function Shell({ children, breadcrumbs, notificationCount }: ShellProps) {
  return (
    <div
      className="min-h-screen transition-colors duration-200"
      style={{ backgroundColor: "var(--bg-main)", color: "var(--text-primary)" }}
    >
      <Sidebar />

      {/* pl-14 = 56px = collapsed sidebar width */}
      <div className="pl-14">
        <Header breadcrumbs={breadcrumbs} notificationCount={notificationCount} />
        <main className="p-6 hsb-main">{children}</main>
      </div>
    </div>
  );
}
