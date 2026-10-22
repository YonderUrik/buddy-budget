"use client";

/** Thin progress bar of a budget: fills with what was spent (negative colour once over) and can mark where spending «should» be today. */

import { cn } from "@/lib/utils";

export interface BudgetBarProps {
  spent: number;
  available: number;
  /** Share of the month gone by (0–1): a tick where the bar «should» be today. Omit for past months and occasional budgets. */
  expectedShare?: number | null;
  /** Accessible label (e.g. «Budget usato: 76% di 420 €»). */
  label: string;
  className?: string;
}

export function BudgetBar({ spent, available, expectedShare, label, className }: BudgetBarProps) {
  const over = spent > available;
  const used = available > 0 ? Math.min(1, spent / available) : spent > 0 ? 1 : 0;
  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(used * 100)}
      aria-label={label}
      className={cn("relative block h-2 rounded-full bg-foreground/[0.08]", className)}
    >
      <span className="block h-full rounded-full" style={{ width: `${used > 0 ? Math.max(used * 100, 2) : 0}%`, backgroundColor: over ? "var(--neg)" : "var(--primary)" }} />
      {expectedShare != null && !over && (
        <span className="absolute -top-1 h-4 w-0.5 rounded-full bg-foreground/50" style={{ left: `calc(${expectedShare * 100}% - 1px)` }} aria-hidden="true" />
      )}
    </span>
  );
}
