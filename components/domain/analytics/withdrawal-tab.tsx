"use client";

/** Scheda Prelievi: le quattro regole di prelievo a confronto sugli stessi scenari. */

import * as React from "react";
import { CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { AnalyticsAssumptions } from "@/lib/analitiche/assumptions";
import type { AnalyticsPlan } from "@/lib/analitiche/plan";
import { buildSimulationInput } from "@/lib/analitiche/simulation";
import { compareRules, WITHDRAWAL_RULES } from "@/lib/calc/monte-carlo";
import { cn } from "@/lib/utils";
import { AnalyticsCard, MissingData } from "./analytics-card";
import { money, pct } from "./analytics-format";
import { RULE_LABELS } from "./assumptions-panel";

export interface WithdrawalTabProps {
  assumptions: AnalyticsAssumptions;
  plan: AnalyticsPlan;
  currency: string;
}

const SPENDING_CONFIG: ChartConfig = {
  p90: { label: "Fortunato (90°)", color: "var(--swatch-teal)" },
  p50: { label: "Tipico (mediana)", color: "var(--primary)" },
  p10: { label: "Sfortunato (10°)", color: "var(--neg)" },
};

export function WithdrawalTab({ assumptions, plan, currency }: WithdrawalTabProps) {
  const results = React.useMemo(() => {
    const input = buildSimulationInput(plan, assumptions, "oggi");
    if (!input) return null;
    return compareRules(input);
  }, [plan, assumptions]);
  const [selected, setSelected] = React.useState(assumptions.rule);
  if (!results) return <MissingData>Per confrontare le regole serve la tua spesa annua: scrivila nelle ipotesi, oppure registra almeno 3 mesi di movimenti.</MissingData>;
  const current = results.find((r) => r.rule === selected) ?? results[0];
  const bestSuccess = Math.max(...results.map((r) => r.successRate));

  return (
    <div className="flex flex-col gap-4">
      <AnalyticsCard title="Quattro regole a confronto" explainer="rules">
        <p className="text-sm text-muted-foreground">
          Si parte da oggi con {money(plan.wealth, currency)}, spendendo {money(plan.spending ?? 0, currency)} l&apos;anno per {assumptions.retirementYears} anni. Tocca una riga per vedere la sua spesa nel tempo.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="p-2 font-medium">Regola</th>
                <th className="p-2 text-right font-medium">Successo</th>
                <th className="p-2 text-right font-medium">Taglio massimo tipico</th>
                <th className="p-2 text-right font-medium">Taglio nel 10% dei casi peggiori</th>
                <th className="p-2 text-right font-medium">Patrimonio finale tipico</th>
              </tr>
            </thead>
            <tbody>
              {WITHDRAWAL_RULES.map((rule) => {
                const r = results.find((x) => x.rule === rule)!;
                return (
                  <tr key={rule} onClick={() => setSelected(rule)} className={cn("cursor-pointer border-t", selected === rule && "bg-primary/10")}>
                    <th scope="row" className="p-2 text-left font-medium">
                      <button type="button" className="text-left" onClick={() => setSelected(rule)} aria-pressed={selected === rule}>
                        {RULE_LABELS[rule]}
                      </button>
                    </th>
                    <td className={cn("p-2 text-right", r.successRate === bestSuccess && "font-medium text-pos")}>{pct(r.successRate, 0)}</td>
                    <td className="p-2 text-right">{pct(r.maxCut.median, 0)}</td>
                    <td className="p-2 text-right">{pct(r.maxCut.p90, 0)}</td>
                    <td className="p-2 text-right">{money(r.endingWealth.p50, currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          «Taglio massimo» = di quanto la spesa scende, nel punto peggiore, rispetto a quella del primo anno. Più il taglio è alto, più la regola ti chiede sacrifici quando il mercato va male.
        </p>
      </AnalyticsCard>

      <AnalyticsCard title={`Spesa nel tempo · ${RULE_LABELS[selected].split(" (")[0].toLowerCase()}`}>
        <ChartContainer config={SPENDING_CONFIG} className="h-56 w-full">
          <ComposedChart data={current.spending}>
            <CartesianGrid vertical={false} strokeOpacity={0.3} />
            <XAxis dataKey="year" tickLine={false} axisLine={false} tickFormatter={(y) => `${y + 1}a`} minTickGap={24} />
            <YAxis hide domain={[0, "auto"]} />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof current.spending)[number];
                return (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="font-medium">Anno di pensione {p.year + 1}</p>
                    <p>Sfortunato (10°): {money(p.p10, currency)}</p>
                    <p>Tipico: {money(p.p50, currency)}</p>
                    <p>Fortunato (90°): {money(p.p90, currency)}</p>
                  </div>
                );
              }}
            />
            <Line dataKey="p90" stroke="var(--color-p90)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line dataKey="p50" stroke="var(--color-p50)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="p10" stroke="var(--color-p10)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ChartContainer>
        <p className="text-xs text-muted-foreground">Spesa annua effettivamente sostenuta (comprende la pensione pubblica se l&apos;hai indicata), in euro di oggi.</p>
      </AnalyticsCard>
    </div>
  );
}
