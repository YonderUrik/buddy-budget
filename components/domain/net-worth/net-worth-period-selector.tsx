"use client";

/** Selettore periodo 1M/3M/1A/Max del grafico patrimonio netto (stesso pattern a pillole di CashflowPeriodSelector). */

import { cn } from "@/lib/utils";
import type { NetWorthPeriod } from "@/lib/calc/net-worth";

const PERIOD_OPTIONS: { value: NetWorthPeriod; label: string }[] = [
  { value: "1mese", label: "1M" },
  { value: "3mesi", label: "3M" },
  { value: "1anno", label: "1A" },
  { value: "max", label: "Max" },
];

export interface NetWorthPeriodSelectorProps {
  value: NetWorthPeriod;
  onChange: (period: NetWorthPeriod) => void;
}

export function NetWorthPeriodSelector({ value, onChange }: NetWorthPeriodSelectorProps) {
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
