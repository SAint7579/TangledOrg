import { cn } from "@/lib/utils";

interface AvatarProps {
  displayName: string;
  avatarUrl?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-7 w-7 text-xs",
  md: "h-8 w-8 text-sm",
  lg: "h-10 w-10 text-base",
};

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-600",
    "bg-violet-600",
    "bg-cyan-600",
    "bg-emerald-600",
    "bg-orange-600",
    "bg-pink-600",
    "bg-indigo-600",
    "bg-teal-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ displayName, avatarUrl, size = "md", className }: AvatarProps) {
  const initials = getInitials(displayName);
  const colorClass = getAvatarColor(displayName);

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={displayName}
        className={cn("rounded-full object-cover", sizeClasses[size], className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold text-white select-none",
        colorClass,
        sizeClasses[size],
        className
      )}
      title={displayName}
    >
      {initials}
    </span>
  );
}
