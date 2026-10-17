"use client";
import { localizedFormats } from "@/lib/localization/format";



import { useLocalization } from "@/lib/localization/provider";

/** Grafico "sott'acqua": quanto il portafoglio era sotto il suo massimo precedente, giorno per giorno. */

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { parseDateOnly } from "@/lib/calc/expenses";
import type { DrawdownPoint } from "@/lib/calc/risk";
import { formatMinusPct } from "../percent";


const CHART_CONFIG = { drawdown: { label: "Sotto il massimo", color: "var(--neg)" } } satisfies ChartConfig;


type Point = DrawdownPoint & { label: string };

/** Etichette dell'asse: un decimale quando la caduta è piccola, così non compaiono tacche tutte uguali ("-1%, -1%"). */
const AXIS_DECIMALS_BELOW = 0.05;

function makeAxisPct(minDepth: number, locale: string) {
  const decimals = Math.abs(minDepth) < AXIS_DECIMALS_BELOW ? 1 : 0;
  return (value: number) => formatMinusPct(value, decimals, locale);
}

function Tooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  const { locale: formattingLocale } = useLocalization();
  const { formatSignedPct } = localizedFormats(formattingLocale);


  const TOOLTIP_DATE_FORMAT = new Intl.DateTimeFormat(formattingLocale, { day: "numeric", month: "long", year: "numeric" });

  const { t: tr } = useLocalization();
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
      <p className="text-muted-foreground">{TOOLTIP_DATE_FORMAT.format(parseDateOnly(point.date))}</p>
      <p className="tabular-nums text-foreground">{point.drawdown === 0 ? tr("Al massimo") : tr("{0} dal massimo", {0: formatSignedPct(point.drawdown)})}</p>
    </div>
  );
}

export interface DrawdownChartProps {
  series: Point[];
}

export function DrawdownChart({ series }: DrawdownChartProps) {
  const { t: tr, locale } = useLocalization();
  const axisPct = React.useMemo(() => makeAxisPct(Math.min(...series.map((p) => p.drawdown)), locale), [series, locale]);
  return (
    <ChartContainer config={CHART_CONFIG} className="max-h-40 w-full" aria-label={tr("Perdita dal massimo nel tempo")}>
      <AreaChart data={series} margin={{ left: 4, right: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={axisPct} domain={["dataMin", 0]} />
        <ChartTooltip cursor={false} content={<Tooltip />} />
        <Area type="monotone" dataKey="drawdown" stroke="var(--color-drawdown)" strokeWidth={1.5} fill="var(--color-drawdown)" fillOpacity={0.2} isAnimationActive={false} />
      </AreaChart>
    </ChartContainer>
  );
}
