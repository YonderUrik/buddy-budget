"use client";

/** Grafico del fondo nel tempo: i contributi netti (area) e il controvalore (linea), come nell'area clienti del fondo. */

import { Area, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { PensionSnapshot } from "@/lib/calc/pension";
import { PensionChartTooltip } from "./pension-chart-tooltip";
import { formatChartDate } from "./pension-format";

export interface PensionChartCardProps {
  snapshots: PensionSnapshot[];
  currency: string;
}

const CHART_CONFIG: ChartConfig = {
  netContributions: { label: "Contributi netti", color: "var(--swatch-slate)" },
  value: { label: "Controvalore", color: "var(--primary)" },
};
const MIN_POINTS_FOR_CHART = 2;

export function PensionChartCard({ snapshots, currency }: PensionChartCardProps) {
  const data = snapshots.map((s) => ({ ...s, label: formatChartDate(s.date) }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Andamento del fondo</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length >= MIN_POINTS_FOR_CHART ? (
          <>
            <ChartContainer config={CHART_CONFIG} className="max-h-64 w-full">
              <ComposedChart data={data}>
                <defs>
                  <linearGradient id="pension-contributions-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-netContributions)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-netContributions)" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} />
                <YAxis hide domain={[0, "auto"]} />
                <ChartTooltip
                  cursor={false}
                  content={<PensionChartTooltip config={CHART_CONFIG} currency={currency} title={(point) => String(point.label ?? "")} />}
                />
                <Area type="stepAfter" dataKey="netContributions" stroke="var(--color-netContributions)" strokeWidth={2} fill="url(#pension-contributions-fill)" />
                <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ChartContainer>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" aria-hidden="true" />Controvalore</li>
              <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted-foreground/60" aria-hidden="true" />Contributi netti</li>
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Il grafico compare dalla seconda fotografia del fondo.</p>
        )}
      </CardContent>
    </Card>
  );
}
