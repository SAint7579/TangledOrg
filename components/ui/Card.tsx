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
      className={cn(
        "border border-zinc-800 bg-zinc-900/40",
        padding && "p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-2 mb-4", className)}>
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{title}</h3>
        {description && <p className="text-xs text-zinc-600 mt-0.5">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
