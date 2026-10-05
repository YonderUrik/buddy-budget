"use client";

/**
 * Elenco dei titoli dell'utente (posseduti e seguiti): nome, tipo, ultima chiusura con variazione, piccola linea
 * dell'ultimo mese e i segnali "Posseduto", "Seguito", avvisi. Ogni riga porta alla pagina del titolo.
 */

import Link from "next/link";
import { BellIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { INSTRUMENT_TYPE_SINGULAR } from "@/lib/investments/labels";
import type { TitleListItem } from "@/lib/investments/titles-list";
import { cn } from "@/lib/utils";
import { formatSignedPct } from "../gain-text";
import { InstrumentIcon } from "../instrument-icon";
import { formatPrice } from "./title-format";
import { TitleSparkline } from "./title-sparkline";

export interface TitleListCardProps {
  items: TitleListItem[];
  /** Base dell'indirizzo della pagina di un titolo (default `/investimenti/titoli`). */
  hrefBase?: string;
}

function ChangeText({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return <span className={cn("tabular-nums", value < 0 ? "text-neg" : "text-pos")}>{formatSignedPct(value)}</span>;
}

export function TitleListCard({ items, hrefBase = "/investimenti/titoli" }: TitleListCardProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {items.map((item) => {
            const { instrument } = item;
            return (
              <li key={instrument.id}>
                <Link
                  href={`${hrefBase}/${instrument.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                >
                  <InstrumentIcon type={instrument.type} name={instrument.name} instrumentId={instrument.id} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{instrument.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>{INSTRUMENT_TYPE_SINGULAR[instrument.type]}</span>
                      {item.held ? <Badge variant="secondary">Posseduto</Badge> : null}
                      {item.watching && !item.held ? <Badge variant="outline">Seguito</Badge> : null}
                      {item.activeAlerts > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <BellIcon size={12} aria-hidden="true" />
                          {item.activeAlerts} {item.activeAlerts === 1 ? "avviso" : "avvisi"}
                        </span>
                      ) : null}
                      {item.triggeredAlerts > 0 ? (
                        <Badge variant="destructive">{item.triggeredAlerts === 1 ? "Avviso scattato" : `${item.triggeredAlerts} avvisi scattati`}</Badge>
                      ) : null}
                    </p>
                  </div>
                  <TitleSparkline values={item.spark} className="hidden shrink-0 sm:block" />
                  <div className="shrink-0 text-right">
                    {item.lastClose !== null ? (
                      <p className="text-sm font-medium tabular-nums text-foreground">{formatPrice(item.lastClose, instrument.currency)}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nessun prezzo</p>
                    )}
                    <p className="text-xs">
                      <ChangeText value={item.dayChange} />
                      <span className="sr-only"> nell&apos;ultimo giorno</span>
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
