"use client";

/**
 * Proiezione del fondo in euro di oggi, in tre scenari di rendimento reale. Gli slider regolano gli anni che mancano
 * e il versamento trimestrale; le cifre sono stime, non promesse.
 */

import * as React from "react";
import { HourglassIcon } from "lucide-react";
import { Area, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Slider } from "@/components/ui/slider";
import { projectPension, type ProjectionRates } from "@/lib/calc/pension";
import { PensionChartTooltip } from "./pension-chart-tooltip";
import { formatPercent, money } from "./pension-format";
import { PensionSection } from "./pension-section";

export interface PensionProjectionCardProps {
  startValue: number;
  /** Versamento trimestrale di partenza (stimato dalle fotografie). */
  defaultQuarterlyContribution: number;
  currency: string;
  /** Rendimenti reali (al netto dell'inflazione) dei tre scenari. */
  rates?: ProjectionRates;
}

const DEFAULT_RATES: ProjectionRates = { prudent: 0, base: 0.02, optimistic: 0.04 };
const DEFAULT_YEARS = 25;
const MIN_YEARS = 1;
const MAX_YEARS = 45;
const MAX_CONTRIBUTION = 3000;
const CONTRIBUTION_STEP = 20;
const CHART_HEIGHT = 240;

const SCENARIOS = [
  { key: "prudent", label: "Prudente" },
  { key: "base", label: "Base" },
  { key: "optimistic", label: "Ottimistico" },
] as const;

const CHART_CONFIG: ChartConfig = {
  optimistic: { label: "Ottimistico", color: "var(--swatch-teal)" },
  base: { label: "Base", color: "var(--primary)" },
  prudent: { label: "Prudente", color: "var(--swatch-slate)" },
};

export function PensionProjectionCard({ startValue, defaultQuarterlyContribution, currency, rates = DEFAULT_RATES }: PensionProjectionCardProps) {
  const [years, setYears] = React.useState(DEFAULT_YEARS);
  const [contribution, setContribution] = React.useState(Math.round(defaultQuarterlyContribution / CONTRIBUTION_STEP) * CONTRIBUTION_STEP);
  const points = React.useMemo(() => projectPension({ startValue, quarterlyContribution: contribution, years, rates }), [startValue, contribution, years, rates]);
  const end = points.at(-1)!;
  const paidIn = contribution * 4 * years;

  return (
    <PensionSection icon={HourglassIcon} title="Proiezione a pensione" color="var(--swatch-teal)" description="In euro di oggi, quindi già al netto dell'inflazione. Una stima, non una promessa.">
      <div className="flex flex-col gap-6">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
          {SCENARIOS.map((scenario) => (
            <div key={scenario.key} className="min-w-0 border-t border-border pt-3">
              <dt className="flex items-center gap-2 text-sm text-text-2">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: CHART_CONFIG[scenario.key].color }} aria-hidden="true" />
                <span className={scenario.key === "base" ? "font-semibold text-foreground" : undefined}>{scenario.label}</span> · rendimento reale {formatPercent(rates[scenario.key], 0)}
              </dt>
              <dd className="mt-1 font-heading text-3xl font-medium tabular-nums text-foreground">{money(end[scenario.key], currency)}</dd>
              <dd className="text-sm text-text-2">tra {years} anni, di cui {money(Math.max(0, end[scenario.key] - startValue - paidIn), currency)} di rendimento</dd>
            </div>
          ))}
        </dl>

        <div className="-mx-4 sm:-mx-6">
          <ChartContainer config={CHART_CONFIG} className="w-full" style={{ height: CHART_HEIGHT }}>
            <ComposedChart data={points} margin={{ left: 0, right: 0 }}>
              <defs>
                <linearGradient id="pension-band-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-base)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--color-base)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="year" tickLine={false} axisLine={false} tickFormatter={(y) => `${y}a`} minTickGap={24} padding={{ left: 16, right: 16 }} />
              <YAxis hide domain={[0, "auto"]} />
              <ChartTooltip cursor={false} content={<PensionChartTooltip config={CHART_CONFIG} currency={currency} title={(point) => `Tra ${Number(point.year ?? 0)} anni`} />} />
              <Area type="monotone" dataKey="optimistic" stroke="none" tooltipType="none" fill="url(#pension-band-fill)" />
              <Line type="monotone" dataKey="optimistic" stroke="var(--color-optimistic)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              <Line type="monotone" dataKey="base" stroke="var(--color-base)" strokeWidth={2.6} dot={false} />
              <Line type="monotone" dataKey="prudent" stroke="var(--color-prudent)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            </ComposedChart>
          </ChartContainer>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-text-2">Anni alla pensione</span>
              <span className="font-heading text-lg font-medium tabular-nums text-foreground">{years}</span>
            </div>
            <Slider min={MIN_YEARS} max={MAX_YEARS} step={1} value={[years]} onValueChange={(v) => setYears(Array.isArray(v) ? v[0] : v)} aria-label="Anni alla pensione" />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-text-2">Versamento ogni trimestre</span>
              <span className="font-heading text-lg font-medium tabular-nums text-foreground">{money(contribution, currency)}</span>
            </div>
            <Slider min={0} max={MAX_CONTRIBUTION} step={CONTRIBUTION_STEP} value={[contribution]} onValueChange={(v) => setContribution(Array.isArray(v) ? v[0] : v)} aria-label="Versamento trimestrale" />
          </div>
        </div>
        <p className="text-sm text-text-2">
          Verserai ancora <strong className="font-semibold tabular-nums text-foreground">{money(paidIn, currency)}</strong>: il resto del valore finale è rendimento. Con meno anni o versamenti più bassi la cifra scende, muovi gli slider per vederlo.
        </p>
      </div>
    </PensionSection>
  );
}
