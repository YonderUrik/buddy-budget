"use client";

/** Selettore periodo Settimana/Mese/3 mesi/Anno per la schermata Transazioni. */

import { SegmentedControl } from "@/components/domain/shared";
import type { ExpensePeriod } from "@/lib/calc/expenses";

/** Opzioni di periodo, esportate per chi le mostra in un layout diverso (es. popover su mobile). */
export const PERIOD_OPTIONS = [
  { value: "settimana", label: "Settimana" },
  { value: "mese", label: "Mese" },
  { value: "3mesi", label: "3 mesi" },
  { value: "anno", label: "Anno" },
] as const satisfies readonly { value: ExpensePeriod; label: string }[];

export interface ExpensesPeriodSelectorProps {
  value: ExpensePeriod;
  onChange: (period: ExpensePeriod) => void;
  /** Occupa tutta la larghezza disponibile (mobile). */
  stretch?: boolean;
  className?: string;
}

export function ExpensesPeriodSelector({ value, onChange, stretch, className }: ExpensesPeriodSelectorProps) {
  return <SegmentedControl options={PERIOD_OPTIONS} value={value} onChange={onChange} stretch={stretch} className={className} ariaLabel="Periodo" />;
}
