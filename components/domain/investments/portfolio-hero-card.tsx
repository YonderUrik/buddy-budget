"use client";

/**
 * Card principale di Investimenti: valore di oggi, la sua lettura in parole ("hai pagato X, il mercato ha aggiunto Y"),
 * la barra che lo scompone e l'andamento nel tempo del valore contro quanto hai versato.
 */

import { simulateCostExclusions } from "@/lib/investments/cost-impact";
import type { BrokerCash } from "@/lib/investments/broker-cash";
import { Switch } from "@/components/ui/switch";
import type { CostImpact } from "@/lib/investments/cost-impact";
import { Area, AreaChart, Line, XAxis, YAxis } from "recharts";
import { PortfolioPeriodSelector, type PortfolioPeriodSelectorProps } from "./portfolio-period-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { parseDateOnly } from "@/lib/calc/expenses";
import type { PortfolioSeriesPoint, PortfolioSummary } from "@/lib/calc/investments";
import type { ValueBreakdown } from "@/lib/investments/insights";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ValueBreakdownBar } from "./value-breakdown-bar";

const CHART_CONFIG = {
  value: { label: "Valore", color: "var(--primary)" },
  invested: { label: "Versato", color: "var(--muted-foreground)" },
} satisfies ChartConfig;
const AREA_FILL_ID = "portfolio-hero-fill";
const TOOLTIP_DATE_FORMAT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });

function pctText(ratio: number): string {
  return `${ratio < 0 ? "−" : "+"}${Math.abs(ratio * 100).toFixed(1).replace(".", ",")}%`;
}

function Tooltip({ active, payload, currency }: { active?: boolean; payload?: { payload: PortfolioSeriesPoint }[]; currency: string }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const diff = point.value - point.invested;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
      <p className="text-muted-foreground">{TOOLTIP_DATE_FORMAT.format(parseDateOnly(point.date))}</p>
      <p className="tabular-nums text-foreground">Valore {formatCurrency(point.value, currency)}</p>
      <p className="tabular-nums text-muted-foreground">Versato {formatCurrency(point.invested, currency)}</p>
      <p className={cn("tabular-nums", diff < 0 ? "text-neg" : "text-pos")}>
        {diff < 0 ? "−" : "+"}
        {formatCurrency(Math.abs(diff), currency)}
      </p>
    </div>
  );
}

export interface PortfolioHeroCardProps extends Omit<PortfolioPeriodSelectorProps, "value" | "onChange"> {
  cash?: BrokerCash[];
  includeCash?: boolean;
  onIncludeCashChange?: (include: boolean) => void;
  costImpact?: CostImpact;
  includeFees?: boolean;
  includeTaxes?: boolean;
  onIncludeFeesChange?: (value: boolean) => void;
  onIncludeTaxesChange?: (value: boolean) => void;
  summary: PortfolioSummary;
  breakdown: ValueBreakdown;
  series: PortfolioSeriesPoint[];
  period: PortfolioPeriodSelectorProps["value"];
  onPeriodChange: PortfolioPeriodSelectorProps["onChange"];
  currency: string;
}

