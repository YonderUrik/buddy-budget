"use client";

/** Grafico "Entrate vs uscite": barre affiancate (non impilate) per ciascun mese del periodo selezionato. */

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import type { CashflowMonthlyEntry } from "@/lib/calc/cashflow";

const CHART_CONFIG = {
  entrate: { label: "Entrate", color: "var(--pos)" },
  uscite: { label: "Uscite", color: "var(--neg)" },
} satisfies ChartConfig;

export interface CashflowTrendChartProps {
  monthlySeries: CashflowMonthlyEntry[];
  currency: string;
}

export function CashflowTrendChart({ monthlySeries, currency }: CashflowTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Entrate vs uscite
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={CHART_CONFIG} className="max-h-64 w-full">
          <BarChart data={monthlySeries}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatCurrency(Number(value), currency, { maximumFractionDigits: 0 })}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="text-muted-foreground">{name === "entrate" ? "Entrate" : "Uscite"}</span>
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {formatCurrency(Number(value), currency)}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="entrate" fill="var(--color-entrate)" radius={4} />
            <Bar dataKey="uscite" fill="var(--color-uscite)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
