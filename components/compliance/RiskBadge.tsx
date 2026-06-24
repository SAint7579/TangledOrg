import { cn, riskTierBg } from "@/lib/utils";
import type { RiskTier } from "@/types";

interface RiskBadgeProps {
  tier: RiskTier;
  size?: "sm" | "md";
  className?: string;
}

const labels: Record<RiskTier, string> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

export function RiskBadge({ tier, size = "md", className }: RiskBadgeProps) {
  const sizeClasses = {
    sm: "text-[9px] px-1.5 py-0.5",
    md: "text-[10px] px-2 py-0.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded border font-mono font-semibold tracking-widest uppercase",
        riskTierBg(tier),
        sizeClasses[size],
        className
      )}
    >
      {labels[tier]}
    </span>
  );
}
