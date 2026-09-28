"use client";

/**
 * Posizioni aperte: nome, quote, prezzo medio, valore, guadagno e peso. Mostra sempre la data dell'ultimo prezzo
 * e da dove viene (un prezzo vecchio o stimato si vede, non si nasconde) e lo stato del recupero dello storico.
 */

import { PencilLineIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PositionRow } from "@/lib/calc/investments";
import { INSTRUMENT_TYPE_SINGULAR } from "@/lib/investments/labels";
import type { BackfillStateView } from "@/lib/market-data/backfill-state";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Oltre questi giorni un prezzo è segnalato come vecchio. */
export const STALE_PRICE_DAYS = 4;

const QUANTITY_FORMAT = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 6 });
const PRICE_FORMAT = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 4 });

function daysBetween(dateKey: string, todayKey: string): number {
  return Math.round((Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${dateKey}T00:00:00Z`)) / 86_400_000);
}

function priceNote(row: PositionRow, todayKey: string): { text: string; stale: boolean } {
  if (!row.lastPrice) return { text: "Nessun prezzo: inseriscilo a mano", stale: true };
  const date = formatShortDate(row.lastPrice.date);
  const price = PRICE_FORMAT.format(row.lastPrice.close);
  const origin =
    row.lastPrice.origin === "manuale" ? " · manuale" : row.lastPrice.origin === "operazione" ? " · dall'ultima operazione" : "";
  return { text: `${price} ${row.instrument.currency} al ${date}${origin}`, stale: daysBetween(row.lastPrice.date, todayKey) > STALE_PRICE_DAYS };
}

export interface PositionsListProps {
  rows: PositionRow[];
  currency: string;
  todayKey: string;
  backfill: BackfillStateView[];
  onManualPrice: (row: PositionRow) => void;
}

export function PositionsList({ rows, currency, todayKey, backfill, onManualPrice }: PositionsListProps) {
  const loading = new Set(backfill.filter((b) => b.status === "running" && !b.interrupted).map((b) => b.instrumentId));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Posizioni</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Nessuna posizione aperta.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const note = priceNote(row, todayKey);
              const gain = row.unrealizedGain;
              return (
                <li key={row.instrument.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-foreground" title={row.instrument.name}>
                        {row.instrument.name}
                      </p>
                      {loading.has(row.instrument.id) ? <Badge variant="secondary">Storico in caricamento</Badge> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {INSTRUMENT_TYPE_SINGULAR[row.instrument.type]} · {QUANTITY_FORMAT.format(row.quantity)}{" "}
                      {row.instrument.priceUnit === "percentuale_nominale" ? "nominale" : "quote"}
                      {row.averagePrice !== null ? ` · medio ${PRICE_FORMAT.format(row.averagePrice)} ${currency}` : ""}
                    </p>
                    <p className={cn("text-xs", note.stale ? "text-neg" : "text-muted-foreground")}>{note.text}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-left sm:text-right">
                      <p className="font-mono font-medium tabular-nums text-foreground">
                        {row.value !== null ? formatCurrency(row.value, currency) : "—"}
                      </p>
                      <p className={cn("text-xs tabular-nums", gain === null ? "text-muted-foreground" : gain < 0 ? "text-neg" : "text-pos")}>
                        {gain === null
                          ? "—"
                          : `${gain < 0 ? "−" : "+"}${formatCurrency(Math.abs(gain), currency)}${
                              row.unrealizedGainPct !== null ? ` (${(row.unrealizedGainPct * 100).toFixed(1).replace(".", ",")}%)` : ""
                            }`}
                        {row.weight !== null ? <span className="text-muted-foreground"> · {(row.weight * 100).toFixed(0)}%</span> : null}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      aria-label={`Inserisci un prezzo per ${row.instrument.name}`}
                      title="Inserisci un prezzo"
                      onClick={() => onManualPrice(row)}
                    >
                      <PencilLineIcon className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
