"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/**
 * Sezione principale di Investimenti (senza riquadro, come la Panoramica): valore di oggi, la sua lettura in parole ("hai pagato X, il mercato ha aggiunto Y"),
 * la barra che lo scompone e l'andamento nel tempo del valore contro quanto hai versato.
 * Su mobile il grafico segue subito il valore; lettura in parole, barra e simulazione dei costi vanno sotto il grafico.
 */

import { ReinvestmentControl } from "./reinvestment-panel";
import { PeriodGainSummary } from "./period-gain-summary";
import type { PeriodGain } from "@/lib/investments/period-gain";
import { simulateCostExclusions } from "@/lib/investments/cost-impact";
import type { BrokerCash } from "@/lib/investments/broker-cash";
import type { CostImpact } from "@/lib/investments/cost-impact";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Area, AreaChart, Line, XAxis, YAxis } from "recharts";
import { PortfolioPeriodSelector, type PortfolioPeriodSelectorProps } from "./portfolio-period-selector";
import { MoneyHero } from "@/components/domain/net-worth";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { parseDateOnly } from "@/lib/calc/expenses";
import type { PortfolioSeriesPoint, PortfolioSummary } from "@/lib/calc/investments";
import type { ValueBreakdown } from "@/lib/investments/insights";

import { cn } from "@/lib/utils";
import { ValueBreakdownBar } from "./value-breakdown-bar";
import { PAGE_BLEED } from "@/components/domain/shared";

const CHART_CONFIG = {
  value: { label: "Valore", color: "var(--primary)" },
  invested: { label: "Versato", color: "var(--muted-foreground)" },
  registered: { label: "Valore registrato", color: "var(--foreground)" },
} satisfies ChartConfig;
/** Margini del dominio verticale: la linea riempie l'altezza invece di partire da zero (come in Panoramica). */
const CHART_DOMAIN_LOW = 0.9;
const CHART_DOMAIN_HIGH = 1.01;


function Tooltip({ active, payload, currency }: { active?: boolean; payload?: { payload: PortfolioSeriesPoint }[]; currency: string }) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);
  const TOOLTIP_DATE_FORMAT = new Intl.DateTimeFormat(formattingLocale, { day: "numeric", month: "long", year: "numeric" });

  const { t: tr } = useLocalization();
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const diff = point.value - point.invested;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
      <p className="text-muted-foreground">{TOOLTIP_DATE_FORMAT.format(parseDateOnly(point.date))}</p>
      <p className="tabular-nums text-foreground">{tr("Valore")}{" "}{formatCurrency(point.value, currency)}</p>
      <p className="tabular-nums text-muted-foreground">{tr("Versato")}{" "}{formatCurrency(point.invested, currency)}</p>
      <p className={cn("tabular-nums", diff < 0 ? "text-neg" : "text-pos")}>
        {diff < 0 ? "−" : "+"}
        {formatCurrency(Math.abs(diff), currency)}
      </p>
    </div>
  );
}

export interface PortfolioHeroCardProps extends Omit<PortfolioPeriodSelectorProps, "value" | "onChange"> {
  cash?: BrokerCash[];
  costImpact?: CostImpact;
  /** Guadagno del periodo scelto: se presente e il periodo non è «Tutto», sostituisce la frase sul guadagno totale. */
  periodGain?: PeriodGain | null;
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

export function PortfolioHeroCard({ cash = [], costImpact, periodGain, includeFees = true, includeTaxes = true, onIncludeFeesChange, onIncludeTaxesChange, summary, breakdown, series, period, onPeriodChange, range, today, onRangeChange, currency }: PortfolioHeroCardProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency, formatSignedPct } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const format = (amount: number) => formatCurrency(amount, currency, { maximumFractionDigits: 0 });
  const simulation = simulateCostExclusions(costImpact, series, summary.totalValue, includeFees, includeTaxes);
  const cashTotal = cash.reduce((total, account) => total + account.balance, 0);
  const displayedValue = simulation.value;
  const gaining = breakdown.market >= 0;
  const marketPct = breakdown.paid > 0 ? breakdown.market / breakdown.paid : null;
  const showPeriodGain = !!periodGain && period !== "max";
  const chartData = simulation.active ? simulation.series.map((point, i) => ({ ...point, registered: series[i]?.value })) : series;
  const hasHistory = series.length > 0;

