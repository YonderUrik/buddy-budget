"use client";

/**
 * Card principale della Panoramica: patrimonio netto attuale, variazione nel periodo, selettore periodo e grafico ad
 * aree impilate, un'area per classe di asset (liquidità alla base, investimenti sopra): il bordo superiore è il totale.
 */

import * as React from "react";
import { Area, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { computeNetWorthChange, restrictSeriesToClasses, type NetWorthChange, type NetWorthPeriod, type NetWorthSeriesPoint } from "@/lib/calc/net-worth";
import { track } from "@/lib/analytics/track";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { assetClassColor, assetClassesInSeries, assetClassLabel } from "./asset-classes";
import { countedClasses, PENSION_CLASS, toggleHiddenClass, visibleClasses } from "./net-worth-chart.utils";
import { NetWorthChartTooltip } from "./net-worth-chart-tooltip";
import { NetWorthPeriodSelector } from "./net-worth-period-selector";

const STACK_ID = "net-worth";
const AREA_FILL_ID_PREFIX = "net-worth-area-fill-";
/** Classe mostrata quando la serie è tutta a zero (nessuna classe con valori). */
const DEFAULT_CLASS = "liquidita";
/** Classe in negativo: non si impila (le aree sono i beni), si mostra nel tooltip e nella linea del netto. */
const LIABILITY_CLASS = "debiti";

/** Previdenza: l'utente può escluderla dal totale (i soldi sono suoi ma non subito disponibili). */
const PENSION_SWITCH_LABEL = "Includi la previdenza nel totale";
const PENSION_EXCLUDED_NOTE = "Area grigia: previdenza, non inclusa nel totale";
const PENSION_EXCLUDED_TOTAL_LABEL = "Totale senza previdenza";
const PARTIAL_TOTAL_LABEL = "Totale parziale";
const SHOW_ALL_LABEL = "Mostra tutto";
const DEBTS_NOTE = "Il patrimonio netto è già al netto dei debiti";
const LEGEND_LABEL = "Voci del grafico: tocca per mostrarle o nasconderle";
const TRACKED_CLASSES = ["liquidita", "investimenti", "previdenza"] as const;

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
  const [hidden, setHidden] = React.useState<ReadonlySet<string>>(() => new Set());
  const presentClasses = assetClassesInSeries(series);
  const hasDebts = presentClasses.includes(LIABILITY_CLASS);
  const assetClasses = presentClasses.filter((key) => key !== LIABILITY_CLASS);
  const allClasses = assetClasses.length > 0 ? assetClasses : [DEFAULT_CLASS];
  const classes = visibleClasses(allClasses, hidden);
  const isPartial = classes.length < allClasses.length;
  const hasPension = allClasses.includes(PENSION_CLASS);
  const pensionExcluded = hasPension && !pensionIncluded;
  // Con voci nascoste il totale è la somma delle sole voci visibili (debiti compresi nel netto solo a grafico completo).
  const shownSeries = isPartial ? restrictSeriesToClasses(series, countedClasses(classes, pensionIncluded)) : series;
  const shownChange = isPartial ? computeNetWorthChange(shownSeries) : change;
  const hasHistory = series.length >= 2;
  const isNegative = shownChange.delta < 0;
  const sign = isNegative ? "−" : "+";
  const pctText = shownChange.deltaPct !== null ? ` (${sign}${Math.abs(shownChange.deltaPct * 100).toFixed(1)}%)` : "";
  const showDebts = hasDebts && !isPartial;
  const tooltipClasses = showDebts ? [...classes, LIABILITY_CLASS] : classes;
  const pensionVisibleExcluded = pensionExcluded && classes.includes(PENSION_CLASS);
  // Con debiti o con la previdenza esclusa dal totale il bordo dell'area non è il totale: serve la linea del netto.
  const showNetLine = showDebts || pensionVisibleExcluded;
  const totalLabel = isPartial ? PARTIAL_TOTAL_LABEL : pensionExcluded ? PENSION_EXCLUDED_TOTAL_LABEL : undefined;
  const hiddenLabels = allClasses.filter((key) => hidden.has(key)).map((key) => assetClassLabel(key).toLowerCase());

  const handleToggle = (key: string) => {
    const next = toggleHiddenClass(hidden, key, allClasses);
    if (next.size === hidden.size) return;
    setHidden(next);
    track("net_worth_class_toggled", {
      assetClass: (TRACKED_CLASSES as readonly string[]).includes(key) ? (key as (typeof TRACKED_CLASSES)[number]) : "altro",
      visible: !next.has(key),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Patrimonio netto
          </CardTitle>
          <p className="font-heading text-4xl font-medium tabular-nums text-foreground">
            {formatCurrency(shownChange.end, currency, { maximumFractionDigits: 0 })}
          </p>
          {isPartial ? (
            <p className="text-xs font-medium text-muted-foreground">
              {PARTIAL_TOTAL_LABEL}, nascosto: {hiddenLabels.join(", ")}
            </p>
          ) : null}
          {hasHistory ? (
            <p className={cn("text-sm tabular-nums", isNegative ? "text-neg" : "text-pos")}>
              {sign}
              {formatCurrency(Math.abs(shownChange.delta), currency, { maximumFractionDigits: 0 })}
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
            <Label htmlFor="pension-in-net-worth" className="text-sm font-normal text-muted-foreground">
              {PENSION_SWITCH_LABEL}
            </Label>
          </div>
        ) : null}
      </CardHeader>
      {hasHistory ? (
        <CardContent>
          <ChartContainer config={buildChartConfig(allClasses)} className="max-h-64 w-full">
            <ComposedChart data={shownSeries}>
              <defs>
                {allClasses.map((key) => (
                  <linearGradient key={key} id={`${AREA_FILL_ID_PREFIX}${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={`var(--color-${key})`} stopOpacity={key === PENSION_CLASS && pensionExcluded ? 0.3 : 0.55} />
                    <stop offset="100%" stopColor={`var(--color-${key})`} stopOpacity={key === PENSION_CLASS && pensionExcluded ? 0.08 : 0.15} />
                  </linearGradient>
                ))}
              </defs>
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis hide />
              <ChartTooltip cursor={false} content={<NetWorthChartTooltip currency={currency} classes={tooltipClasses} totalLabel={totalLabel} />} />
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
          {allClasses.length > 1 || showNetLine ? (
            <div className="mt-3 flex flex-col gap-2">
              {allClasses.length > 1 ? (
                <ul className="flex flex-wrap gap-2" aria-label={LEGEND_LABEL}>
                  {allClasses.map((key) => {
                    const visible = !hidden.has(key);
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          aria-pressed={visible}
                          onClick={() => handleToggle(key)}
                          className={cn(
                            "flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                            visible ? "text-foreground hover:bg-muted" : "border-dashed text-muted-foreground hover:bg-muted",
                          )}
                        >
                          <span
                            className="size-2.5 rounded-full border"
                            style={{ backgroundColor: visible ? assetClassColor(key) : "transparent", borderColor: assetClassColor(key) }}
                            aria-hidden="true"
                          />
                          <span className={cn(!visible && "line-through")}>{assetClassLabel(key)}</span>
                        </button>
                      </li>
                    );
                  })}
                  {isPartial ? (
                    <li>
                      <button
                        type="button"
                        onClick={() => setHidden(new Set())}
                        className="min-h-11 rounded-full px-3 text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {SHOW_ALL_LABEL}
                      </button>
                    </li>
                  ) : null}
                </ul>
              ) : null}
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {showNetLine ? <li>Linea tratteggiata: patrimonio netto</li> : null}
                {showDebts ? <li>{DEBTS_NOTE}</li> : null}
                {pensionVisibleExcluded ? <li>{PENSION_EXCLUDED_NOTE}</li> : null}
              </ul>
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
