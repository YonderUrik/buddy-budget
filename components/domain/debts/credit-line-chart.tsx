"use client";

/** Andamento dell'utilizzato nel tempo, a scalini, con la linea del fido (e della soglia) per vedere a colpo d'occhio quanto manca. */

import { Area, AreaChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { buildBalanceChartData, type BalanceChartPoint } from "@/lib/debts/credit-line-chart";
import { todayIso } from "@/lib/debts/dates";
import type { CreditLineView } from "@/lib/debts/view";
import { formatCurrency, formatShortDate } from "@/lib/format";

export interface CreditLineChartProps {
  line: CreditLineView;
  currency: string;
}

const CONFIG: ChartConfig = { balance: { label: "Utilizzato", color: "var(--primary)" } };

const dateOf = (time: number) => new Date(time).toISOString().slice(0, 10);

export function CreditLineChart({ line, currency }: CreditLineChartProps) {
  const { points, yMax } = buildBalanceChartData(line.plan.balanceSeries, line.creditLimit, todayIso());
  if (points.length < 2) return <p className="text-sm text-muted-foreground">L&apos;andamento comparirà dopo il primo utilizzo o rimborso.</p>;
  return (
    <ChartContainer config={CONFIG} className="max-h-56 w-full">
      <AreaChart data={points}>
        <defs>
          <linearGradient id="credit-line-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-balance)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="var(--color-balance)" stopOpacity={0.08} />
          </linearGradient>
        </defs>
        <XAxis dataKey="time" type="number" scale="time" domain={["dataMin", "dataMax"]} tickLine={false} axisLine={false} minTickGap={32} tickFormatter={(t: number) => formatShortDate(dateOf(t))} />
        <YAxis hide domain={[0, yMax]} />
        <ReferenceLine y={line.creditLimit} stroke="var(--text-3)" strokeDasharray="4 4" label={{ value: "Fido", position: "insideTopRight", fill: "var(--text-3)", fontSize: 11 }} />
        <ChartTooltip
          cursor={false}
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as BalanceChartPoint | undefined;
            if (!active || !point) return null;
            return (
              <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
                <p className="text-muted-foreground">{formatShortDate(dateOf(point.time))}</p>
                <p className="font-medium tabular-nums text-foreground">{formatCurrency(point.balance, currency)}</p>
              </div>
            );
          }}
        />
        <Area type="stepAfter" dataKey="balance" stroke="var(--color-balance)" strokeWidth={2} fill="url(#credit-line-fill)" isAnimationActive={false} />
      </AreaChart>
    </ChartContainer>
  );
}
