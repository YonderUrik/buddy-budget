"use client";

/** Selettore periodo Settimana/Mese/3 mesi/Anno per la schermata Spese (stesso pattern a pillole di AddAccountForm). */

import { cn } from "@/lib/utils";
import type { ExpensePeriod } from "@/lib/calc/expenses";

const PERIOD_OPTIONS: { value: ExpensePeriod; label: string }[] = [
  { value: "settimana", label: "Settimana" },
  { value: "mese", label: "Mese" },
  { value: "3mesi", label: "3 mesi" },
  { value: "anno", label: "Anno" },
];

export interface ExpensesPeriodSelectorProps {
  value: ExpensePeriod;
  onChange: (period: ExpensePeriod) => void;
}

export function ExpensesPeriodSelector({ value, onChange }: ExpensesPeriodSelectorProps) {
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
