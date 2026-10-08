/** Miniatura di un andamento (solo decorativa: il saldo e la variazione stanno già scritti accanto). */

import { smoothPath } from "./trend-chart";

export interface SparklineProps {
  values: readonly number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({ values, width = 84, height = 30, color = "var(--swatch-teal)" }: SparklineProps) {
  if (values.length < 2) return null;
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const points = values.map((v, i) => ({ x: (i * width) / (values.length - 1), y: 2 + (height - 4) * (1 - (v - low) / span) }));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <path d={smoothPath(points)} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
