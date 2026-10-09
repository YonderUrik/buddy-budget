"use client";

/** Testata della pagina di un titolo: nome, tipo, ultima chiusura con variazione, e le azioni Segui / Registra. */

import Link from "next/link";
import { ArrowLeftIcon, EyeIcon, EyeOffIcon, PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Instrument } from "@/lib/db/schema/investments";
import { INSTRUMENT_TYPE_SINGULAR } from "@/lib/investments/labels";
import type { TitleStats } from "@/lib/investments/title-stats";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatSignedPct } from "../gain-text";
import { InstrumentIcon } from "../instrument-icon";
import { formatPrice } from "./title-format";

export interface TitleHeaderProps {
  instrument: Instrument;
  stats: TitleStats | null;
  watching: boolean;
  held: boolean;
  watchPending: boolean;
  onToggleWatch: () => void;
  onRegister: () => void;
  backHref?: string;
}

export function TitleHeader({ instrument, stats, watching, held, watchPending, onToggleWatch, onRegister, backHref = "/investimenti" }: TitleHeaderProps) {
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
          <p className="font-heading text-5xl font-medium tabular-nums text-foreground">{formatPrice(stats.lastClose, instrument.currency)}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {stats.dayChange !== null ? (
              <span className={cn("tabular-nums", stats.dayChange < 0 ? "text-neg" : "text-pos")}>{formatSignedPct(stats.dayChange)}</span>
            ) : null}
            {stats.dayChange !== null ? " · " : ""}
            chiusura del {formatShortDate(stats.lastDate)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
