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
}

export function TransactionsTypeToggle({ value, onChange }: TransactionsTypeToggleProps) {
  return <SegmentedControl options={OPTIONS} value={value} onChange={onChange} ariaLabel="Tipo di transazione" />;
}
