"use client";

/** Grafici Spese: donut "Fisse vs variabili" e barre "Andamento ultimi 6 mesi". */

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import type { FixedVsVariable, MonthlyTotal } from "@/lib/calc/expenses";

const FIXED_VS_VARIABLE_CONFIG = {
  fissa: { label: "Fisse", color: "var(--chart-1)" },
  variabile: { label: "Variabili", color: "var(--chart-2)" },
} satisfies ChartConfig;

const TREND_CONFIG = {
  total: { label: "Speso", color: "var(--chart-1)" },
} satisfies ChartConfig;

export interface ExpenseChartsProps {
  fixedVsVariable: FixedVsVariable;
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

export function ExpenseCharts({ fixedVsVariable, monthlyTrend, currency }: ExpenseChartsProps) {
  const donutData = [
    { key: "fissa", label: "Fisse", value: fixedVsVariable.fissa, fill: "var(--color-fissa)" },
    { key: "variabile", label: "Variabili", value: fixedVsVariable.variabile, fill: "var(--color-variabile)" },
  ];
  const trendData = monthlyTrend.map((month) => ({ label: month.label, total: month.total }));
  const formatTooltipValue = tooltipValueFormatter(currency);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fisse vs variabili
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={FIXED_VS_VARIABLE_CONFIG} className="mx-auto aspect-square max-h-56">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent formatter={formatTooltipValue} />} />
              <Pie data={donutData} dataKey="value" nameKey="label" innerRadius={50}>
                {donutData.map((entry) => (
                  <Cell key={entry.key} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

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
              <Bar dataKey="total" fill="var(--color-total)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
