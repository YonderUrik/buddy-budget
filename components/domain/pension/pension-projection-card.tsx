"use client";

/**
 * Proiezione del fondo in euro di oggi, in tre scenari di rendimento reale. Gli slider regolano gli anni che mancano
 * e il versamento trimestrale; le cifre sono stime, non promesse.
 */

import * as React from "react";
import { Area, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Slider } from "@/components/ui/slider";
import { projectPension, type ProjectionRates } from "@/lib/calc/pension";
import { formatPercent, money } from "./pension-format";

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
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proiezione a pensione</CardTitle>
        <p className="text-sm text-muted-foreground">In euro di oggi, quindi già al netto dell&apos;inflazione. Una stima, non una promessa.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="space-y-1">
          <p className="font-heading text-4xl font-medium tabular-nums text-foreground">{money(end.base, currency)}</p>
          <p className="text-sm text-muted-foreground">
            tra {years} anni nello scenario base, con un rendimento reale del {formatPercent(rates.base, 0)} l&apos;anno. Tra {money(end.prudent, currency)} (prudente) e {money(end.optimistic, currency)} (ottimistico).
          </p>
        </div>

        <ChartContainer config={CHART_CONFIG} className="max-h-60 w-full">
          <ComposedChart data={points}>
            <defs>
              <linearGradient id="pension-band-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-base)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--color-base)" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <XAxis dataKey="year" tickLine={false} axisLine={false} tickFormatter={(y) => `${y}a`} minTickGap={24} />
            <YAxis hide domain={[0, "auto"]} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" labelFormatter={(_, p) => `Tra ${p?.[0]?.payload?.year ?? 0} anni`} formatter={(v) => money(Number(v), currency)} />} />
            <Area type="monotone" dataKey="optimistic" stroke="none" fill="url(#pension-band-fill)" />
            <Line type="monotone" dataKey="optimistic" stroke="var(--color-optimistic)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            <Line type="monotone" dataKey="base" stroke="var(--color-base)" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="prudent" stroke="var(--color-prudent)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          </ComposedChart>
        </ChartContainer>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Anni alla pensione</span>
              <span className="font-medium tabular-nums text-foreground">{years}</span>
            </div>
            <Slider min={MIN_YEARS} max={MAX_YEARS} step={1} value={[years]} onValueChange={(v) => setYears(Array.isArray(v) ? v[0] : v)} aria-label="Anni alla pensione" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Versamento ogni trimestre</span>
              <span className="font-medium tabular-nums text-foreground">{money(contribution, currency)}</span>
            </div>
            <Slider min={0} max={MAX_CONTRIBUTION} step={CONTRIBUTION_STEP} value={[contribution]} onValueChange={(v) => setContribution(Array.isArray(v) ? v[0] : v)} aria-label="Versamento trimestrale" />
          </div>
        </div>
        <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
          Verserai ancora <strong className="font-medium tabular-nums text-foreground">{money(paidIn, currency)}</strong>: il resto del valore finale è rendimento. Con meno anni o versamenti più bassi la cifra scende, muovi gli slider per vederlo.
        </p>
      </CardContent>
    </Card>
  );
}
