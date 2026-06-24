import { CheckCircle, AlertTriangle, Clock, XCircle } from "lucide-react";
import { cn, mergeGateColor, mergeGateLabel } from "@/lib/utils";
import type { MergeGateStatus } from "@/types";

interface MergeGateBadgeProps {
  status: MergeGateStatus;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const icons = {
  pass: CheckCircle,
  warning: AlertTriangle,
  "needs-human-review": Clock,
  blocked: XCircle,
};

export function MergeGateBadge({ status, size = "md", className }: MergeGateBadgeProps) {
  const Icon = icons[status];
  const colorClass = mergeGateColor(status);
  const label = mergeGateLabel(status);

  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5 gap-1",
    md: "text-xs px-2 py-1 gap-1.5",
    lg: "text-sm px-3 py-1.5 gap-2",
  };

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14,
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded border font-medium font-mono tracking-wide",
        colorClass,
        sizeClasses[size],
        className
      )}
    >
      <Icon size={iconSizes[size]} strokeWidth={2} />
      {label}
    </span>
  );
}
