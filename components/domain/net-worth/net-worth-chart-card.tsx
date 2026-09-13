"use client";

/** Card principale della Panoramica: patrimonio netto attuale, variazione nel periodo, selettore periodo e grafico ad area. */

import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { parseDateOnly } from "@/lib/calc/expenses";
import type { NetWorthChange, NetWorthPeriod, NetWorthSeriesPoint } from "@/lib/calc/net-worth";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NetWorthPeriodSelector } from "./net-worth-period-selector";

const CHART_CONFIG = {
  value: { label: "Patrimonio netto", color: "var(--primary)" },
} satisfies ChartConfig;

const AREA_FILL_ID = "net-worth-area-fill";

const PERIOD_CHANGE_LABELS: Record<NetWorthPeriod, string> = {
  "1mese": "nell'ultimo mese",
  "3mesi": "negli ultimi 3 mesi",
  "1anno": "nell'ultimo anno",
  max: "dall'inizio",
};

const NO_HISTORY_MESSAGE = "L'andamento comparirà nei prossimi giorni.";
const ESTIMATED_LABEL = "stimato";
const TOOLTIP_DATE_FORMAT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });

interface NetWorthTooltipProps {
  active?: boolean;
  payload?: { payload: NetWorthSeriesPoint }[];
  currency: string;
}

function NetWorthTooltip({ active, payload, currency }: NetWorthTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
      <p className="text-muted-foreground">
        {TOOLTIP_DATE_FORMAT.format(parseDateOnly(point.date))}
        {point.isEstimated ? ` · ${ESTIMATED_LABEL}` : ""}
      </p>
      <p className="font-mono font-medium tabular-nums text-foreground">{formatCurrency(point.value, currency)}</p>
    </div>
  );
}

export interface NetWorthChartCardProps {
  series: NetWorthSeriesPoint[];
  change: NetWorthChange;
  period: NetWorthPeriod;
  onPeriodChange: (period: NetWorthPeriod) => void;
  currency: string;
}

export function NetWorthChartCard({ series, change, period, onPeriodChange, currency }: NetWorthChartCardProps) {
  const hasHistory = series.length >= 2;
  const isNegative = change.delta < 0;
  const sign = isNegative ? "−" : "+";
  const pctText = change.deltaPct !== null ? ` (${sign}${Math.abs(change.deltaPct * 100).toFixed(1)}%)` : "";

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Patrimonio netto
          </CardTitle>
          <p className="font-heading text-4xl font-medium tabular-nums text-foreground">
            {formatCurrency(change.end, currency, { maximumFractionDigits: 0 })}
          </p>
          {hasHistory ? (
            <p className={cn("text-sm tabular-nums", isNegative ? "text-neg" : "text-pos")}>
              {sign}
              {formatCurrency(Math.abs(change.delta), currency, { maximumFractionDigits: 0 })}
              {pctText} <span className="text-muted-foreground">{PERIOD_CHANGE_LABELS[period]}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{NO_HISTORY_MESSAGE}</p>
          )}
        </div>
        {hasHistory ? <NetWorthPeriodSelector value={period} onChange={onPeriodChange} /> : null}
      </CardHeader>
      {hasHistory ? (
        <CardContent>
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
              <ChartTooltip cursor={false} content={<NetWorthTooltip currency={currency} />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--color-value)"
                strokeWidth={2}
                fill={`url(#${AREA_FILL_ID})`}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      ) : null}
    </Card>
  );
}
