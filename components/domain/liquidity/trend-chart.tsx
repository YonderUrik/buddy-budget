/** Grafico ad area a tutta larghezza: una linea con sfumatura morbida, senza assi pesanti. Accessibile via descrizione testuale. */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TrendPoint {
  /** Etichetta del punto (per la descrizione e il titolo). */
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

export function TrendChart({ points, description, color = "var(--primary)", reference, height = 260, className }: TrendChartProps) {
  const gradientId = React.useId();
  if (points.length < 2) return <div className={cn("rounded-xl bg-muted/50", className)} style={{ height }} aria-hidden="true" />;
  const values = [...points.map((p) => p.value), ...(reference ?? [])];
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const columns = Math.max(reference?.length ?? 0, points.length) - 1;
  const toY = (value: number) => height * (1 - PADDING_RATIO) - ((value - low) / span) * height * (1 - 2 * PADDING_RATIO);
  const coords = points.map((p, i) => ({ x: (i * VIEW_WIDTH) / columns, y: toY(p.value) }));
  const line = smoothPath(coords);
  const referenceLine = reference ? smoothPath(reference.map((value, i) => ({ x: (i * VIEW_WIDTH) / columns, y: toY(value) }))) : null;
  return (
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
  );
}
