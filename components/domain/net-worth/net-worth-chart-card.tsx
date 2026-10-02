/**
 * Card principale della Panoramica: patrimonio netto attuale, variazione nel periodo, selettore periodo e grafico ad
 * aree impilate, un'area per classe di asset (liquidità alla base, investimenti sopra): il bordo superiore è il totale.
 */

import { Area, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { NetWorthChange, NetWorthPeriod, NetWorthSeriesPoint } from "@/lib/calc/net-worth";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { assetClassColor, assetClassesInSeries, assetClassLabel } from "./asset-classes";
import { NetWorthChartTooltip } from "./net-worth-chart-tooltip";
import { NetWorthPeriodSelector } from "./net-worth-period-selector";

const STACK_ID = "net-worth";
const AREA_FILL_ID_PREFIX = "net-worth-area-fill-";
/** Classe mostrata quando la serie è tutta a zero (nessuna classe con valori). */
const DEFAULT_CLASS = "liquidita";
/** Classe in negativo: non si impila (le aree sono i beni), si mostra nel tooltip e nella linea del netto. */
const LIABILITY_CLASS = "debiti";

/** Classe che l'utente può escludere dal totale: i soldi sono suoi ma non subito disponibili. */
const PENSION_CLASS = "previdenza";
const PENSION_SWITCH_LABEL = "Includi la previdenza nel totale";
const PENSION_EXCLUDED_NOTE = "Area grigia: previdenza, non inclusa nel totale";
const PENSION_EXCLUDED_TOTAL_LABEL = "Totale senza previdenza";

const PERIOD_CHANGE_LABELS: Record<NetWorthPeriod, string> = {
  "1mese": "nell'ultimo mese",
  "3mesi": "negli ultimi 3 mesi",
  "1anno": "nell'ultimo anno",
  max: "dall'inizio",
};

const NO_HISTORY_MESSAGE = "L'andamento comparirà nei prossimi giorni.";

function buildChartConfig(classes: string[]): ChartConfig {
  return Object.fromEntries(classes.map((key) => [key, { label: assetClassLabel(key), color: assetClassColor(key) }]));
}

export interface NetWorthChartCardProps {
  series: NetWorthSeriesPoint[];
  change: NetWorthChange;
  period: NetWorthPeriod;
  onPeriodChange: (period: NetWorthPeriod) => void;
  currency: string;
  /** Se la previdenza conta nel totale (la serie e `change` sono già calcolati di conseguenza). Con `onPensionIncludedChange` mostra l'interruttore. */
  pensionIncluded?: boolean;
  onPensionIncludedChange?: (included: boolean) => void;
}

export function NetWorthChartCard({
  series,
  change,
  period,
  onPeriodChange,
  currency,
  pensionIncluded = true,
  onPensionIncludedChange,
}: NetWorthChartCardProps) {
  const hasHistory = series.length >= 2;
  const isNegative = change.delta < 0;
  const sign = isNegative ? "−" : "+";
  const pctText = change.deltaPct !== null ? ` (${sign}${Math.abs(change.deltaPct * 100).toFixed(1)}%)` : "";
  const presentClasses = assetClassesInSeries(series);
  const hasDebts = presentClasses.includes(LIABILITY_CLASS);
  const assetClasses = presentClasses.filter((key) => key !== LIABILITY_CLASS);
  const classes = assetClasses.length > 0 ? assetClasses : [DEFAULT_CLASS];
  const tooltipClasses = hasDebts ? [...classes, LIABILITY_CLASS] : classes;
  const hasPension = classes.includes(PENSION_CLASS);
  const pensionExcluded = hasPension && !pensionIncluded;
  // Senza previdenza il bordo dell'area non è più il totale: serve la linea del netto.
  const showNetLine = hasDebts || pensionExcluded;

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
        {hasPension && onPensionIncludedChange ? (
          <div className="flex w-full items-center gap-2">
            <Switch id="pension-in-net-worth" size="sm" checked={pensionIncluded} onCheckedChange={onPensionIncludedChange} />
            <Label htmlFor="pension-in-net-worth" className="text-xs font-normal text-muted-foreground">
              {PENSION_SWITCH_LABEL}
            </Label>
          </div>
        ) : null}
      </CardHeader>
      {hasHistory ? (
        <CardContent>
          <ChartContainer config={buildChartConfig(classes)} className="max-h-64 w-full">
            <ComposedChart data={series}>
              <defs>
                {classes.map((key) => (
                  <linearGradient key={key} id={`${AREA_FILL_ID_PREFIX}${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={`var(--color-${key})`} stopOpacity={key === PENSION_CLASS && pensionExcluded ? 0.3 : 0.55} />
                    <stop offset="100%" stopColor={`var(--color-${key})`} stopOpacity={key === PENSION_CLASS && pensionExcluded ? 0.08 : 0.15} />
                  </linearGradient>
                ))}
              </defs>
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis hide />
              <ChartTooltip cursor={false} content={<NetWorthChartTooltip currency={currency} classes={tooltipClasses} totalLabel={pensionExcluded ? PENSION_EXCLUDED_TOTAL_LABEL : undefined} />} />
              {classes.map((key) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={(point: NetWorthSeriesPoint) => point.byClass[key] ?? 0}
                  name={key}
                  stackId={STACK_ID}
                  stroke={`var(--color-${key})`}
                  strokeWidth={2}
                  strokeDasharray={key === PENSION_CLASS && pensionExcluded ? "2 3" : undefined}
                  fill={`url(#${AREA_FILL_ID_PREFIX}${key})`}
                />
              ))}
            {showNetLine ? (
                <Line
                  type="monotone"
                  dataKey="value"
                  name="netto"
                  stroke="var(--foreground)"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                />
              ) : null}
            </ComposedChart>
          </ChartContainer>
          {classes.length > 1 || showNetLine ? (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {tooltipClasses.map((key) => (
                <li key={key} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: assetClassColor(key) }} aria-hidden="true" />
                  {assetClassLabel(key)}
                </li>
              ))}
              {showNetLine ? <li className="text-muted-foreground">Linea tratteggiata: patrimonio netto</li> : null}
              {pensionExcluded ? <li className="text-muted-foreground">{PENSION_EXCLUDED_NOTE}</li> : null}
            </ul>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
