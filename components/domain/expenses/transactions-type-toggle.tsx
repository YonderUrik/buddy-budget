"use client";

/** Toggle Tutte/Uscite/Entrate per la lista transazioni (non influenza KPI/donut/trend, sempre uscite-only). */

import { SegmentedControl } from "@/components/domain/shared";
import type { TransactionDirection } from "@/lib/calc/expenses";

const OPTIONS = [
  { value: "tutte", label: "Tutte" },
  { value: "uscita", label: "Uscite" },
  { value: "entrata", label: "Entrate" },
] as const satisfies readonly { value: TransactionDirection; label: string }[];

export interface TransactionsTypeToggleProps {
  value: TransactionDirection;
  onChange: (direction: TransactionDirection) => void;
  /** Occupa tutta la larghezza disponibile (mobile). */
  stretch?: boolean;
  className?: string;
}

export function TransactionsTypeToggle({ value, onChange, stretch, className }: TransactionsTypeToggleProps) {
  return <SegmentedControl options={OPTIONS} value={value} onChange={onChange} stretch={stretch} className={className} ariaLabel="Tipo di transazione" />;
}
