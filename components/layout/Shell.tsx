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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />
      <div className="pl-[240px]">
        <Header breadcrumbs={breadcrumbs} notificationCount={notificationCount} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
