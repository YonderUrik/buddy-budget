"use client";
import { HoverHighlight } from "@/components/motion";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/**
 * Elenco dei titoli dell'utente (posseduti e seguiti): nome, tipo, ultima chiusura con variazione, piccola linea
 * dell'ultimo mese e i segnali "Posseduto", "Seguito", avvisi. Ogni riga porta alla pagina del titolo.
 */

import Link from "next/link";
import { BellIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { INSTRUMENT_TYPE_SINGULAR } from "@/lib/investments/labels";
import type { TitleListItem } from "@/lib/investments/titles-list";
import { cn } from "@/lib/utils";

import { InstrumentIcon } from "../instrument-icon";

import { TitleSparkline } from "./title-sparkline";

export interface TitleListCardProps {
  items: TitleListItem[];
  /** Base dell'indirizzo della pagina di un titolo (default `/investimenti/titoli`). */
  hrefBase?: string;
}

function ChangeText({ value }: { value: number | null }) {
  const { locale: formattingLocale } = useLocalization();
  const { formatSignedPct } = localizedFormats(formattingLocale);

  if (value === null) return <span className="text-muted-foreground">—</span>;
  return <span className={cn("tabular-nums", value < 0 ? "text-neg" : "text-pos")}>{formatSignedPct(value)}</span>;
}

export function TitleListCard({ items, hrefBase = "/investimenti/titoli" }: TitleListCardProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatPrice } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  return (
    <HoverHighlight mode="stretch" highlightClassName="rounded-2xl bg-muted/60" className="-mx-4 sm:-mx-6">
    <ul>
          {items.map((item) => {
            const { instrument } = item;
            return (
              <li key={instrument.id}>
                <Link
                  href={`${hrefBase}/${instrument.id}`}
                  data-hover-target=""
                  className="flex items-center gap-3 px-4 py-3 sm:px-6 focus-visible:outline-none"
                >
                  <InstrumentIcon type={instrument.type} name={instrument.name} instrumentId={instrument.id} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{instrument.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>{tr(INSTRUMENT_TYPE_SINGULAR[instrument.type])}</span>
                      {item.held ? <Badge variant="secondary">{tr("Posseduto")}</Badge> : null}
                      {item.watching && !item.held ? <Badge variant="outline">{tr("Seguito")}</Badge> : null}
                      {item.activeAlerts > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <BellIcon size={12} aria-hidden="true" />
                          {item.activeAlerts}{" "}{item.activeAlerts === 1 ? tr("avviso") : tr("avvisi")}
                        </span>
                      ) : null}
                      {item.triggeredAlerts > 0 ? (
                        <Badge variant="destructive">{item.triggeredAlerts === 1 ? tr("Avviso scattato") : tr("{0} avvisi scattati", {0: item.triggeredAlerts})}</Badge>
                      ) : null}
                    </p>
                  </div>
                  <TitleSparkline values={item.spark} className="hidden shrink-0 sm:block" />
                  <div className="shrink-0 text-right">
                    {item.lastClose !== null ? (
                      <p className="text-sm font-medium tabular-nums text-foreground">{formatPrice(item.lastClose, instrument.currency)}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{tr("Nessun prezzo")}</p>
                    )}
                    <p className="text-xs">
                      <ChangeText value={item.dayChange} />
                      <span className="sr-only">{" "}{tr("nell'ultimo giorno")}</span>
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
    </ul>
    </HoverHighlight>
  );
}
