"use client";

/**
 * Posizioni aperte, dalla più pesante. Ogni riga ha il colore del suo tipo e una barra lunga quanto il suo peso nel
 * portafoglio; in testa una lettura della concentrazione. Mostra sempre data e origine del prezzo (un prezzo vecchio
 * o stimato si vede, non si nasconde) e lo stato del recupero dello storico.
 */

import { PencilLineIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PositionRow } from "@/lib/calc/investments";
import type { ConcentrationInsight } from "@/lib/investments/insights";
import { INSTRUMENT_TYPE_SINGULAR } from "@/lib/investments/labels";
import type { BackfillStateView } from "@/lib/market-data/backfill-state";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { INSTRUMENT_TYPE_COLOR } from "./instrument-colors";

/** Oltre questi giorni un prezzo è segnalato come vecchio. */
export const STALE_PRICE_DAYS = 4;

const QUANTITY_FORMAT = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 6 });
const PRICE_FORMAT = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 4 });

function daysBetween(dateKey: string, todayKey: string): number {
  return Math.round((Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${dateKey}T00:00:00Z`)) / 86_400_000);
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function concentrationText(insight: ConcentrationInsight | null): string | null {
  if (!insight) return null;
  if (insight.kind === "single") return "Tutto il portafoglio è in un solo strumento.";
  if (insight.kind === "dominant") return `Il ${percent(insight.share)} è in ${insight.name}: gran parte dell'andamento dipende da lì.`;
  return `Le prime tre posizioni pesano il ${percent(insight.share)} del portafoglio.`;
}

function priceNote(row: PositionRow, todayKey: string): { text: string; stale: boolean } {
  if (!row.lastPrice) return { text: "Nessun prezzo: inseriscilo a mano", stale: true };
  const origin =
    row.lastPrice.origin === "manuale" ? " · manuale" : row.lastPrice.origin === "operazione" ? " · dall'ultima operazione" : "";
  return {
    text: `${PRICE_FORMAT.format(row.lastPrice.close)} ${row.instrument.currency} al ${formatShortDate(row.lastPrice.date)}${origin}`,
    stale: daysBetween(row.lastPrice.date, todayKey) > STALE_PRICE_DAYS,
  };
}

export interface PositionsListProps {
  rows: PositionRow[];
  concentration: ConcentrationInsight | null;
  currency: string;
  todayKey: string;
  backfill: BackfillStateView[];
  onManualPrice: (row: PositionRow) => void;
}

export function PositionsList({ rows, concentration, currency, todayKey, backfill, onManualPrice }: PositionsListProps) {
  const loading = new Set(backfill.filter((b) => b.status === "running" && !b.interrupted).map((b) => b.instrumentId));
  const insight = concentrationText(concentration);
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Posizioni</CardTitle>
        {insight ? <p className="text-sm text-foreground">{insight}</p> : null}
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Nessuna posizione aperta.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const note = priceNote(row, todayKey);
              const gain = row.unrealizedGain;
              const color = INSTRUMENT_TYPE_COLOR[row.instrument.type];
              return (
                <li key={row.instrument.id} className="flex flex-col gap-2 px-4 py-4 sm:px-6">
                  <div className="flex items-start gap-3">
                    <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
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
                        {row.averagePrice !== null ? ` · carico medio ${PRICE_FORMAT.format(row.averagePrice)} ${currency}` : ""}
                      </p>
                      <p className={cn("text-xs", note.stale ? "text-neg" : "text-muted-foreground")}>{note.text}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-heading text-lg font-medium tabular-nums text-foreground">
                        {row.value !== null ? formatCurrency(row.value, currency) : "—"}
                      </p>
                      <p className={cn("text-xs tabular-nums", gain === null ? "text-muted-foreground" : gain < 0 ? "text-neg" : "text-pos")}>
                        {gain === null
                          ? "senza prezzo"
                          : `${gain < 0 ? "−" : "+"}${formatCurrency(Math.abs(gain), currency)}${
                              row.unrealizedGainPct !== null ? ` · ${(row.unrealizedGainPct * 100).toFixed(1).replace(".", ",")}%` : ""
                            }`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="-mr-2 size-9 shrink-0"
                      aria-label={`Inserisci un prezzo per ${row.instrument.name}`}
                      title="Inserisci un prezzo"
                      onClick={() => onManualPrice(row)}
                    >
                      <PencilLineIcon className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                  {row.weight !== null ? (
                    <div className="flex items-center gap-3 pl-5.5">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(row.weight * 100, 1)}%`, backgroundColor: color }} />
                      </div>
                      <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">{percent(row.weight)} del totale</span>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
