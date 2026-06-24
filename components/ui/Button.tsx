import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

const variantClasses = {
  primary: "bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/50 shadow-sm",
  secondary: "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/50",
  ghost: "bg-transparent hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 border border-transparent",
  danger: "bg-red-600/80 hover:bg-red-600 text-white border border-red-500/50",
  outline: "bg-transparent hover:bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-600",
};

const sizeClasses = {
  sm: "px-2.5 py-1 text-xs rounded",
  md: "px-3.5 py-1.5 text-sm rounded-md",
  lg: "px-5 py-2.5 text-base rounded-md",
};

export function Button({ variant = "secondary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none",
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
