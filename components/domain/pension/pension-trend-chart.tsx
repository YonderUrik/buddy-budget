"use client";

/** Grafico del fondo nel tempo a tutta larghezza: i contributi netti (area) e il controvalore (linea), come nell'area clienti del fondo. */

import { Area, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { PensionSnapshot } from "@/lib/calc/pension";
import { PensionChartTooltip } from "./pension-chart-tooltip";
import { formatChartDate } from "./pension-format";

export interface PensionTrendChartProps {
  snapshots: PensionSnapshot[];
  currency: string;
  /** Altezza del grafico in px. */
  height?: number;
}

const CHART_CONFIG: ChartConfig = {
  netContributions: { label: "Contributi netti", color: "var(--swatch-slate)" },
  value: { label: "Controvalore", color: "var(--primary)" },
};
const MIN_POINTS_FOR_CHART = 2;
const DEFAULT_HEIGHT = 260;

export function PensionTrendChart({ snapshots, currency, height = DEFAULT_HEIGHT }: PensionTrendChartProps) {
  const data = snapshots.map((s) => ({ ...s, label: formatChartDate(s.date) }));
  if (data.length < MIN_POINTS_FOR_CHART) {
    return <p className="px-4 text-sm text-text-2 sm:px-6">Il grafico compare dalla seconda fotografia del fondo.</p>;
  }
  return (
    <div>
      <ChartContainer config={CHART_CONFIG} className="w-full" style={{ height }}>
        <ComposedChart data={data} margin={{ left: 0, right: 0 }}>
          <defs>
            <linearGradient id="pension-contributions-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-netContributions)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--color-netContributions)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={36} padding={{ left: 16, right: 16 }} />
          <YAxis hide domain={[0, "auto"]} />
          <ChartTooltip cursor={false} content={<PensionChartTooltip config={CHART_CONFIG} currency={currency} title={(point) => String(point.label ?? "")} />} />
          <Area type="stepAfter" dataKey="netContributions" stroke="var(--color-netContributions)" strokeWidth={2} fill="url(#pension-contributions-fill)" />
          <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2.6} dot={false} />
        </ComposedChart>
      </ChartContainer>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-text-2">
        <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" aria-hidden="true" />Controvalore</li>
        <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted-foreground/60" aria-hidden="true" />Contributi netti</li>
      </ul>
    </div>
  );
}
