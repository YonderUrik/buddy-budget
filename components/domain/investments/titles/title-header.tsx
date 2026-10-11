"use client";

/**
 * Testata della pagina di un titolo: nome, tipo, codici, ultima chiusura grande (decimali attenuati) con variazione
 * del giorno e dell'anno, e le azioni Segui / Registra.
 */

import Link from "next/link";
import { ArrowLeftIcon, EyeIcon, EyeOffIcon, PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Instrument } from "@/lib/db/schema/investments";
import { INSTRUMENT_TYPE_SINGULAR } from "@/lib/investments/labels";
import type { TitleStats } from "@/lib/investments/title-stats";
import { AnimatedNumber } from "@/components/motion";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatSignedPct } from "../gain-text";
import { InstrumentIcon } from "../instrument-icon";

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
  backHref?: string;
  /** Etichette in più accanto al tipo (es. categoria del fondo). */
  tags?: string[];
}

export function TitleHeader({ instrument, stats, watching, held, watchPending, onToggleWatch, onRegister, backHref = "/investimenti", tags = [] }: TitleHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      <Link href={backHref} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon size={14} aria-hidden="true" /> Portafoglio
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <InstrumentIcon type={instrument.type} name={instrument.name} instrumentId={instrument.id} className="mt-0.5" />
          <div className="min-w-0">
            <h2 className="font-heading text-xl font-medium text-foreground">{instrument.name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{INSTRUMENT_TYPE_SINGULAR[instrument.type]}</span>
              {instrument.isin ? <span className="tabular-nums">{instrument.isin}</span> : null}
              <span>{instrument.currency}</span>
              {tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
              {held ? <Badge variant="secondary">Posseduto</Badge> : null}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5" disabled={watchPending} aria-pressed={watching} onClick={onToggleWatch}>
            {watching ? <EyeOffIcon size={15} aria-hidden="true" /> : <EyeIcon size={15} aria-hidden="true" />}
            {watching ? "Non seguire più" : "Segui"}
          </Button>
          <Button className="gap-1.5 shadow-xs" onClick={onRegister}>
            <PlusIcon size={15} aria-hidden="true" /> Registra
          </Button>
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
                <span className={cn("tabular-nums", stats.dayChange < 0 ? "text-neg" : "text-pos")}>{formatSignedPct(stats.dayChange)}</span> nel giorno ·{" "}
              </>
            ) : null}
            {stats.returns["1A"] !== undefined ? (
              <>
                <span className={cn("tabular-nums", stats.returns["1A"] < 0 ? "text-neg" : "text-pos")}>{formatSignedPct(stats.returns["1A"])}</span> in un anno ·{" "}
              </>
            ) : null}
            chiusura del {formatShortDate(stats.lastDate)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
