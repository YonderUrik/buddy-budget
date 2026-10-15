"use client";

/** Barra sottile dell'avanzamento di un obiettivo: piena di `--primary`, ambra se in ritardo, verde se raggiunto. */

import type { GoalStatus } from "@/lib/goals/plan";
import { cn } from "@/lib/utils";

export interface GoalProgressProps {
  /** Tra 0 e 1. */
  progress: number;
  status: GoalStatus;
  label: string;
  className?: string;
}

const STATUS_COLOR: Partial<Record<GoalStatus, string>> = { in_ritardo: "var(--swatch-amber)", raggiunto: "var(--pos)" };

export function GoalProgress({ progress, status, label, className }: GoalProgressProps) {
  const value = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${value}%`, backgroundColor: STATUS_COLOR[status] ?? "var(--primary)" }} />
    </div>
  );
}
