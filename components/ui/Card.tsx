import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

interface CardHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div
      className={cn("border transition-colors", padding && "p-4", className)}
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "var(--card-bg)",
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-2 mb-4", className)}>
      <div>
        <h3
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-secondary)" }}
        >
          {title}
        </h3>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
