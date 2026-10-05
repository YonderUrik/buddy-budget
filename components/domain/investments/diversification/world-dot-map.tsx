/**
 * Mappa del mondo a punti con le aree dove sei investito: i punti delle aree che possiedi si colorano (più intensi se
 * pesano di più), il resto resta grigio. Italia e Giappone sono piccoli e hanno un cerchio attorno. È una mappa delle
 * aree dell'app (non dei singoli paesi): le liste dei paesi per area sono in `exposure-keys.ts`.
 */

import * as React from "react";
import { WORLD_DOT_ROWS } from "@/lib/investments/world-dot-map.generated";
import type { AreaKey } from "@/lib/investments/exposure-keys";
import { WORLD_DOT_AREA_CODES } from "@/lib/investments/plain-labels";
import { AREA_COLOR } from "./exposure-colors";

const CELL = 5;
const DOT_WIDTH = 3.4;
/** Aree piccole sulla mappa: un cerchio attorno ai loro punti le rende trovabili. */
const RING_AREAS: readonly AreaKey[] = ["italia", "giappone"];
const RING_RADIUS = 9;
/** Opacità di un'area posseduta: sale con il peso fino a `FULL_OPACITY_SHARE`. */
const MIN_OPACITY = 0.6;
const FULL_OPACITY_SHARE = 0.25;
const DIMMED_OPACITY = 0.14;

const WIDTH = (WORLD_DOT_ROWS[0]?.length ?? 0) * CELL;
const HEIGHT = WORLD_DOT_ROWS.length * CELL;

interface Layer {
  code: string;
  area: AreaKey | null;
  path: string;
  center: { x: number; y: number };
}

const LAYERS: Layer[] = (() => {
  const dots = new Map<string, { x: number; y: number }[]>();
  WORLD_DOT_ROWS.forEach((row, r) => {
    [...row].forEach((code, c) => {
      if (code === ".") return;
      const list = dots.get(code) ?? [];
      list.push({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 });
      dots.set(code, list);
    });
  });
  return [...dots.entries()].map(([code, list]) => ({
    code,
    area: WORLD_DOT_AREA_CODES[code] ?? null,
    path: list.map((d) => `M${d.x} ${d.y}h0`).join(""),
    center: {
      x: list.reduce((s, d) => s + d.x, 0) / list.length,
      y: list.reduce((s, d) => s + d.y, 0) / list.length,
    },
  }));
})();

export interface WorldDotMapProps {
  /** Quota (0-1) di ogni area posseduta. */
  shares: Partial<Record<AreaKey, number>>;
  /** Area da evidenziare (le altre si abbassano). */
  active?: AreaKey | null;
  className?: string;
}

export function WorldDotMap({ shares, active = null, className }: WorldDotMapProps) {
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={className} role="img" aria-label="Mappa delle aree geografiche in cui sei investito">
      {LAYERS.map((layer) => {
        const share = layer.area ? (shares[layer.area] ?? 0) : 0;
        const held = share > 0;
        const dimmed = active !== null && layer.area !== active;
        const opacity = held ? (dimmed ? DIMMED_OPACITY : MIN_OPACITY + (1 - MIN_OPACITY) * Math.min(1, share / FULL_OPACITY_SHARE)) : dimmed ? 0.12 : 0.22;
        const color = held && layer.area ? AREA_COLOR[layer.area] : "var(--muted-foreground)";
        return (
          <React.Fragment key={layer.code}>
            <path d={layer.path} stroke={color} strokeWidth={DOT_WIDTH} strokeLinecap="round" opacity={opacity} />
            {held && layer.area && RING_AREAS.includes(layer.area) ? (
              <circle
                cx={layer.center.x}
                cy={layer.center.y}
                r={RING_RADIUS}
                fill="none"
                stroke={color}
                strokeWidth={1.2}
                opacity={dimmed ? DIMMED_OPACITY : 0.9}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </svg>
  );
}
