"use client";

/** Toggle Tutte/Uscite/Entrate per la lista transazioni (non influenza KPI/donut/trend, sempre uscite-only). */

import { cn } from "@/lib/utils";
import type { TransactionDirection } from "@/lib/calc/expenses";

const OPTIONS: { value: TransactionDirection; label: string }[] = [
  { value: "tutte", label: "Tutte" },
  { value: "uscita", label: "Uscite" },
  { value: "entrata", label: "Entrate" },
];

export interface TransactionsTypeToggleProps {
  value: TransactionDirection;
  onChange: (direction: TransactionDirection) => void;
}

export function TransactionsTypeToggle({ value, onChange }: TransactionsTypeToggleProps) {
  return (
    <div className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1">
      {OPTIONS.map((option) => (
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
