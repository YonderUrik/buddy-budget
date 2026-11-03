"use client";

/** Flow view of «Dove vanno i soldi» in Liquidità › Analisi: a sentence and one of the three Sankey proposals (prototype). */

import type { FlowGroup, FlowSource } from "@/lib/liquidity/money-flow";
import { FlowCascade } from "./flow-cascade";
import { FlowRiver } from "./flow-river";
import { FlowSteps } from "./flow-steps";

export type MoneyFlowVariant = "a" | "b" | "c";

export interface MoneyFlowSectionProps {
  variant: MoneyFlowVariant;
  sources: readonly FlowSource[];
  groups: readonly FlowGroup[];
  formatValue: (n: number) => string;
}

export function MoneyFlowSection({ variant, sources, groups, formatValue }: MoneyFlowSectionProps) {
  const income = sources.reduce((sum, s) => sum + s.amount, 0);
  const spent = groups.reduce((sum, g) => sum + g.amount, 0);
  if (income <= 0 && spent <= 0) return null;
  const saved = income - spent;
  const Chart = variant === "b" ? FlowSteps : variant === "c" ? FlowCascade : FlowRiver;
  return (
    <div data-money-flow>
      <p className="mb-6 max-w-[62ch] text-text-2">
        {saved >= 0
          ? `Sono entrati ${formatValue(income)}: ${formatValue(spent)} sono andati in spese e ${formatValue(saved)} sono rimasti da parte.`
          : `Sono entrati ${formatValue(income)} e ne hai spesi ${formatValue(spent)}: ${formatValue(-saved)} sono arrivati dai risparmi.`}
      </p>
      <Chart sources={sources} groups={groups} formatValue={formatValue} />
    </div>
  );
}
