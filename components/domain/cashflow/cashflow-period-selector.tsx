"use client";

/** Selettore periodo 3M/6M/12M/24M per la schermata Cash flow (stesso pattern a pillole di ExpensesPeriodSelector). */

import { cn } from "@/lib/utils";
import type { CashflowPeriod } from "@/lib/calc/cashflow";

const PERIOD_OPTIONS: { value: CashflowPeriod; label: string }[] = [
  { value: "3mesi", label: "3M" },
  { value: "6mesi", label: "6M" },
  { value: "12mesi", label: "12M" },
  { value: "24mesi", label: "24M" },
];

export interface CashflowPeriodSelectorProps {
  value: CashflowPeriod;
  onChange: (period: CashflowPeriod) => void;
}

export function CashflowPeriodSelector({ value, onChange }: CashflowPeriodSelectorProps) {
  return (
    <div className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1">
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
