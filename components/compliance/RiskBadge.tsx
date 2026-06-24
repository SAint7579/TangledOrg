import { cn } from "@/lib/utils";
import type { RiskTier } from "@/types";

interface RiskBadgeProps {
  tier: RiskTier;
  size?: "sm" | "md";
  className?: string;
}

const colors: Record<RiskTier, string> = {
  critical: "text-red-400",
  high:     "text-orange-400",
  medium:   "text-amber-400",
  low:      "text-green-400",
};

export function RiskBadge({ tier, size = "md", className }: RiskBadgeProps) {
  const sizeClasses = {
    sm: "text-[9px]",
    md: "text-[10px]",
  };

  return (
    <span
      className={cn(
        "font-mono font-semibold tracking-widest uppercase",
        colors[tier],
        sizeClasses[size],
        className
      )}
    >
      {tier}
    </span>
  );
}
