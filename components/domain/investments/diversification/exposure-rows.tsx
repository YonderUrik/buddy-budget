"use client";

/**
 * Elenco ordinato di una ripartizione (aree o settori): etichetta, quota, barra colorata e importo. Con `icon` ogni
 * riga ha un riquadro con l'icona; con `onActiveChange` le righe si possono toccare per evidenziarle altrove (mappa).
 */

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CompositionSlice } from "@/lib/calc/investments";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Righe mostrate prima di "Mostra tutti". */
export const EXPOSURE_ROWS_VISIBLE = 6;

export interface ExposureRowsProps {
  slices: CompositionSlice[];
  currency: string;
  labelFor: (key: string) => string;
  colorFor: (key: string) => string;
  iconFor?: (key: string) => LucideIcon;
  /** Riga attiva (evidenziata) e callback: abilita il tocco sulle righe. */
  activeKey?: string | null;
  onActiveChange?: (key: string | null) => void;
  /** Etichetta accessibile dell'elenco. */
  label: string;
}

function formatShare(share: number): string {
  return `${(share * 100).toFixed(share < 0.1 ? 1 : 0).replace(".", ",")}%`;
}

export function ExposureRows({ slices, currency, labelFor, colorFor, iconFor, activeKey = null, onActiveChange, label }: ExposureRowsProps) {
  const [showAll, setShowAll] = React.useState(false);
  const visible = showAll ? slices : slices.slice(0, EXPOSURE_ROWS_VISIBLE);
  const max = Math.max(...slices.map((s) => s.share), 0.01);
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col" aria-label={label}>
        {visible.map((slice) => {
          const color = colorFor(slice.key);
          const Icon = iconFor?.(slice.key);
          const interactive = onActiveChange !== undefined;
          const active = activeKey === slice.key;
          const body = (
            <>
              {Icon ? (
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`,
                    color,
                  }}
                  aria-hidden="true"
                >
                  <Icon className="size-4" />
                </span>
              ) : (
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-foreground">{labelFor(slice.key)}</span>
                  <span className="shrink-0 tabular-nums">
                    <span className="hidden text-muted-foreground sm:inline">
                      {formatCurrency(slice.value, currency, {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                    <span className="ml-3 inline-block w-12 text-right font-medium text-foreground">{formatShare(slice.share)}</span>
                  </span>
                </span>
                <span className="block h-1.5 w-full rounded-full bg-muted" aria-hidden="true">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${(slice.share / max) * 100}%`,
                      backgroundColor: color,
                    }}
                  />
                </span>
              </span>
            </>
          );
          const rowClass = cn("flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left", active && "bg-muted");
          return (
            <li key={slice.key}>
              {interactive ? (
                <button
                  type="button"
                  aria-pressed={active}
                  className={cn(rowClass, "outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60")}
                  onClick={() => onActiveChange(slice.key)}
                  onMouseEnter={() => onActiveChange(slice.key)}
                  onMouseLeave={() => onActiveChange(null)}
                >
                  {body}
                </button>
              ) : (
                <div className={rowClass}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {slices.length > EXPOSURE_ROWS_VISIBLE ? (
        <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Mostra meno" : `Mostra tutti (${slices.length})`}
        </Button>
      ) : null}
    </div>
  );
}
