"use client";

/** Selettore periodo 3M/6M/12M/24M per la schermata Cash flow. */

import { SegmentedControl } from "@/components/domain/shared";
import type { CashflowPeriod } from "@/lib/calc/cashflow";

const PERIOD_OPTIONS = [
  { value: "3mesi", label: "3M" },
  { value: "6mesi", label: "6M" },
  { value: "12mesi", label: "12M" },
  { value: "24mesi", label: "24M" },
] as const satisfies readonly { value: CashflowPeriod; label: string }[];

export interface CashflowPeriodSelectorProps {
  value: CashflowPeriod;
  onChange: (period: CashflowPeriod) => void;
}

export function CashflowPeriodSelector({ value, onChange }: CashflowPeriodSelectorProps) {
  return <SegmentedControl options={PERIOD_OPTIONS} value={value} onChange={onChange} ariaLabel="Periodo" />;
}
