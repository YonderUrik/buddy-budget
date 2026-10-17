"use client";

import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/**
 * Testata della pagina di un titolo: nome, tipo, codici, ultima chiusura grande (decimali attenuati) con variazione
 * del giorno e dell'anno, e le azioni Segui / Registra.
 */

import { EyeIcon, EyeOffIcon, PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Instrument } from "@/lib/db/schema/investments";
import { INSTRUMENT_TYPE_SINGULAR } from "@/lib/investments/labels";
import type { TitleStats } from "@/lib/investments/title-stats";
import { AnimatedNumber } from "@/components/motion";

import { cn } from "@/lib/utils";

import { InstrumentIcon } from "../instrument-icon";
import { PAGE_TITLE } from "@/components/domain/shared";

/** Decimali del prezzo: quattro sotto 10 (come gli avvisi), altrimenti due. */
function priceFormat(value: number, currency: string) {
  return { style: "currency" as const, currency, minimumFractionDigits: 2, maximumFractionDigits: Math.abs(value) < 10 ? 4 : 2 };
}

export interface TitleHeaderProps {
  instrument: Instrument;
  stats: TitleStats | null;
  watching: boolean;
  held: boolean;
  watchPending: boolean;
  onToggleWatch: () => void;
  onRegister: () => void;
  /** Etichette in più accanto al tipo (es. categoria del fondo). */
  tags?: string[];
}

export function TitleHeader({ instrument, stats, watching, held, watchPending, onToggleWatch, onRegister, tags = [] }: TitleHeaderProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatSignedPct } = localizedFormats(formattingLocale);


  const { formatShortDate } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <InstrumentIcon type={instrument.type} name={instrument.name} instrumentId={instrument.id} className="mt-0.5" />
          <div className="min-w-0">
            <h2 className={PAGE_TITLE}>{instrument.name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{INSTRUMENT_TYPE_SINGULAR[instrument.type]}</span>
              {instrument.isin ? <span className="tabular-nums">{instrument.isin}</span> : null}
              <span>{instrument.currency}</span>
              {tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
              {held ? <Badge variant="secondary">{tr("Posseduto")}</Badge> : null}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5" disabled={watchPending} aria-pressed={watching} onClick={onToggleWatch}>
            {watching ? <EyeOffIcon size={15} aria-hidden="true" /> : <EyeIcon size={15} aria-hidden="true" />}
            {watching ? tr("Non seguire più") : tr("Segui")}
          </Button>
          <Button className="gap-1.5" onClick={onRegister}>
            <PlusIcon size={15} aria-hidden="true" />{" "}{tr("Registra")}</Button>
        </div>
      </div>
      {stats ? (
        <div>
          <p className="font-heading text-5xl font-medium text-foreground sm:text-6xl">
            <AnimatedNumber value={stats.lastClose} format={priceFormat(stats.lastClose, instrument.currency)} mutedTail />
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.dayChange !== null ? (
              <>
                <span className={cn("tabular-nums", stats.dayChange < 0 ? "text-neg" : "text-pos")}>{formatSignedPct(stats.dayChange)}</span>{" "}{tr("nel giorno ·")}{" "}
              </>
            ) : null}
            {stats.returns["1A"] !== undefined ? (
              <>
                <span className={cn("tabular-nums", stats.returns["1A"] < 0 ? "text-neg" : "text-pos")}>{formatSignedPct(stats.returns["1A"])}</span>{" "}{tr("in un anno ·")}{" "}
              </>
            ) : null}{tr("chiusura del")}{" "}{formatShortDate(stats.lastDate)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
