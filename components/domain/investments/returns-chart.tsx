"use client";

/** Rendimento cumulato del portafoglio contro il benchmark, in percentuale dall'inizio del periodo. */

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { parseDateOnly } from "@/lib/calc/expenses";
import type { ReturnSeriesPoint } from "@/lib/calc/returns";
import { formatSignedPct } from "./gain-text";

const CHART_CONFIG = {
  portfolio: { label: "Portafoglio", color: "var(--primary)" },
  benchmark: { label: "Confronto", color: "var(--swatch-amber)" },
} satisfies ChartConfig;
const TOOLTIP_DATE_FORMAT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });

function axisPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function Tooltip({ active, payload, benchmarkName }: { active?: boolean; payload?: { payload: ReturnSeriesPoint }[]; benchmarkName: string | null }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
      <p className="text-muted-foreground">{TOOLTIP_DATE_FORMAT.format(parseDateOnly(point.date))}</p>
      <p className="tabular-nums text-foreground">Portafoglio {formatSignedPct(point.portfolio)}</p>
      {benchmarkName && point.benchmark !== null ? (
        <p className="tabular-nums text-muted-foreground">
          {benchmarkName} {formatSignedPct(point.benchmark)}
        </p>
      ) : null}
    </div>
  );
}

export interface ReturnsChartProps {
  series: ReturnSeriesPoint[];
  /** Nome del benchmark, null se non c'è una linea di confronto. */
  benchmarkName: string | null;
}

export function ReturnsChart({ series, benchmarkName }: ReturnsChartProps) {
  return (
    <div className="flex flex-col gap-2">
      <ChartContainer config={CHART_CONFIG} className="max-h-52 w-full">
        <LineChart data={series} margin={{ left: 4, right: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={axisPct} />
          <ReferenceLine y={0} stroke="var(--border)" />
          <ChartTooltip cursor={false} content={<Tooltip benchmarkName={benchmarkName} />} />
          <Line type="monotone" dataKey="portfolio" stroke="var(--color-portfolio)" strokeWidth={2} dot={false} />
          {benchmarkName ? (
            <Line type="monotone" dataKey="benchmark" stroke="var(--color-benchmark)" strokeWidth={1.5} dot={false} connectNulls />
          ) : null}
        </LineChart>
      </ChartContainer>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-primary" aria-hidden="true" /> Il tuo portafoglio
        </span>
        {benchmarkName ? (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-[var(--swatch-amber)]" aria-hidden="true" /> {benchmarkName}
          </span>
        ) : null}
      </p>
    </div>
  );
}
