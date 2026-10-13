"use client";

/** Tooltip dei grafici di Pensione: ogni riga mostra pallino, nome della serie e importo (il formatter di shadcn da solo lascia solo le cifre). */

import * as React from "react";
import type { ChartConfig } from "@/components/ui/chart";
import { money } from "./pension-format";

export interface PensionTooltipRowProps {
  color: string;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}

/** Una riga del tooltip: pallino colorato, etichetta e valore. */
export function PensionTooltipRow({ color, label, value, valueClassName }: PensionTooltipRowProps) {
  return (
    <div className="flex w-full items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} aria-hidden="true" />
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className={`font-mono font-medium tabular-nums ${valueClassName ?? "text-foreground"}`}>{value}</span>
    </div>
  );
}

/** Contenitore visivo del tooltip, con titolo opzionale. */
export function PensionTooltipFrame({ title, children }: { title?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid min-w-40 max-w-64 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      {title ? <div className="font-medium">{title}</div> : null}
      <div className="grid gap-1.5">{children}</div>
    </div>
  );
}

interface TooltipItem {
  dataKey?: string | number | ((...args: never[]) => unknown);
  value?: unknown;
  color?: string;
  type?: string;
  /** Riga di dati del punto attivo. */
  payload?: Record<string, unknown>;
}

export interface PensionChartTooltipProps {
  /** Iniettate da Recharts. */
  active?: boolean;
  payload?: readonly TooltipItem[];
  config: ChartConfig;
  currency: string;
  /** Titolo costruito dal punto attivo (es. "Tra 5 anni"). */
  title?: (point: Record<string, unknown>) => React.ReactNode;
}

/** Tooltip a righe "serie · importo" per i grafici a linee/aree; le etichette vengono dalla config del grafico. */
export function PensionChartTooltip({ active, payload, config, currency, title }: PensionChartTooltipProps) {
  const items = (payload ?? []).filter((item) => item.type !== "none" && typeof item.value === "number" && typeof item.dataKey === "string");
  if (!active || items.length === 0) return null;
  return (
    <PensionTooltipFrame title={title?.(items[0].payload ?? {})}>
      {items.map((item) => {
        const key = item.dataKey as string;
        return <PensionTooltipRow key={key} color={item.color ?? `var(--color-${key})`} label={String(config[key]?.label ?? key)} value={money(item.value as number, currency)} />;
      })}
    </PensionTooltipFrame>
  );
}
