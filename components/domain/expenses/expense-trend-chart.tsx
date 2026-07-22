"use client";

/** Grafico Spese: barre "Andamento ultimi 6 mesi". */

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import type { MonthlyTotal } from "@/lib/calc/expenses";

const TREND_CONFIG = {
  total: { label: "Speso", color: "var(--chart-1)" },
} satisfies ChartConfig;

export interface ExpenseTrendChartProps {
  monthlyTrend: MonthlyTotal[];
  currency: string;
}

/** Formatta il valore del tooltip (nome + importo in valuta) al posto del default numerico di ChartTooltipContent. */
function tooltipValueFormatter(currency: string) {
  return function TooltipValue(value: ValueType | undefined, name: NameType | undefined) {
    return (
      <div className="flex w-full items-center justify-between gap-3">
        <span className="text-muted-foreground">{name}</span>
        <span className="font-mono font-medium tabular-nums text-foreground">
          {formatCurrency(Number(value), currency)}
        </span>
      </div>
    );
  };
}

export function ExpenseTrendChart({ monthlyTrend, currency }: ExpenseTrendChartProps) {
  const trendData = monthlyTrend.map((month) => ({ label: month.label, total: month.total }));
  const formatTooltipValue = tooltipValueFormatter(currency);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Andamento ultimi 6 mesi
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={TREND_CONFIG} className="max-h-56 w-full">
          <BarChart data={trendData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent formatter={formatTooltipValue} />} />
            <Bar dataKey="total" name={TREND_CONFIG.total.label} fill="var(--color-total)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
