"use client";

/** Andamento mensile di Analisi: un solo spazio, due letture (entrate contro uscite, oppure uscite divise per categoria). */

import * as React from "react";
import { CashflowTrendChart } from "@/components/domain/cashflow";
import { ExpenseTrendChart } from "@/components/domain/expenses";
import { SegmentedControl } from "@/components/domain/shared";
import type { CashflowMonthlyEntry } from "@/lib/calc/cashflow";
import type { MonthlyCategoryStack } from "@/lib/calc/expenses";

type TrendMode = "flusso" | "categorie";

const TREND_OPTIONS = [
  { value: "flusso", label: "Entrate e uscite" },
  { value: "categorie", label: "Per categoria" },
] as const satisfies readonly { value: TrendMode; label: string }[];

export interface MovementsTrendSwitchProps {
  monthlySeries: CashflowMonthlyEntry[];
  monthlyStacks: MonthlyCategoryStack[];
  currency: string;
}

export function MovementsTrendSwitch({ monthlySeries, monthlyStacks, currency }: MovementsTrendSwitchProps) {
  const [mode, setMode] = React.useState<TrendMode>("flusso");
  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl<TrendMode>
        ariaLabel="Lettura dell'andamento"
        options={TREND_OPTIONS}
        value={mode}
        onChange={setMode}
        className="sm:self-start"
        stretch
      />
      {mode === "flusso" ? (
        <CashflowTrendChart monthlySeries={monthlySeries} currency={currency} />
      ) : (
        <ExpenseTrendChart monthlyStacks={monthlyStacks} currency={currency} />
      )}
    </div>
  );
}
