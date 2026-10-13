"use client";


import { useLocalization } from "@/lib/localization/provider";

/** Scheda Simulazione: migliaia di futuri possibili del patrimonio e probabilità che duri. */

import * as React from "react";
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { SegmentedControl } from "@/components/domain/shared";
import type { AnalyticsAssumptions } from "@/lib/analitiche/assumptions";
import type { AnalyticsPlan } from "@/lib/analitiche/plan";
import { buildSimulationInput, type RetireAt } from "@/lib/analitiche/simulation";
import { runMonteCarlo } from "@/lib/calc/monte-carlo";
import { AnalyticsCard, Metric, MissingData } from "./analytics-card";
import { money, pct } from "./analytics-format";

import { successVerdict } from "./plain-answers";
import { GuidedReading } from "./guided-reading";
import { simulationSteps } from "./guided-steps";

export interface SimulationTabProps {
  /** Versione ridotta: solo il grafico dello scenario «smetto oggi», senza scelta, numeri, guida passo passo né riquadro «Come leggerla». */
  compact?: boolean;
  assumptions: AnalyticsAssumptions;
  plan: AnalyticsPlan;
  currency: string;
}

const CHART_CONFIG: ChartConfig = {
  p50: { label: "Caso tipico (mediana)", color: "var(--primary)" },
  band80: { label: "80% dei casi (10°-90°)", color: "var(--primary)" },
  band50: { label: "50% dei casi (25°-75°)", color: "var(--primary)" },
};

const RETIRE_OPTIONS = [
  { value: "oggi", label: "Smetto oggi" },
  { value: "fire", label: "Smetto al traguardo FIRE" },
] as const satisfies readonly { value: RetireAt; label: string }[];

export function SimulationTab({ assumptions, plan, currency, compact = false }: SimulationTabProps) {
  const { locale: formattingLocale } = useLocalization();

  const { t: tr } = useLocalization();
  const [chosenRetireAt, setRetireAt] = React.useState<RetireAt>("oggi");
  const retireAt: RetireAt = compact ? "oggi" : chosenRetireAt;
  const input = React.useMemo(() => buildSimulationInput(plan, assumptions, retireAt), [plan, assumptions, retireAt]);
  const result = React.useMemo(() => (input ? runMonteCarlo(input) : null), [input]);
  if (!input || !result) return <MissingData>{tr("Per simulare serve la tua spesa annua: scrivila nelle ipotesi, oppure registra almeno 3 mesi di movimenti.")}</MissingData>;

  const data = result.wealth.map((b) => ({ ...b, band80: [b.p10, b.p90], band50: [b.p25, b.p75] }));
  const retireYear = input.accumulationYears;
  const v = successVerdict(result.successRate);

  return (
    <div className="flex flex-col gap-4">
      {compact ? null : <GuidedReading tab="simulazione" steps={simulationSteps(result, input, assumptions, currency)} />}
      <AnalyticsCard title={compact ? tr("3.000 futuri possibili del tuo patrimonio") : tr("Probabilità che il patrimonio duri")} explainer={compact ? undefined : "montecarlo"}>
        {compact ? null : <SegmentedControl options={RETIRE_OPTIONS} value={retireAt} onChange={setRetireAt} ariaLabel={tr("Quando inizia la pensione")} />}
        {retireAt === "fire" && plan.yearsToFire === null ? (
          <p className="text-sm text-muted-foreground">{tr("Con queste ipotesi il traguardo FIRE non si raggiunge entro 80 anni: la simulazione parte da oggi.")}</p>
        ) : null}
        <div className={compact ? "hidden" : "grid grid-cols-1 gap-3 sm:grid-cols-3"}>
          <Metric label={tr("Probabilità di successo")} value={pct(result.successRate, 0)} tone={v.tone} sub={v.text} />
          <Metric label={tr("Patrimonio finale (caso tipico)")} value={money(result.endingWealth.p50, currency)} sub={"caso sfortunato {0}"} />
          <Metric label={tr("Spesa annua")} value={money(input.annualSpending, currency)} sub={"regola: {0} · {1} anni"} />
        </div>
        <ChartContainer config={CHART_CONFIG} className="h-64 w-full">
          <ComposedChart data={data}>
            <CartesianGrid vertical={false} strokeOpacity={0.3} />
            <XAxis dataKey="year" tickLine={false} axisLine={false} tickFormatter={(y) => `${y}a`} minTickGap={24} />
            <YAxis hide domain={[0, "auto"]} />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                return (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="font-medium">{tr("Anno")}{" "}{p.year}{p.year === retireYear ? tr(" · inizio pensione") : ""}</p>
                    <p>{tr("Sfortunato (10°):")}{" "}{money(p.p10, currency)}</p>
                    <p>{tr("Tipico (mediana):")}{" "}{money(p.p50, currency)}</p>
                    <p>{tr("Fortunato (90°):")}{" "}{money(p.p90, currency)}</p>
                  </div>
                );
              }}
            />
            <Area dataKey="band80" stroke="none" fill="var(--color-band80)" fillOpacity={0.12} isAnimationActive={false} />
            <Area dataKey="band50" stroke="none" fill="var(--color-band50)" fillOpacity={0.2} isAnimationActive={false} />
            <Line dataKey="p50" stroke="var(--color-p50)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ChartContainer>
        <p className="text-xs text-muted-foreground">
          {result.paths.toLocaleString(formattingLocale)}{" "}{tr("scenari. Asse orizzontale: anni da oggi")}{retireYear > 0 ? tr("; la pensione inizia dopo {0} anni, versando {1} l'anno", {0: retireYear, 1: money(input.annualSavings, currency)}) : ""}{tr(". Tutto in euro di oggi.")}</p>
      </AnalyticsCard>
    </div>
  );
}
