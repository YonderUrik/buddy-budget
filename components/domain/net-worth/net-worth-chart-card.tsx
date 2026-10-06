"use client";

/**
 * Card principale della Panoramica: patrimonio netto attuale, variazione nel periodo, selettore periodo e grafico ad
 * aree impilate, un'area per classe di asset (liquidità alla base, investimenti sopra): il bordo superiore è il totale.
 */

import * as React from "react";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { SegmentedControl } from "@/components/domain/shared";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { computeNetWorthChange, restrictSeriesToClasses, type NetWorthChange, type NetWorthPeriod, type NetWorthSeriesPoint } from "@/lib/calc/net-worth";
import { track } from "@/lib/analytics/track";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { assetClassColor, assetClassesInSeries, assetClassLabel } from "./asset-classes";
import { countedClasses, PENSION_CLASS, toggleHiddenClass, visibleClasses } from "./net-worth-chart.utils";
import { NetWorthChartTooltip } from "./net-worth-chart-tooltip";
import { MoneyHero } from "./money-hero";
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
type ChartView = "totale" | "classi";
const VIEW_OPTIONS = [
  { value: "totale", label: "Totale" },
  { value: "classi", label: "Per classe" },
] as const satisfies readonly { value: ChartView; label: string }[];
/** Margine del dominio verticale della vista "Totale": la linea riempie l'altezza invece di partire da zero. */
const TOTAL_DOMAIN_LOW = 0.9;
const TOTAL_DOMAIN_HIGH = 1.01;
const NET_LINE_NOTE = "Linea scura: patrimonio netto";
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
  const [view, setView] = React.useState<ChartView>("totale");
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

  const lastPoint = shownSeries[shownSeries.length - 1];
  const chartSummary = hasHistory
    ? `Patrimonio netto ${PERIOD_CHANGE_LABELS[period]}: da ${formatCurrency(shownChange.start, currency, { maximumFractionDigits: 0 })} a ${formatCurrency(shownChange.end, currency, { maximumFractionDigits: 0 })}.`
    : "";

  const isTotalView = view === "totale";
  // Le voci nascoste valgono solo nella vista per classe: tornando al totale si riparte da tutto visibile.
  const handleViewChange = (next: ChartView) => {
    if (next === "totale") setHidden(new Set());
    setView(next);
  };
  const totalTooltipClasses = showDebts ? [...allClasses, LIABILITY_CLASS] : allClasses;

  return (
    <section aria-labelledby="net-worth-title" className="flex flex-col gap-4">
      <div className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="net-worth-title" className="text-base font-medium text-muted-foreground">
            Patrimonio netto
          </h2>
          <MoneyHero value={shownChange.end} currency={currency} className="text-5xl sm:text-6xl" />
          {isPartial ? (
            <p className="text-sm font-medium text-muted-foreground">
              {PARTIAL_TOTAL_LABEL}, nascosto: {hiddenLabels.join(", ")}
            </p>
          ) : null}
          {hasHistory ? (
            <p className={cn("font-mono text-sm tabular-nums", isNegative ? "text-neg" : "text-pos")}>
              {isNegative ? <TrendingDownIcon className="mr-1 inline size-4" aria-hidden="true" /> : <TrendingUpIcon className="mr-1 inline size-4" aria-hidden="true" />}
              {sign}
              {formatCurrency(Math.abs(shownChange.delta), currency, { maximumFractionDigits: 0 })}
              {pctText} <span className="font-sans text-muted-foreground">{PERIOD_CHANGE_LABELS[period]}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{NO_HISTORY_MESSAGE}</p>
          )}
        </div>
        {hasHistory && allClasses.length > 1 ? (
          <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={handleViewChange} ariaLabel="Vista del grafico" />
        ) : null}
        {hasPension && onPensionIncludedChange ? (
          <div className="flex w-full items-center gap-2">
            <Switch id="pension-in-net-worth" size="sm" checked={pensionIncluded} onCheckedChange={onPensionIncludedChange} />
            <Label htmlFor="pension-in-net-worth" className="text-sm font-normal text-muted-foreground">
              {PENSION_SWITCH_LABEL}
            </Label>
          </div>
        ) : null}
      </div>
      {hasHistory ? (
        <div className="flex flex-col gap-4">
          <p className="sr-only">{chartSummary}</p>
          <div className="-mx-4 sm:-mx-6">
            <ChartContainer config={buildChartConfig(allClasses)} className="aspect-auto h-60 w-full sm:h-80">
              {isTotalView ? (
                <ComposedChart data={series} accessibilityLayer margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="net-worth-total-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" hide />
                  <YAxis hide domain={[(min: number) => min * TOTAL_DOMAIN_LOW, (max: number) => max * TOTAL_DOMAIN_HIGH]} />
                  <ChartTooltip cursor={{ stroke: "var(--border)" }} content={<NetWorthChartTooltip currency={currency} classes={totalTooltipClasses} totalLabel={pensionExcluded ? PENSION_EXCLUDED_TOTAL_LABEL : undefined} />} />
                  <Area type="monotone" dataKey="value" name="netto" stroke="var(--primary)" strokeWidth={2} fill="url(#net-worth-total-fill)" activeDot={{ r: 4 }} />
                </ComposedChart>
              ) : (
                <ComposedChart data={shownSeries} accessibilityLayer>
                  <defs>
                    {allClasses.map((key) => (
                      <linearGradient key={key} id={`${AREA_FILL_ID_PREFIX}${key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={`var(--color-${key})`} stopOpacity={key === PENSION_CLASS && pensionExcluded ? 0.22 : 0.4} />
                        <stop offset="100%" stopColor={`var(--color-${key})`} stopOpacity={key === PENSION_CLASS && pensionExcluded ? 0.05 : 0.08} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={32} tickMargin={8} tick={{ fontSize: 13 }} />
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
                      strokeWidth={1.5}
                      strokeDasharray={key === PENSION_CLASS && pensionExcluded ? "2 3" : undefined}
                      fill={`url(#${AREA_FILL_ID_PREFIX}${key})`}
                    />
                  ))}
                  {showNetLine ? <Line type="monotone" dataKey="value" name="netto" stroke="var(--foreground)" strokeWidth={2.5} dot={false} /> : null}
                </ComposedChart>
              )}
            </ChartContainer>
          </div>
          <div className="flex justify-center">
            <NetWorthPeriodSelector value={period} onChange={onPeriodChange} />
          </div>
          {!isTotalView && (allClasses.length > 1 || showNetLine) ? (
            <div className="flex flex-col gap-2">
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
                          {lastPoint ? (
                            <span className="font-heading font-medium tabular-nums text-foreground">
                              {formatCurrency(lastPoint.byClass[key] ?? 0, currency, { maximumFractionDigits: 0 })}
                            </span>
                          ) : null}
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
                {showNetLine ? <li>{NET_LINE_NOTE}</li> : null}
                {showDebts ? <li>{DEBTS_NOTE}</li> : null}
                {pensionVisibleExcluded ? <li>{PENSION_EXCLUDED_NOTE}</li> : null}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
