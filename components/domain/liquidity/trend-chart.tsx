"use client";

/**
 * Grafico ad area a tutta larghezza: una linea con sfumatura morbida, senza assi pesanti. Accessibile via descrizione testuale.
 * Al passaggio del mouse o al tocco compare il punto più vicino con data e valore (e il valore di confronto, se c'è).
 */

import * as React from "react";
import { parseDateOnly } from "@/lib/calc/expenses";
import { cn } from "@/lib/utils";

export interface TrendPoint {
  /** Data del punto (`AAAA-MM-GG`), mostrata nel tooltip. */
  label: string;
  value: number;
}

export interface TrendChartProps {
  points: readonly TrendPoint[];
  /** Descrizione per chi non vede il grafico (es. "Liquidità da 17.000 € a 19.870 € negli ultimi 3 mesi"). */
  description: string;
  /** Token CSS del colore della linea. */
  color?: string;
  /** Linea tratteggiata di confronto (es. il "solito"); stessa scala del grafico, stessa lunghezza dei punti o più lunga. */
  reference?: readonly number[];
  height?: number;
  className?: string;
  /** Formatta il valore nel tooltip (es. in valuta). Senza, il tooltip non compare. */
  formatValue?: (value: number) => string;
  /** Nome del valore di confronto nel tooltip. */
  referenceLabel?: string;
}

const TOOLTIP_DATE_FORMAT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });
/** Margine (in percentuale della larghezza) entro cui il tooltip si ferma per non uscire dal grafico. */
const TOOLTIP_EDGE_PERCENT = 14;

function formatPointDate(label: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(label) ? TOOLTIP_DATE_FORMAT.format(parseDateOnly(label)) : label;
}

const VIEW_WIDTH = 1000;
const PADDING_RATIO = 0.12;

/** Curva liscia (Bézier con punti di controllo a metà strada) tra i punti. */
export function smoothPath(points: readonly { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  let d = `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const mid = (points[i - 1].x + points[i].x) / 2;
    d += ` C${mid.toFixed(1)} ${points[i - 1].y.toFixed(1)} ${mid.toFixed(1)} ${points[i].y.toFixed(1)} ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
  }
  return d;
}

export function TrendChart({ points, description, color = "var(--primary)", reference, height = 260, className, formatValue, referenceLabel = "Di solito" }: TrendChartProps) {
  const gradientId = React.useId();
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  if (points.length < 2) return <div className={cn("rounded-xl bg-muted/50", className)} style={{ height }} aria-hidden="true" />;
  const values = [...points.map((p) => p.value), ...(reference ?? [])];
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const columns = Math.max(reference?.length ?? 0, points.length) - 1;
  const toY = (value: number) => height * (1 - PADDING_RATIO) - ((value - low) / span) * height * (1 - 2 * PADDING_RATIO);
  const coords = points.map((p, i) => ({ x: (i * VIEW_WIDTH) / columns, y: toY(p.value) }));
  const line = smoothPath(coords);
  const referenceLine = reference ? smoothPath(reference.map((value, i) => ({ x: (i * VIEW_WIDTH) / columns, y: toY(value) }))) : null;
  const activePoint = activeIndex !== null ? points[activeIndex] : null;
  const activeLeft = activeIndex !== null ? (activeIndex / columns) * 100 : 0;
  const activeTop = activePoint ? (toY(activePoint.value) / height) * 100 : 0;
  const referenceValue = activeIndex !== null ? reference?.[activeIndex] : undefined;
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const index = Math.round(((event.clientX - rect.left) / rect.width) * columns);
    setActiveIndex(Math.min(Math.max(index, 0), points.length - 1));
  };
  return (
    <div
      className={cn("relative", formatValue && "touch-pan-y")}
      onPointerMove={formatValue ? move : undefined}
      onPointerDown={formatValue ? move : undefined}
      onPointerLeave={formatValue ? () => setActiveIndex(null) : undefined}
      onPointerCancel={formatValue ? () => setActiveIndex(null) : undefined}
    >
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={description}
      className={cn("block w-full", className)}
      style={{ height }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.26" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {referenceLine && (
        <path d={referenceLine} fill="none" stroke="var(--text-3)" strokeWidth={2} strokeDasharray="2 7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      )}
      <path d={`${line} L${coords[coords.length - 1].x.toFixed(1)} ${height} L0 ${height} Z`} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
      {activePoint && formatValue && (
        <>
          <span className="pointer-events-none absolute inset-y-0 w-px bg-foreground/20" style={{ left: `${activeLeft}%` }} aria-hidden="true" />
          <span
            className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background"
            style={{ left: `${activeLeft}%`, top: `${activeTop}%`, backgroundColor: color }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-40 -translate-x-1/2 rounded-lg border bg-background px-3 py-2 text-sm shadow-sm"
            style={{ left: `${Math.min(Math.max(activeLeft, TOOLTIP_EDGE_PERCENT), 100 - TOOLTIP_EDGE_PERCENT)}%` }}
            role="status"
          >
            <p className="text-text-2">{formatPointDate(activePoint.label)}</p>
            <p className="font-heading font-medium tabular-nums text-foreground">{formatValue(activePoint.value)}</p>
            {referenceValue !== undefined && (
              <p className="text-text-2">
                {referenceLabel}: <span className="tabular-nums">{formatValue(referenceValue)}</span>
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
