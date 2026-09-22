"use client";

/** Selettore periodo Settimana/Mese/3 mesi/Anno per la schermata Transazioni. */

import { SegmentedControl } from "@/components/domain/shared";
import type { ExpensePeriod } from "@/lib/calc/expenses";

const PERIOD_OPTIONS = [
  { value: "settimana", label: "Settimana" },
  { value: "mese", label: "Mese" },
  { value: "3mesi", label: "3 mesi" },
  { value: "anno", label: "Anno" },
] as const satisfies readonly { value: ExpensePeriod; label: string }[];

export interface ExpensesPeriodSelectorProps {
  value: ExpensePeriod;
  onChange: (period: ExpensePeriod) => void;
}

export function ExpensesPeriodSelector({ value, onChange }: ExpensesPeriodSelectorProps) {
  return <SegmentedControl options={PERIOD_OPTIONS} value={value} onChange={onChange} ariaLabel="Periodo" />;
}
