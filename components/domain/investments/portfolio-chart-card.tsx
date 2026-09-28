"use client";

/** Grafico del portafoglio nel tempo: valore di mercato contro denaro investito (netto), con selettore periodo. */

import { Area, AreaChart, Line, XAxis, YAxis } from "recharts";
import { NetWorthPeriodSelector } from "@/components/domain/net-worth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { parseDateOnly } from "@/lib/calc/expenses";
import type { PortfolioSeriesPoint } from "@/lib/calc/investments";
import type { NetWorthPeriod } from "@/lib/calc/net-worth";
import { formatCurrency } from "@/lib/format";

const CHART_CONFIG = {
  value: { label: "Valore", color: "var(--primary)" },
  invested: { label: "Investito", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

const AREA_FILL_ID = "portfolio-area-fill";
const TOOLTIP_DATE_FORMAT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });
const NO_HISTORY_MESSAGE = "Il grafico comparirà quando ci saranno almeno due giorni di prezzi.";

interface PortfolioTooltipProps {
  active?: boolean;
  payload?: { payload: PortfolioSeriesPoint }[];
  currency: string;
}

function PortfolioTooltip({ active, payload, currency }: PortfolioTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
      <p className="text-muted-foreground">{TOOLTIP_DATE_FORMAT.format(parseDateOnly(point.date))}</p>
      <p className="font-mono tabular-nums text-foreground">Valore {formatCurrency(point.value, currency)}</p>
      <p className="font-mono tabular-nums text-muted-foreground">Investito {formatCurrency(point.invested, currency)}</p>
    </div>
  );
}

export interface PortfolioChartCardProps {
  series: PortfolioSeriesPoint[];
  period: NetWorthPeriod;
  onPeriodChange: (period: NetWorthPeriod) => void;
  currency: string;
}

export function PortfolioChartCard({ series, period, onPeriodChange, currency }: PortfolioChartCardProps) {
  const hasHistory = series.length >= 2;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Andamento del portafoglio
        </CardTitle>
        <NetWorthPeriodSelector value={period} onChange={onPeriodChange} />
      </CardHeader>
      <CardContent>
        {hasHistory ? (
          <ChartContainer config={CHART_CONFIG} className="max-h-64 w-full">
            <AreaChart data={series}>
              <defs>
                <linearGradient id={AREA_FILL_ID} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <ChartTooltip cursor={false} content={<PortfolioTooltip currency={currency} />} />
              <Area type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} fill={`url(#${AREA_FILL_ID})`} />
              <Line type="stepAfter" dataKey="invested" stroke="var(--color-invested)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </AreaChart>
          </ChartContainer>
        ) : (
          <p className="text-sm text-muted-foreground">{NO_HISTORY_MESSAGE}</p>
        )}
      </CardContent>
    </Card>
  );
}
