"use client";

/** TWR cumulato: puntatore per l’anteprima e trascinamento per fissare un intervallo inclusivo. */
import * as React from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { parseDateOnly } from "@/lib/calc/expenses";
import type { ReturnSeriesPoint } from "@/lib/calc/returns";
import type { PortfolioChartRange } from "@/lib/investments/chart-period";
import { formatSignedPct } from "./gain-text";

const CHART_CONFIG = {
  portfolio: { label: "Portafoglio · TWR", color: "var(--primary)" },
  benchmark: { label: "Confronto", color: "var(--swatch-amber)" },
} satisfies ChartConfig;
const TOOLTIP_DATE_FORMAT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });
const AXIS_DATE_FORMAT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "2-digit" });
const axisPct = (value: number) => `${(value * 100).toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`;

function Tooltip({ active, payload, benchmarkName }: { active?: boolean; payload?: { payload: ReturnSeriesPoint }[]; benchmarkName: string | null }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
    <p className="text-muted-foreground">{TOOLTIP_DATE_FORMAT.format(parseDateOnly(point.date))}</p>
    <p className="tabular-nums text-foreground">Portafoglio · TWR {formatSignedPct(point.portfolio)}</p>
    {benchmarkName && point.benchmark !== null ? <p className="tabular-nums text-muted-foreground">{benchmarkName} {formatSignedPct(point.benchmark)}</p> : null}
  </div>;
}

export interface ReturnsChartProps {
  series: ReturnSeriesPoint[];
  benchmarkName: string | null;
  onInspect: (date: string | null) => void;
  onSelectRange: (range: PortfolioChartRange) => void;
}

/** Il grafico resta stabile durante l’anteprima; cambia finestra soltanto al termine del trascinamento. */
export function ReturnsChart({ series, benchmarkName, onInspect, onSelectRange }: ReturnsChartProps) {
  const start = React.useRef<string | null>(null);
  const [drag, setDrag] = React.useState<PortfolioChartRange | null>(null);
  const dates = React.useMemo(() => new Set(series.map((point) => point.date)), [series]);
  const dateAt = (label: string | number | undefined) => typeof label === "string" && dates.has(label) ? label : null;
  function clear() {
    start.current = null;
    setDrag(null);
    onInspect(null);
  }
  return <div className="flex flex-col gap-2" data-testid="performance-chart">
    <div>
      <h3 className="text-sm font-medium">Rendimento del portafoglio · TWR cumulato</h3>
      <p className="text-xs text-muted-foreground">Base 0% a inizio periodo. Il grafico mostra il rendimento degli investimenti, indipendente dai versamenti.</p>
      <p className="text-xs text-muted-foreground">Passa su una data per aggiornare i numeri sopra. Clicca e trascina per selezionare un intervallo, oppure usa le date in «Personalizzato».</p>
    </div>
    <ChartContainer config={CHART_CONFIG} className="h-64 w-full select-none">
      <LineChart data={series} margin={{ left: 4, right: 8 }}
        onMouseMove={(state) => {
          const date = dateAt(state.activeLabel);
          if (!date) return;
          if (start.current) setDrag({ from: start.current, to: date });
          else onInspect(date);
        }}
        onMouseDown={(state) => {
          const date = dateAt(state.activeLabel);
          if (date) { start.current = date; setDrag({ from: date, to: date }); onInspect(null); }
        }}
        onMouseUp={(state) => {
          const end = dateAt(state.activeLabel) ?? drag?.to;
          const from = start.current;
          if (!from) return;
          clear();
          if (from && end && from !== end) {
            const [lower, upper] = [from, end].sort();
            onSelectRange({ from: lower, to: upper });
          }
        }}
        onMouseLeave={clear}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={(date: string) => AXIS_DATE_FORMAT.format(parseDateOnly(date))} tickLine={false} axisLine={false} minTickGap={36} />
        <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={axisPct} />
        <ReferenceLine y={0} stroke="var(--border)" />
        {drag ? <ReferenceArea x1={drag.from} x2={drag.to} fill="var(--primary)" fillOpacity={0.12} /> : null}
        <ChartTooltip cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} content={<Tooltip benchmarkName={benchmarkName} />} />
        <Line type="monotone" dataKey="portfolio" stroke="var(--color-portfolio)" strokeWidth={2} dot={false} isAnimationActive={false} />
        {benchmarkName ? <Line type="monotone" dataKey="benchmark" stroke="var(--color-benchmark)" strokeWidth={1.5} dot={false} isAnimationActive={false} /> : null}
      </LineChart>
    </ChartContainer>
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-primary" aria-hidden="true" />Portafoglio · TWR</span>
      {benchmarkName ? <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-[var(--swatch-amber)]" aria-hidden="true" />{benchmarkName}</span> : null}
    </p>
  </div>;
}
