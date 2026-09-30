/** Linea minuscola dell'andamento recente di un titolo (senza assi né tooltip): verde se sale, rossa se scende. */

import { cn } from "@/lib/utils";

const WIDTH = 72;
const HEIGHT = 24;
const PADDING = 2;

export interface TitleSparklineProps {
  values: number[];
  /** Larghezza in pixel (default 72); l'altezza segue le proporzioni. */
  width?: number;
  className?: string;
}

export function TitleSparkline({ values, width = WIDTH, className }: TitleSparklineProps) {
  const height = Math.round((width * HEIGHT) / WIDTH);
  if (values.length < 2) return <span className={cn("block", className)} style={{ width, height }} aria-hidden="true" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = (WIDTH - PADDING * 2) / (values.length - 1);
  const points = values
    .map((v, i) => `${(PADDING + i * step).toFixed(1)},${(HEIGHT - PADDING - ((v - min) / range) * (HEIGHT - PADDING * 2)).toFixed(1)}`)
    .join(" ");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={width}
      height={height}
      className={cn(up ? "text-pos" : "text-neg", className)}
      aria-hidden="true"
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
