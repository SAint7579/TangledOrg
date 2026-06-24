import { cn, complianceScoreColor, complianceScoreRing } from "@/lib/utils";

interface ComplianceScoreProps {
  score: number;
  size?: "sm" | "md" | "lg" | "xl";
  label?: string;
  className?: string;
}

export function ComplianceScore({ score, size = "md", label, className }: ComplianceScoreProps) {
  const radius = size === "xl" ? 52 : size === "lg" ? 40 : size === "md" ? 32 : 24;
  const strokeWidth = size === "xl" ? 6 : size === "lg" ? 5 : 4;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const svgSize = (radius + strokeWidth) * 2;

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
    xl: "text-3xl",
  };

  const labelSizes = {
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-xs",
    xl: "text-sm",
  };

  const colorClass = complianceScoreColor(score);
  const ringClass = complianceScoreRing(score);

  return (
    <div className={cn("inline-flex flex-col items-center gap-1", className)}>
      <div className="relative inline-flex items-center justify-center">
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className="-rotate-90"
        >
          {/* Track */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-zinc-800"
          />
          {/* Progress */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn("transition-all duration-500", ringClass)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold font-mono leading-none", textSizes[size], colorClass)}>
            {score}
          </span>
        </div>
      </div>
      {label && (
        <span className={cn("text-zinc-500 font-medium tracking-wide uppercase", labelSizes[size])}>
          {label}
        </span>
      )}
    </div>
  );
}
