"use client";

/** Tooltip del grafico del patrimonio netto: data, valore di ogni classe di asset (dall'alto) e totale. */

import { parseDateOnly } from "@/lib/calc/expenses";
import type { NetWorthSeriesPoint } from "@/lib/calc/net-worth";
import { formatCurrency } from "@/lib/format";
import { assetClassColor, assetClassLabel } from "./asset-classes";

const ESTIMATED_LABEL = "stimato";
const TOTAL_LABEL = "Totale";
const TOOLTIP_DATE_FORMAT = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });

export interface NetWorthChartTooltipProps {
  active?: boolean;
  payload?: { payload: NetWorthSeriesPoint }[];
  currency: string;
  /** Classi mostrate nel grafico, dal basso verso l'alto. */
  classes: string[];
}

export function NetWorthChartTooltip({ active, payload, currency, classes }: NetWorthChartTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const showBreakdown = classes.length > 1;
  return (
    <div className="min-w-44 rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
      <p className="text-muted-foreground">
        {TOOLTIP_DATE_FORMAT.format(parseDateOnly(point.date))}
        {point.isEstimated ? ` · ${ESTIMATED_LABEL}` : ""}
      </p>
      {showBreakdown ? (
        <ul className="mt-1.5 flex flex-col gap-1">
          {[...classes].reverse().map((key) => (
            <li key={key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 rounded-full" style={{ backgroundColor: assetClassColor(key) }} aria-hidden="true" />
                {assetClassLabel(key)}
              </span>
              <span className="font-mono tabular-nums text-foreground">
                {formatCurrency(point.byClass[key] ?? 0, currency)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p
        className={
          showBreakdown
            ? "mt-1.5 flex justify-between gap-4 border-t pt-1.5 font-mono font-medium tabular-nums text-foreground"
            : "font-mono font-medium tabular-nums text-foreground"
        }
      >
        {showBreakdown ? <span className="font-sans text-muted-foreground">{TOTAL_LABEL}</span> : null}
        {formatCurrency(point.value, currency)}
      </p>
    </div>
  );
}
