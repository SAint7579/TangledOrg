import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "neutral";
  size?: "sm" | "md";
  className?: string;
}

const variantStyles: Record<
  NonNullable<BadgeProps["variant"]>,
  React.CSSProperties
> = {
  default: {
    color: "var(--badge-default-text)",
    borderColor: "var(--badge-default-border)",
  },
  neutral: {
    color: "var(--text-muted)",
    borderColor: "var(--border-subtle)",
  },
  success: {
    color: "var(--badge-success-text)",
    borderColor: "var(--badge-success-border)",
  },
  warning: {
    color: "var(--badge-warning-text)",
    borderColor: "var(--badge-warning-border)",
  },
  danger: {
    color: "var(--badge-danger-text)",
    borderColor: "var(--badge-danger-border)",
  },
  info: {
    color: "var(--badge-info-text)",
    borderColor: "var(--badge-info-border)",
  },
};

const sizeClasses = {
  sm: "px-1.5 py-px text-[10px]",
  md: "px-2 py-px text-[11px]",
};

export function Badge({
  children,
  variant = "default",
  size = "md",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center border font-mono tracking-wide",
        sizeClasses[size],
        className
      )}
      style={variantStyles[variant]}
    >
      {children}
    </span>
  );
}
