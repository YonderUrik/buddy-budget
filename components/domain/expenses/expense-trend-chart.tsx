"use client";

/** Grafico Spese: barre impilate "Andamento ultimi 6 mesi", segmenti per categoria ricalcolati mese per mese (top 6 + eventuale "Altro", ordine per importo di quel mese specifico). */

import { Bar, BarChart, CartesianGrid, Cell, XAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import { SWATCH_CHART_COLOR } from "@/components/domain/shared/color-swatches";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import { OTHER_STACK_SEGMENT_KEY, type MonthlyCategoryStack, type MonthlyStackSegment } from "@/lib/calc/expenses";
import type { CategoryColor } from "@/lib/validation/categories";

/** Colore fisso (non uno swatch) per il segmento aggregato "Altro", per non confondersi con una categoria reale. */
const OTHER_SEGMENT_COLOR = "var(--muted-foreground)";

export interface ExpenseTrendChartProps {
  monthlyStacks: MonthlyCategoryStack[];
  currency: string;
}

interface MonthlyStackRow {
  label: string;
  segments: MonthlyStackSegment[];
  [slotAmountKey: string]: unknown;
}

function segmentColor(segment: MonthlyStackSegment): string {
  return segment.key === OTHER_STACK_SEGMENT_KEY
    ? OTHER_SEGMENT_COLOR
    : SWATCH_CHART_COLOR[segment.color as CategoryColor];
}

/** Trasforma i mesi in righe dati recharts con uno slot posizionale (`posNAmount`) per ciascuna posizione dello stack, fino a `maxSlots`. */
function buildRows(months: MonthlyCategoryStack[], maxSlots: number): MonthlyStackRow[] {
  return months.map((month) => {
    const row: MonthlyStackRow = { label: month.label, segments: month.segments };
    for (let i = 0; i < maxSlots; i++) {
      row[`pos${i}Amount`] = month.segments[i]?.amount;
    }
    return row;
  });
}

/** `Partial<...>` perché il componente viene istanziato come elemento JSX con solo `currency` esplicito — le proprietà del tooltip (active/payload/...) le inietta Recharts via `cloneElement` a runtime, non sono note staticamente al momento della creazione dell'elemento. */
interface MonthlyStackTooltipProps extends Partial<TooltipContentProps<number, string>> {
  currency: string;
}

/** Tooltip custom: legge i segmenti reali del mese sotto hover dalla riga dati (`payload[0].payload.segments`), perché nome/colore per slot cambiano ogni mese e il `formatter` di `ChartTooltipContent` assume un nome fisso per serie. */
function MonthlyStackTooltip({ active, payload, currency }: MonthlyStackTooltipProps) {
  const row = payload?.[0]?.payload as MonthlyStackRow | undefined;
  if (!active || !row || row.segments.length === 0) return null;

  return (
    <div className="grid min-w-32 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      {row.segments.map((segment) => (
        <div key={segment.key} className="flex w-full items-center justify-between gap-3">
          <span className="text-muted-foreground">{segment.name}</span>
          <span className="font-mono font-medium tabular-nums text-foreground">
            {formatCurrency(segment.amount, currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ExpenseTrendChart({ monthlyStacks, currency }: ExpenseTrendChartProps) {
  const maxSlots = monthlyStacks.reduce((max, month) => Math.max(max, month.segments.length), 0);
  const rows = buildRows(monthlyStacks, maxSlots);
  const slots = Array.from({ length: maxSlots }, (_, i) => i);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Andamento ultimi 6 mesi
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{}} className="max-h-56 w-full">
          <BarChart data={rows}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <ChartTooltip content={<MonthlyStackTooltip currency={currency} />} />
            {slots.map((slotIndex) => (
              <Bar key={slotIndex} dataKey={`pos${slotIndex}Amount`} stackId="trend">
                {rows.map((row, rowIndex) => {
                  const segment = row.segments[slotIndex];
                  return <Cell key={rowIndex} fill={segment ? segmentColor(segment) : "transparent"} />;
                })}
              </Bar>
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
