"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Selettore periodo 1M/3M/1A/Max del grafico patrimonio netto. */

import { PeriodSelector } from "@/components/domain/shared";
import type { NetWorthPeriod } from "@/lib/calc/net-worth";

const PERIOD_OPTIONS = [
  { value: "1mese", label: "1M" },
  { value: "3mesi", label: "3M" },
  { value: "1anno", label: "1A" },
  { value: "max", label: "Max" },
] as const satisfies readonly { value: NetWorthPeriod; label: string }[];

export interface NetWorthPeriodSelectorProps {
  value: NetWorthPeriod;
  onChange: (period: NetWorthPeriod) => void;
}

export function NetWorthPeriodSelector({ value, onChange }: NetWorthPeriodSelectorProps) {
  const { t: tr } = useLocalization();
  return <PeriodSelector options={PERIOD_OPTIONS} value={value} onChange={onChange} ariaLabel={tr("Periodo del grafico")} />;
}
