"use client";

/** Grafico "Risparmio accumulato": linea della somma cumulata del flusso netto lungo il periodo selezionato, con totale finale. */

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import type { AccumulatedSavingsEntry } from "@/lib/calc/cashflow";

const CHART_CONFIG = {
  cumulative: { label: "Risparmio accumulato", color: "var(--pos)" },
} satisfies ChartConfig;

export interface AccumulatedSavingsChartProps {
  entries: AccumulatedSavingsEntry[];
  currency: string;
}

export function AccumulatedSavingsChart({ entries, currency }: AccumulatedSavingsChartProps) {
  const total = entries.length > 0 ? entries[entries.length - 1].cumulative : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Risparmio accumulato
        </CardTitle>
        <span className="font-heading text-lg font-medium tabular-nums text-foreground">
          {formatCurrency(total, currency)}
        </span>
      </CardHeader>
      <CardContent>
        <ChartContainer config={CHART_CONFIG} className="max-h-64 w-full">
          <LineChart data={entries}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatCurrency(Number(value), currency, { maximumFractionDigits: 0 })}
            />
            <ReferenceLine y={0} stroke="var(--border)" />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="text-muted-foreground">Accumulato</span>
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {formatCurrency(Number(value), currency)}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Line type="monotone" dataKey="cumulative" stroke="var(--color-cumulative)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
