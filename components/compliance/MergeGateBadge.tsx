import { cn } from "@/lib/utils";
import type { MergeGateStatus } from "@/types";

interface MergeGateBadgeProps {
  status: MergeGateStatus;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const config: Record<MergeGateStatus, { label: string; color: string }> = {
  pass:                { label: "PASS",   color: "text-green-400 border-green-900" },
  warning:             { label: "WARN",   color: "text-amber-400 border-amber-900" },
  "needs-human-review":{ label: "REVIEW", color: "text-blue-400  border-blue-900"  },
  blocked:             { label: "BLOCKED",color: "text-red-400   border-red-900"   },
};

const sizeClasses = {
  sm: "text-[10px] px-1.5 py-px",
  md: "text-[11px] px-2 py-px",
  lg: "text-xs px-2.5 py-0.5",
};

export function MergeGateBadge({ status, size = "md", className }: MergeGateBadgeProps) {
  const { label, color } = config[status];
  return (
    <span
      className={cn(
        "inline-flex items-center border font-mono font-semibold tracking-widest",
        color,
        sizeClasses[size],
        className
      )}
    >
      {label}
    </span>
  );
}
