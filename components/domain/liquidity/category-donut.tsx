"use client";

/**
 * Ciambella delle spese con il totale al centro. Interattiva come quella della Panoramica: al passaggio (o al tocco) di una fetta le altre si attenuano
 * e al centro compaiono nome, importo e quota; il clic la blocca. Lo stato di evidenza è di chi la usa, così le righe accanto possono seguirlo.
 */

import * as React from "react";
import { Cell, Pie, PieChart } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
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
  /** Fetta in evidenza (passaggio o blocco), decisa da chi usa il grafico. */
  focusKey?: string | null;
  /** Chiamata quando il puntatore entra o esce da una fetta (`null` in uscita). */
  onHoverChange?: (key: string | null) => void;
  /** Chiamata al clic o al tocco su una fetta. */
  onSelect?: (key: string) => void;
}

/** Opacità delle fette non evidenziate mentre una è in primo piano. */
const DIMMED_SLICE_OPACITY = 0.35;
const INNER_RATIO = 0.69;
const OUTER_RATIO = 0.5;

function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function CategoryDonut({ slices, currency, centerLabel, size = 220, focusKey = null, onHoverChange, onSelect }: CategoryDonutProps) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const money = (n: number) => formatCurrency(n, currency, { maximumFractionDigits: 0 });
  const focus = slices.find((s) => s.key === focusKey) ?? null;
  const config: ChartConfig = Object.fromEntries(slices.map((s) => [s.label, { label: s.label, color: s.color }]));
  const description = `Spese per categoria, totale ${money(total)}: ${slices.map((s) => `${s.label} ${percent(s.value / (total || 1))}`).join(", ")}.`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={description}>
      <ChartContainer config={config} className="aspect-square" style={{ width: size, height: size }}>
        <PieChart>
          <Pie
            data={slices.map((s) => ({ ...s }))}
            dataKey="value"
            nameKey="label"
            innerRadius={size * INNER_RATIO * OUTER_RATIO}
            outerRadius={size * OUTER_RATIO * 0.9}
            paddingAngle={2}
            cornerRadius={4}
            stroke="none"
            isAnimationActive={false}
            onMouseEnter={(_, index) => onHoverChange?.(slices[index]?.key ?? null)}
            onMouseLeave={() => onHoverChange?.(null)}
            onClick={(_, index) => {
              const key = slices[index]?.key;
              if (key) onSelect?.(key);
            }}
          >
            {slices.map((s) => (
              <Cell key={s.key} fill={s.color} fillOpacity={focusKey && focusKey !== s.key ? DIMMED_SLICE_OPACITY : 1} className="cursor-pointer outline-none transition-opacity" />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
        {focus ? (
          <>
            <span className="max-w-full truncate text-sm text-text-2">{focus.label}</span>
            <span className="font-heading text-xl font-medium tabular-nums">{money(focus.value)}</span>
            <span className="text-sm tabular-nums text-text-2">{percent(focus.value / (total || 1))} delle spese</span>
          </>
        ) : (
          <>
            <span className="font-heading text-2xl font-medium tabular-nums">{money(total)}</span>
            <span className="text-sm text-text-2">{centerLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}
