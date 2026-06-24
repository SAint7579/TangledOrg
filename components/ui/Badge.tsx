import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "neutral";
  size?: "sm" | "md";
  className?: string;
}

const variantClasses = {
  default:  "text-zinc-400 border-zinc-700",
  success:  "text-green-400 border-green-900",
  warning:  "text-amber-400 border-amber-900",
  danger:   "text-red-400 border-red-900",
  info:     "text-blue-400 border-blue-900",
  neutral:  "text-zinc-500 border-zinc-800",
};

const sizeClasses = {
  sm: "px-1.5 py-px text-[10px]",
  md: "px-2 py-px text-[11px]",
};

export function Badge({ children, variant = "default", size = "md", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center border font-mono tracking-wide",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
}
