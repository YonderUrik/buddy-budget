"use client";

/** Grafico delle chiusure di un titolo con selettore del periodo. Colore verde o rosso secondo l'andamento del periodo. */

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { SegmentedControl } from "@/components/domain/shared";
import { ChartSplineIcon } from "lucide-react";
import { PanelSection } from "../panel-section";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { parseDateOnly } from "@/lib/calc/expenses";
import { TITLE_CHART_PERIODS, type CloseInput, type TitleChartPeriod } from "@/lib/investments/title-stats";
import { formatPrice } from "./title-format";

const PERIOD_OPTIONS = TITLE_CHART_PERIODS.map((p) => ({ value: p, label: p }));
const TOOLTIP_DATE_FORMAT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });
const AXIS_DATE_FORMAT = new Intl.DateTimeFormat("it-IT", { month: "short", year: "2-digit" });

function Tooltip({ active, payload, currency }: { active?: boolean; payload?: { payload: CloseInput }[]; currency: string }) {
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
}

export function TitlePriceChart({ series, currency, period, onPeriodChange, backfilling }: TitlePriceChartProps) {
  const up = series.length < 2 || series[series.length - 1].close >= series[0].close;
  const color = up ? "var(--pos)" : "var(--neg)";
  const config = { close: { label: "Chiusura", color } } satisfies ChartConfig;
  return (
    <PanelSection
      icon={ChartSplineIcon}
      title="Andamento"
      color={color}
      action={<SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={onPeriodChange} ariaLabel="Periodo del grafico" stretch className="sm:w-auto" />}
    >
      <div>
        {series.length < 2 ? (
          <p className="py-10 text-center text-sm text-muted-foreground" role="status">
            {backfilling ? "Sto scaricando lo storico dei prezzi…" : "Non ci sono ancora abbastanza prezzi per il grafico."}
          </p>
        ) : (
          <>
            <ChartContainer config={config} className="-mx-4 h-56 w-[calc(100%+2rem)] sm:-mx-6 sm:h-72 sm:w-[calc(100%+3rem)] lg:mx-0 lg:w-full">
              <AreaChart data={series} margin={{ left: 4, right: 8 }}>
                <defs>
                  <linearGradient id="title-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                <Area type="monotone" dataKey="close" stroke={color} strokeWidth={2} fill="url(#title-fill)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ChartContainer>
            {backfilling ? <p className="mt-2 text-xs text-muted-foreground">Sto ancora scaricando lo storico: il grafico si completa da solo.</p> : null}
          </>
        )}
      </div>
    </PanelSection>
  );
}
