"use client";

/** Grafico Spese: barre impilate "Andamento ultimi 6 mesi", un segmento per categoria (top 6 + eventuale "Altro"). */

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { SWATCH_CHART_COLOR } from "@/components/domain/shared/color-swatches";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import type { CategoryMonthlyTrend, CategoryTrendSeries } from "@/lib/calc/expenses";
import type { CategoryColor } from "@/lib/validation/categories";

/** Colore fisso (non uno swatch) per la serie aggregata "Altro", per non confondersi con una categoria reale. */
const OTHER_SERIES_COLOR = "var(--muted-foreground)";

export interface ExpenseTrendChartProps {
  monthlyCategoryTrend: CategoryMonthlyTrend;
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

function seriesColor(series: CategoryTrendSeries): string {
  return series.key === "altro" ? OTHER_SERIES_COLOR : SWATCH_CHART_COLOR[series.color as CategoryColor];
}

export function ExpenseTrendChart({ monthlyCategoryTrend, currency }: ExpenseTrendChartProps) {
  const { months, series } = monthlyCategoryTrend;
  const trendData = months.map((month) => ({ label: month.label, ...month.amounts }));
  const formatTooltipValue = tooltipValueFormatter(currency);

  const chartConfig = series.reduce<ChartConfig>((config, entry) => {
    config[entry.key] = { label: entry.name, color: seriesColor(entry) };
    return config;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Andamento ultimi 6 mesi
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="max-h-56 w-full">
          <BarChart data={trendData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent formatter={formatTooltipValue} />} />
            {series.map((entry) => (
              <Bar key={entry.key} dataKey={entry.key} name={entry.name} stackId="trend" fill={seriesColor(entry)} />
            ))}
          </BarChart>
        </ChartContainer>
        {series.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {series.map((entry) => (
              <div key={entry.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2 rounded-full" style={{ backgroundColor: seriesColor(entry) }} />
                {entry.name}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
