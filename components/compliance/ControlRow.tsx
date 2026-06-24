import { CheckCircle, XCircle, AlertTriangle, Clock, Minus, Zap, User } from "lucide-react";
import { cn, controlStatusColor } from "@/lib/utils";
import type { ControlEvaluation } from "@/types";

interface ControlRowProps {
  evaluation: ControlEvaluation;
}

const statusConfig = {
  pass: { icon: CheckCircle, label: "Pass", color: "text-green-400" },
  fail: { icon: XCircle, label: "Fail", color: "text-red-400" },
  warning: { icon: AlertTriangle, label: "Warning", color: "text-amber-400" },
  skipped: { icon: Minus, label: "Skipped", color: "text-zinc-500" },
  "manual-required": { icon: Clock, label: "Manual", color: "text-blue-400" },
};

const severityColors = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-amber-400",
  low: "text-green-400",
  info: "text-zinc-400",
};

export function ControlRow({ evaluation }: ControlRowProps) {
  const { icon: StatusIcon, label: statusLabel, color: statusColor } = statusConfig[evaluation.status];
  const statusBg = controlStatusColor(evaluation.status);
  const severityColor = severityColors[evaluation.severity];

  return (
    <div className="flex items-start gap-3 py-3 border-b border-zinc-800/60 last:border-0">
      <div className={cn("mt-0.5 flex-shrink-0", statusColor)}>
        <StatusIcon size={15} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-sm text-zinc-200 font-medium truncate">{evaluation.controlName}</span>
          <span className="text-[10px] text-zinc-500 font-mono">{evaluation.policyPack}</span>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">{evaluation.detail}</p>
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <span className={cn("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-mono font-medium", statusBg)}>
          <StatusIcon size={9} strokeWidth={2.5} />
          {statusLabel}
        </span>
        <div className="flex items-center gap-1">
          <span className={cn("text-[9px] font-mono uppercase tracking-wider font-semibold", severityColor)}>
            {evaluation.severity}
          </span>
          {evaluation.automatedCheck ? (
            <Zap size={9} className="text-zinc-500" />
          ) : (
            <User size={9} className="text-zinc-500" />
          )}
        </div>
      </div>
    </div>
  );
}
