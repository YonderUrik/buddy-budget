"use client";

/** Mini andamento della liquidità negli ultimi 30 giorni: linea con area e variazione a parole. Non compare con meno di due punti. */

import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const TREND_WIDTH = 220;
const TREND_HEIGHT = 56;
const TREND_PADDING = 4;

export interface AccountsTrendProps {
  /** Valori della liquidità nel tempo, dal più vecchio al più recente. */
  values: number[];
  currency: string;
  className?: string;
}

/** Punti della linea in coordinate SVG; una serie piatta resta a metà altezza. */
export function buildTrendPoints(values: number[]): string[] {
  const min = Math.min(...values);
  const span = Math.max(...values) - min;
  const step = (TREND_WIDTH - TREND_PADDING * 2) / (values.length - 1);
  return values.map((value, i) => {
    const y = span === 0 ? TREND_HEIGHT / 2 : TREND_PADDING + (1 - (value - min) / span) * (TREND_HEIGHT - TREND_PADDING * 2);
    return `${(TREND_PADDING + i * step).toFixed(1)},${y.toFixed(1)}`;
  });
}

export function AccountsTrend({ values, currency, className }: AccountsTrendProps) {
  if (values.length < 2) return null;
  const points = buildTrendPoints(values);
  const delta = values[values.length - 1] - values[0];
  const last = points[points.length - 1];
  const [lastX, lastY] = last.split(",");
  const summary =
    delta === 0
      ? "Invariata negli ultimi 30 giorni"
      : `${delta > 0 ? "+" : "−"}${formatCurrency(Math.abs(delta), currency, { maximumFractionDigits: 0 })} negli ultimi 30 giorni`;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <svg viewBox={`0 0 ${TREND_WIDTH} ${TREND_HEIGHT}`} className="w-full max-w-[260px]" role="img" aria-label={summary}>
        <polygon
          points={`${TREND_PADDING},${TREND_HEIGHT} ${points.join(" ")} ${TREND_WIDTH - TREND_PADDING},${TREND_HEIGHT}`}
          className="fill-primary/10"
        />
        <polyline points={points.join(" ")} fill="none" strokeWidth={2} strokeLinejoin="round" className="stroke-primary" />
        <circle cx={lastX} cy={lastY} r={3.5} className="fill-primary" />
      </svg>
      <p className={cn("text-sm tabular-nums", delta < 0 ? "text-neg" : delta > 0 ? "text-pos" : "text-text-2")}>{summary}</p>
    </div>
  );
}
