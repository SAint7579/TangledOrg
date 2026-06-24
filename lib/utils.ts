import { type ClassValue, clsx } from "clsx";
import type { ComplianceStatus, RiskTier, MergeGateStatus, ControlStatus, AuditEntryType } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

export function truncateDid(did: string, chars = 8): string {
  if (did.length <= chars * 2 + 3) return did;
  const prefix = did.substring(0, did.lastIndexOf(":") + 1);
  const suffix = did.substring(did.lastIndexOf(":") + 1);
  return `${prefix}${suffix.substring(0, chars)}...${suffix.substring(suffix.length - 4)}`;
}

// ─── Color helpers ───────────────────────────────────────────────────────────

export function complianceStatusColor(status: ComplianceStatus): string {
  switch (status) {
    case "compliant":
      return "text-green-400";
    case "at-risk":
      return "text-amber-400";
    case "non-compliant":
      return "text-red-400";
    case "unknown":
      return "text-zinc-400";
  }
}

export function complianceStatusBg(status: ComplianceStatus): string {
  switch (status) {
    case "compliant":
      return "bg-green-500/10 text-green-400 border-green-500/20";
    case "at-risk":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "non-compliant":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    case "unknown":
      return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  }
}

export function riskTierColor(tier: RiskTier): string {
  switch (tier) {
    case "critical":
      return "text-red-400";
    case "high":
      return "text-orange-400";
    case "medium":
      return "text-amber-400";
    case "low":
      return "text-green-400";
  }
}

export function riskTierBg(tier: RiskTier): string {
  switch (tier) {
    case "critical":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    case "high":
      return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    case "medium":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "low":
      return "bg-green-500/10 text-green-400 border-green-500/20";
  }
}

export function mergeGateColor(status: MergeGateStatus): string {
  switch (status) {
    case "pass":
      return "bg-green-500/10 text-green-400 border-green-500/30";
    case "warning":
      return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "needs-human-review":
      return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    case "blocked":
      return "bg-red-500/10 text-red-400 border-red-500/30";
  }
}

export function mergeGateBannerColor(status: MergeGateStatus): string {
  switch (status) {
    case "pass":
      return "bg-green-500/10 border-green-500/40 text-green-300";
    case "warning":
      return "bg-amber-500/10 border-amber-500/40 text-amber-300";
    case "needs-human-review":
      return "bg-blue-500/10 border-blue-500/40 text-blue-300";
    case "blocked":
      return "bg-red-500/10 border-red-500/40 text-red-300";
  }
}

export function mergeGateLabel(status: MergeGateStatus): string {
  switch (status) {
    case "pass":
      return "Pass — Ready to Merge";
    case "warning":
      return "Warning — Review Required";
    case "needs-human-review":
      return "Needs Human Review";
    case "blocked":
      return "Blocked — Cannot Merge";
  }
}

export function controlStatusColor(status: ControlStatus): string {
  switch (status) {
    case "pass":
      return "bg-green-500/10 text-green-400 border-green-500/20";
    case "fail":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    case "warning":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "skipped":
      return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    case "manual-required":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  }
}

export function auditTypeColor(type: AuditEntryType): string {
  switch (type) {
    case "assessment":
      return "text-blue-400 bg-blue-500/10";
    case "waiver":
      return "text-amber-400 bg-amber-500/10";
    case "evidence":
      return "text-purple-400 bg-purple-500/10";
    case "agent-run":
      return "text-cyan-400 bg-cyan-500/10";
    case "policy-change":
      return "text-orange-400 bg-orange-500/10";
    case "member-action":
      return "text-green-400 bg-green-500/10";
    case "merge-gate":
      return "text-zinc-400 bg-zinc-500/10";
  }
}

export function complianceScoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

export function complianceScoreRing(score: number): string {
  if (score >= 80) return "stroke-green-500";
  if (score >= 60) return "stroke-amber-500";
  if (score >= 40) return "stroke-orange-500";
  return "stroke-red-500";
}

export function languageColor(lang: string): string {
  const colors: Record<string, string> = {
    TypeScript: "text-blue-400",
    Python: "text-yellow-400",
    Go: "text-cyan-400",
    Rust: "text-orange-400",
    Java: "text-red-400",
    Solidity: "text-purple-400",
    Shell: "text-green-400",
  };
  return colors[lang] ?? "text-zinc-400";
}

export function languageDot(lang: string): string {
  const colors: Record<string, string> = {
    TypeScript: "bg-blue-400",
    Python: "bg-yellow-400",
    Go: "bg-cyan-400",
    Rust: "bg-orange-400",
    Java: "bg-red-400",
    Solidity: "bg-purple-400",
    Shell: "bg-green-400",
  };
  return colors[lang] ?? "bg-zinc-400";
}
