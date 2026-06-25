import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

const variantClasses = {
  primary:
    "bg-[#8b5cf6] hover:bg-[#a78bfa] text-white border border-[rgba(167,139,250,0.4)] shadow-sm",
  secondary:
    "bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] text-[var(--text-secondary)] border border-[var(--border-subtle)]",
  ghost:
    "bg-transparent hover:bg-[var(--hover-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent",
  danger:
    "bg-[rgba(239,68,68,0.15)] hover:bg-[rgba(239,68,68,0.25)] text-[#fca5a5] border border-[rgba(239,68,68,0.3)]",
  outline:
    "bg-transparent hover:bg-[var(--hover-bg)] text-[var(--text-primary)] border border-[var(--border-subtle)]",
};

const sizeClasses = {
  sm: "px-2.5 py-1 text-xs rounded",
  md: "px-3.5 py-1.5 text-sm rounded-md",
  lg: "px-5 py-2.5 text-base rounded-md",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(167,139,250,0.5)]",
        "disabled:opacity-50 disabled:pointer-events-none",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
