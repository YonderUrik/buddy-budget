/** Ciambella delle spese per categoria con il totale al centro. Solo presentazione; descritta a parole per chi non la vede. */

import * as React from "react";
import { formatCurrency } from "@/lib/format";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  /** Token CSS o colore della fetta. */
  color: string;
}

export interface CategoryDonutProps {
  slices: readonly DonutSlice[];
  currency: string;
  centerLabel: string;
  size?: number;
}

const GAP = 3;
const THICKNESS = 34;

export function CategoryDonut({ slices, currency, centerLabel, size = 220 }: CategoryDonutProps) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = size / 2 - THICKNESS / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const description = `Spese per categoria, totale ${formatCurrency(total, currency, { maximumFractionDigits: 0 })}: ${slices
    .map((s) => `${s.label} ${Math.round((s.value / (total || 1)) * 100)}%`)
    .join(", ")}.`;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={description}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--muted)" strokeWidth={THICKNESS} />
        {total > 0 &&
          slices.map((slice) => {
            const length = (slice.value / total) * circumference;
            const dash = Math.max(length - GAP, 0);
            const node = (
              <circle
                key={slice.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={THICKNESS}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            offset += length;
            return node;
          })}
      </svg>
      <div className="absolute text-center">
        <p className="font-heading text-2xl font-medium tabular-nums">{formatCurrency(total, currency, { maximumFractionDigits: 0 })}</p>
        <p className="text-sm text-text-2">{centerLabel}</p>
      </div>
    </div>
  );
}
