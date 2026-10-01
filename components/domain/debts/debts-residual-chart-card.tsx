/** Grafico del debito residuo nel tempo: scende a gradini fino a zero con ogni rata. */

import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { DebtsOverview } from "@/lib/debts/view";
import { formatCurrency } from "@/lib/format";
import { formatMonthYear } from "./debts-format";

const CHART_CONFIG: ChartConfig = { residual: { label: "Debito residuo", color: "var(--neg)" } };
const FILL_ID = "debts-residual-fill";

export interface DebtsResidualChartCardProps {
  series: DebtsOverview["residualSeries"];
  currency: string;
}

function ChartTooltipBody({ active, payload, currency }: { active?: boolean; payload?: { payload: { date: string; residual: number } }[]; currency: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">{formatMonthYear(point.date)}</p>
      <p className="font-medium tabular-nums text-foreground">{formatCurrency(point.residual, currency, { maximumFractionDigits: 0 })}</p>
    </div>
  );
}

export function DebtsResidualChartCard({ series, currency }: DebtsResidualChartCardProps) {
  if (series.length < 2) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Come scende il debito da oggi</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={CHART_CONFIG} className="max-h-56 w-full">
          <AreaChart data={series}>
            <defs>
              <linearGradient id={FILL_ID} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-residual)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--color-residual)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={40} tickFormatter={(d: string) => formatMonthYear(d).replace(/^(\w{3})\w*/, "$1")} />
            <YAxis hide domain={[0, "dataMax"]} />
            <ChartTooltip cursor={false} content={<ChartTooltipBody currency={currency} />} />
            <Area type="stepAfter" dataKey="residual" stroke="var(--color-residual)" strokeWidth={2} fill={`url(#${FILL_ID})`} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
