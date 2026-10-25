"use client";
import { localizedFormats } from "@/lib/localization/format";



import { useLocalization } from "@/lib/localization/provider";

/**
 * Grafico delle chiusure di un titolo con selettore del periodo. Colore verde o rosso secondo l'andamento del periodo;
 * se possiedi il titolo segna i tuoi acquisti e una linea tratteggiata sul prezzo medio.
 */

import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, XAxis, YAxis } from "recharts";
import { PeriodSelector } from "@/components/domain/shared";
import { ChartSplineIcon } from "lucide-react";
import { PanelSection } from "../panel-section";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { parseDateOnly } from "@/lib/calc/expenses";
import { TITLE_CHART_PERIODS, type CloseInput, type TitleChartPeriod } from "@/lib/investments/title-stats";


const PERIOD_OPTIONS = TITLE_CHART_PERIODS.map((p) => ({ value: p, label: p }));



function Tooltip({ active, payload, currency }: { active?: boolean; payload?: { payload: CloseInput }[]; currency: string }) {
  const { locale: formattingLocale } = useLocalization();
  const { formatPrice } = localizedFormats(formattingLocale);


  const TOOLTIP_DATE_FORMAT = new Intl.DateTimeFormat(formattingLocale, { day: "numeric", month: "long", year: "numeric" });

  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
      <p className="text-muted-foreground">{TOOLTIP_DATE_FORMAT.format(parseDateOnly(point.date))}</p>
      <p className="tabular-nums text-foreground">{formatPrice(point.close, currency)}</p>
    </div>
  );
}

export interface TitlePriceChartProps {
  series: CloseInput[];
  currency: string;
  period: TitleChartPeriod;
  onPeriodChange: (period: TitleChartPeriod) => void;
  /** Mentre lo storico si scarica il grafico può essere incompleto. */
  backfilling: boolean;
  /** Acquisti dell'utente da segnare sul grafico (data e prezzo). */
  purchases?: { date: string; price: number }[];
  /** Prezzo medio dell'utente, come linea tratteggiata. */
  averagePrice?: number | null;
}

/** Ogni acquisto sul primo punto del grafico alla sua data o dopo (la serie è diradata); fuori periodo si salta. */
export function purchaseMarkers(series: CloseInput[], purchases: { date: string; price: number }[]): { date: string; price: number }[] {
  if (series.length === 0) return [];
  const first = series[0].date;
  const last = series[series.length - 1].date;
  return purchases
    .filter((p) => p.date >= first && p.date <= last)
    .map((p) => ({ date: series.find((point) => point.date >= p.date)!.date, price: p.price }));
}

export function TitlePriceChart({ series, currency, period, onPeriodChange, backfilling, purchases = [], averagePrice = null }: TitlePriceChartProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatPrice } = localizedFormats(formattingLocale);


  const AXIS_DATE_FORMAT = new Intl.DateTimeFormat(formattingLocale, { month: "short", year: "2-digit" });

  const { t: tr } = useLocalization();
  const markers = purchaseMarkers(series, purchases);
  const up = series.length < 2 || series[series.length - 1].close >= series[0].close;
  const color = up ? "var(--pos)" : "var(--neg)";
  const config = { close: { label: tr("Chiusura"), color } } satisfies ChartConfig;
  return (
    <PanelSection
      icon={ChartSplineIcon}
      title={tr("Andamento")}
      color={color}
      action={<PeriodSelector options={PERIOD_OPTIONS} value={period} onChange={onPeriodChange} ariaLabel={tr("Periodo del grafico")} stretch className="sm:w-auto" />}
    >
      <div>
        {series.length < 2 ? (
          <p className="py-10 text-center text-sm text-muted-foreground" role="status">
            {backfilling ? tr("Sto scaricando lo storico dei prezzi…") : tr("Non ci sono ancora abbastanza prezzi per il grafico.")}
          </p>
        ) : (
          <>
            <ChartContainer config={config} className="-mx-4 h-56 w-[calc(100%+2rem)] sm:-mx-6 sm:h-72 sm:w-[calc(100%+3rem)] md:mx-0 md:w-full">
              <AreaChart data={series} margin={{ left: 4, right: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                  tickFormatter={(d: string) => AXIS_DATE_FORMAT.format(parseDateOnly(d)).replace(".", "")}
                />
                <YAxis tickLine={false} axisLine={false} width={48} domain={["auto", "auto"]} tickFormatter={(v: number) => String(Math.round(v * 100) / 100)} />
                <ChartTooltip cursor={false} content={<Tooltip currency={currency} />} />
                <Area type="monotone" dataKey="close" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.1} dot={false} isAnimationActive={false} />
                {averagePrice !== null ? (
                  <ReferenceLine y={averagePrice} stroke="var(--primary)" strokeDasharray="5 4" ifOverflow="extendDomain" />
                ) : null}
                {markers.map((m, i) => (
                  <ReferenceDot key={`${m.date}-${i}`} x={m.date} y={m.price} r={4.5} fill="var(--primary)" stroke="var(--background)" strokeWidth={2} ifOverflow="extendDomain" />
                ))}
              </AreaChart>
            </ChartContainer>
            {markers.length > 0 || averagePrice !== null ? (
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {markers.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-primary" aria-hidden="true" />{" "}{tr("I tuoi acquisti")}</span>
                ) : null}
                {averagePrice !== null ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-4 border-t-2 border-dashed border-primary" aria-hidden="true" />{" "}{tr("Il tuo prezzo medio (")}{formatPrice(averagePrice, currency)}{")"}</span>
                ) : null}
              </p>
            ) : null}
            {backfilling ? <p className="mt-2 text-xs text-muted-foreground">{tr("Sto ancora scaricando lo storico: il grafico si completa da solo.")}</p> : null}
          </>
        )}
      </div>
    </PanelSection>
  );
}