  return (
    <section aria-labelledby="portfolio-hero-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 max-sm:order-1">
        <div className="space-y-1">
          <h2 id="portfolio-hero-title" className="text-base font-medium text-muted-foreground">{tr("Il tuo portafoglio")}</h2>
          <MoneyHero value={displayedValue} currency={currency} className="text-5xl sm:text-6xl" />
          {!simulation.active && summary.dayChange !== null && summary.dayChangePct !== null ? (
            <p className={cn("text-sm tabular-nums", summary.dayChange < 0 ? "text-neg" : "text-pos")}>
              {summary.dayChange < 0 ? <TrendingDownIcon className="mr-1 inline size-4" aria-hidden="true" /> : <TrendingUpIcon className="mr-1 inline size-4" aria-hidden="true" />}
              {summary.dayChange < 0 ? "−" : "+"}
              {format(Math.abs(summary.dayChange))} {"("}{formatSignedPct(summary.dayChangePct)}{")"}<span className="font-sans text-muted-foreground">{" "}{tr("dall'ultima chiusura")}</span>
            </p>
          ) : null}
          {cash.length > 0 ? (
            <p className="text-sm text-muted-foreground">{tr("Solo titoli. In più hai")}{" "}{format(cashTotal)}{" "}{tr("di liquidità sui broker (totale")}{" "}{format(summary.totalValue + cashTotal)}{")."}</p>
          ) : null}
          {simulation.active ? <p className="text-sm text-muted-foreground">{tr("Simulazione ·")}{" "}{simulation.extra >= 0 ? "+" : ""}{formatCurrency(simulation.extra, currency)}{" "}{tr("rispetto al valore registrato.")}</p> : null}
        </div>
      </div>
      {!simulation.active ? (
        <div className="flex max-w-3xl flex-col gap-3 max-sm:order-4">
          {showPeriodGain && periodGain ? <PeriodGainSummary gain={periodGain} currency={currency} /> : (
          <p className="max-w-prose text-balance text-base text-foreground">{tr("Per quello che possiedi hai pagato")}{" "}<span className="font-semibold tabular-nums">{format(breakdown.paid)}</span>{tr(": il mercato ha")}{" "}
            {gaining ? tr("aggiunto") : tr("tolto")}{" "}
            <span className={cn("font-semibold tabular-nums", gaining ? "text-pos" : "text-neg")}>
              {gaining ? "+" : "−"}
              {format(Math.abs(breakdown.market))}
              {marketPct !== null ? ` (${formatSignedPct(marketPct)})` : ""}
            </span>
            {"."}{breakdown.cashedIn !== 0 ? (
              <span className="text-muted-foreground">
                {" "}{tr("Hai già")}{" "}{breakdown.cashedIn > 0 ? tr("incassato") : tr("perso")}{" "}{format(Math.abs(breakdown.cashedIn))}{" "}{tr("tra vendite, dividendi e cedole.")}</span>
            ) : null}
            {summary.unpricedCount > 0 ? (
              <span className="text-muted-foreground">
                {" "}
                {summary.unpricedCount === 1 ? tr("Uno strumento non ha") : tr("{0} strumenti non hanno", {0: summary.unpricedCount})}{" "}{tr("ancora un prezzo e non è contato.")}</span>
            ) : null}
          </p>
          )}
          {showPeriodGain ? null : <ValueBreakdownBar breakdown={breakdown} currency={currency} />}
        </div>
      ) : null}
      {hasHistory ? (
        <div className="flex flex-col gap-3 max-sm:order-2">
          <div className={PAGE_BLEED}>
            <ChartContainer config={CHART_CONFIG} className="aspect-auto h-60 w-full sm:h-80">
              <AreaChart data={chartData} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="label" hide />
                <YAxis hide domain={[(min: number) => min * CHART_DOMAIN_LOW, (max: number) => max * CHART_DOMAIN_HIGH]} />
                <ChartTooltip cursor={{ stroke: "var(--border)" }} content={<Tooltip currency={currency} />} />
                <Area type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={series.length === 1} fill="var(--color-value)" fillOpacity={0.12} activeDot={{ r: 4 }} />
                {simulation.active ? <Line type="monotone" dataKey="registered" stroke="var(--color-registered)" strokeWidth={1.5} dot={false} isAnimationActive={false} /> : null}
                <Line type="stepAfter" dataKey="invested" stroke="var(--color-invested)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ChartContainer>
          </div>
          <p className="flex justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full bg-primary" aria-hidden="true" />{" "}{tr("Valore")}{simulation.active ? tr(" simulato") : ""}
            </span>
            {simulation.active ? (
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded-full bg-foreground" aria-hidden="true" />{" "}{tr("Valore registrato (senza simulazione)")}</span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t border-dashed border-muted-foreground" aria-hidden="true" />{" "}{tr("Versato (acquisti meno vendite)")}</span>
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground max-sm:order-2">{tr("Nessun dato disponibile nel periodo selezionato.")}</p>
      )}
      <div className="flex flex-wrap items-start justify-center gap-x-3 gap-y-2 max-sm:order-3">
        <PortfolioPeriodSelector value={period} onChange={onPeriodChange} range={range} today={today} onRangeChange={onRangeChange} />
        {costImpact ? (
          <ReinvestmentControl impact={costImpact} currency={currency} includeFees={includeFees} includeTaxes={includeTaxes} onIncludeFeesChange={onIncludeFeesChange} onIncludeTaxesChange={onIncludeTaxesChange} />
        ) : null}
      </div>
    </section>
  );
}