export function PortfolioHeroCard({ cash = [], includeCash = true, onIncludeCashChange, costImpact, includeFees = true, includeTaxes = true, onIncludeFeesChange, onIncludeTaxesChange, summary, breakdown, series, period, onPeriodChange, range, today, onRangeChange, currency }: PortfolioHeroCardProps) {
  const format = (amount: number) => formatCurrency(amount, currency, { maximumFractionDigits: 0 });
  const simulation = simulateCostExclusions(costImpact, series, summary.totalValue, includeFees, includeTaxes);
  const cashTotal = cash.reduce((total, account) => total + account.balance, 0);
  const displayedValue = simulation.value + (includeCash ? cashTotal : 0);
  const gaining = breakdown.market >= 0;
  const marketPct = breakdown.paid > 0 ? breakdown.market / breakdown.paid : null;
  const hasHistory = series.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Il tuo portafoglio</CardTitle>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="font-heading text-4xl font-medium tabular-nums text-foreground sm:text-5xl">{format(displayedValue)}</p>
            {!simulation.active && summary.dayChange !== null && summary.dayChangePct !== null ? (
              <p className={cn("text-sm tabular-nums", summary.dayChange < 0 ? "text-neg" : "text-pos")}>
                {summary.dayChange < 0 ? "−" : "+"}
                {format(Math.abs(summary.dayChange))} ({pctText(summary.dayChangePct)})
                <span className="text-muted-foreground"> dall&apos;ultima chiusura</span>
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {cash.length > 0 && onIncludeCashChange ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch size="sm" checked={includeCash} onCheckedChange={onIncludeCashChange} />
              Includi liquidità
            </label>
          ) : null}
          <PortfolioPeriodSelector value={period} onChange={onPeriodChange} range={range} today={today} onRangeChange={onRangeChange} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {cash.length > 0 ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{includeCash ? `Titoli ${format(summary.totalValue)} · Liquidità ${format(cashTotal)}` : "Solo titoli · liquidità esclusa dal totale"}</p>
          </div>
        ) : null}
        {simulation.active ? <p className="text-sm text-muted-foreground">Simulazione · {simulation.extra >= 0 ? "+" : ""}{formatCurrency(simulation.extra, currency)} rispetto al valore registrato.</p> : null}
        {!simulation.active ? <>
        <p className="max-w-prose text-balance text-base text-foreground">
          Per quello che possiedi hai pagato <span className="font-semibold tabular-nums">{format(breakdown.paid)}</span>: il mercato ha{" "}
          {gaining ? "aggiunto" : "tolto"}{" "}
          <span className={cn("font-semibold tabular-nums", gaining ? "text-pos" : "text-neg")}>
            {gaining ? "+" : "−"}
            {format(Math.abs(breakdown.market))}
            {marketPct !== null ? ` (${pctText(marketPct)})` : ""}
          </span>
          .
          {breakdown.cashedIn !== 0 ? (
            <span className="text-muted-foreground">
              {" "}
              Hai già {breakdown.cashedIn > 0 ? "incassato" : "perso"} {format(Math.abs(breakdown.cashedIn))} tra vendite, dividendi e cedole.
            </span>
          ) : null}
          {summary.unpricedCount > 0 ? (
            <span className="text-muted-foreground">
              {" "}
              {summary.unpricedCount === 1 ? "Uno strumento non ha" : `${summary.unpricedCount} strumenti non hanno`} ancora un prezzo e
              non è contato.
            </span>
          ) : null}
        </p>
        <ValueBreakdownBar breakdown={breakdown} currency={currency} />
        </> : null}
        {costImpact ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <label className="flex cursor-pointer items-center gap-2"><Switch size="sm" checked={!includeFees} onCheckedChange={(checked) => onIncludeFeesChange?.(!checked)} disabled={!costImpact.available} />Reinvesti costi</label>
            <label className="flex cursor-pointer items-center gap-2"><Switch size="sm" checked={!includeTaxes} onCheckedChange={(checked) => onIncludeTaxesChange?.(!checked)} disabled={!costImpact.available} />Reinvesti imposte</label>
          </div>
        ) : null}
        {hasHistory ? (
          <div className="flex flex-col gap-2">
            <ChartContainer config={CHART_CONFIG} className="max-h-56 w-full">
              <AreaChart data={simulation.series}>
                <defs>
                  <linearGradient id={AREA_FILL_ID} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <ChartTooltip cursor={false} content={<Tooltip currency={currency} />} />
                <Area type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={series.length === 1} fill={`url(#${AREA_FILL_ID})`} />
                <Line type="stepAfter" dataKey="invested" stroke="var(--color-invested)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ChartContainer>
            <p className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded-full bg-primary" aria-hidden="true" /> Valore
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 border-t border-dashed border-muted-foreground" aria-hidden="true" /> Versato (acquisti meno vendite)
              </span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nessun dato disponibile nel periodo selezionato.</p>
        )}
      </CardContent>
    </Card>
  );
}
