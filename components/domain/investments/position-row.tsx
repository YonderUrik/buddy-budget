"use client";

/**
 * Una posizione aperta. Da `md` in su è una riga di tabella su una sola linea (strumento, quantità, carico medio,
 * prezzo, valore, utile, peso); sotto `md` è una scheda compatta (nome, valore, utile) che si apre al tocco per
 * mostrare quantità, carico medio e prezzo, così sul telefono non si perde nulla ma non si occupa tutto lo schermo.
 */

import * as React from "react";
import { AlertTriangleIcon, ChevronDownIcon, PencilLineIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PositionRow } from "@/lib/calc/investments";
import { INSTRUMENT_TYPE_SINGULAR } from "@/lib/investments/labels";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatSignedCurrency, formatSignedPct } from "./gain-text";
import { INSTRUMENT_TYPE_COLOR } from "./instrument-colors";
import { InstrumentIcon } from "./instrument-icon";
import { percent, PRICE_FORMAT, priceNote, QUANTITY_FORMAT } from "./positions-format";

/** Colonne della tabella desktop: la testata in `PositionsList` usa la stessa definizione. */
export const POSITIONS_GRID_COLUMNS = "@3xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_2.25rem]";

export interface PositionRowViewProps {
  row: PositionRow;
  currency: string;
  todayKey: string;
  loadingHistory: boolean;
  onManualPrice: (row: PositionRow) => void;
  /** Un logo remoto è stato mostrato in questa riga. */
  onRemoteLogo?: () => void;
}

function gainClass(gain: number | null): string {
  return gain === null ? "text-muted-foreground" : gain < 0 ? "text-neg" : "text-pos";
}

export function PositionRowView({ row, currency, todayKey, loadingHistory, onManualPrice, onRemoteLogo }: PositionRowViewProps) {
  const [open, setOpen] = React.useState(false);
  const detailsId = React.useId();
  const note = priceNote(row, todayKey);
  const gain = row.unrealizedGain;
  const color = INSTRUMENT_TYPE_COLOR[row.instrument.type];
  const unit = row.instrument.priceUnit === "percentuale_nominale" ? "nominale" : "quote";
  const quantity = `${QUANTITY_FORMAT.format(row.quantity)} ${unit}`;
  const average = row.averagePrice !== null ? `${PRICE_FORMAT.format(row.averagePrice)} ${currency}` : "—";
  const value = row.value !== null ? formatCurrency(row.value, currency) : "—";
  const gainText =
    gain === null ? "senza prezzo" : `${formatSignedCurrency(gain, currency)}${row.unrealizedGainPct !== null ? ` · ${formatSignedPct(row.unrealizedGainPct)}` : ""}`;
  const weight = row.weight !== null ? percent(row.weight) : "—";
  const manualPriceButton = (
    <Button
      variant="ghost"
      size="icon"
      className="size-9 shrink-0"
      aria-label={`Inserisci un prezzo per ${row.instrument.name}`}
      title="Inserisci un prezzo"
      onClick={() => onManualPrice(row)}
    >
      <PencilLineIcon className="size-4" aria-hidden="true" />
    </Button>
  );

  return (
    <li className="relative px-4 sm:px-6">
      <div className={cn("grid items-center gap-x-4", POSITIONS_GRID_COLUMNS)}>
        {/* Strumento: sotto md è il pulsante che apre i dettagli */}
        <button
          type="button"
          className="flex min-w-0 items-center gap-3 py-3 text-left @3xl:pointer-events-none @3xl:py-2.5"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((v) => !v)}
        >
          <InstrumentIcon type={row.instrument.type} name={row.instrument.name} instrumentId={row.instrument.id} onRemoteLogo={onRemoteLogo} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate font-medium text-foreground" title={row.instrument.name}>
                {row.instrument.name}
              </span>
              {loadingHistory ? <Badge variant="secondary">Storico in caricamento</Badge> : null}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {INSTRUMENT_TYPE_SINGULAR[row.instrument.type]}
              <span className="@3xl:hidden"> · {weight}</span>
            </span>
          </span>
          <span className="text-right @3xl:hidden">
            <span className="block font-heading font-medium tabular-nums text-foreground">{value}</span>
            <span className={cn("block text-xs tabular-nums", gainClass(gain))}>{gainText}</span>
          </span>
          <ChevronDownIcon
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform @3xl:hidden", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>

        {/* Colonne solo desktop */}
        <div className="hidden min-w-0 whitespace-nowrap @3xl:block">
          <p className="truncate text-sm tabular-nums text-foreground">{quantity}</p>
          <p className="truncate text-xs tabular-nums text-muted-foreground">carico {average}</p>
        </div>
        <div className="hidden min-w-0 whitespace-nowrap @3xl:block">
          <p className={cn("flex items-center gap-1 text-sm tabular-nums", note.stale ? "text-neg" : "text-foreground")}>
            {note.stale ? <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
            {note.price ?? "—"}
          </p>
          <p className={cn("truncate text-xs", note.stale ? "text-neg" : "text-muted-foreground")} title={note.hint ?? note.detail}>
            {note.detail}
          </p>
        </div>
        <p className="hidden whitespace-nowrap text-right font-heading text-base font-medium tabular-nums text-foreground @3xl:block">{value}</p>
        <div className={cn("hidden text-right text-sm tabular-nums whitespace-nowrap @3xl:block", gainClass(gain))}>
          <p>{gain === null ? "senza prezzo" : formatSignedCurrency(gain, currency)}</p>
          {row.unrealizedGainPct !== null && gain !== null ? <p className="text-xs">{formatSignedPct(row.unrealizedGainPct)}</p> : null}
        </div>
        <div className="hidden items-center gap-2 @3xl:flex" aria-label={`Peso ${weight}`}>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            {row.weight !== null ? (
              <div className="h-full rounded-full" style={{ width: `${Math.max(row.weight * 100, 1)}%`, backgroundColor: color }} />
            ) : null}
          </div>
          <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{weight}</span>
        </div>
        <div className="hidden @3xl:block">{manualPriceButton}</div>
      </div>

      {note.hint ? <p className="hidden pb-2 pl-12 text-xs text-neg @3xl:block">{note.hint}</p> : null}

      {/* Dettagli sotto md */}
      <div id={detailsId} hidden={!open} className="@3xl:hidden">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 pb-3 pl-12 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Quantità</dt>
            <dd className="tabular-nums">{quantity}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Carico medio</dt>
            <dd className="tabular-nums">{average}</dd>
          </div>
          <div className="col-span-2 flex items-end justify-between gap-2">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Ultimo prezzo</dt>
              <dd className={cn("tabular-nums", note.stale && "text-neg")}>
                {note.price ?? "Nessun prezzo"}
                <span className="block text-xs">{note.detail}</span>
                {note.hint ? <span className="block text-xs">{note.hint}</span> : null}
              </dd>
            </div>
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => onManualPrice(row)}>
              <PencilLineIcon className="size-3.5" aria-hidden="true" />
              Inserisci prezzo
            </Button>
          </div>
        </dl>
      </div>

      {/* Barra del peso: sotto md è un filo sul fondo della riga, in tabella sta nella colonna */}
      {row.weight !== null ? (
        <div className="absolute inset-x-4 bottom-0 h-0.5 overflow-hidden rounded-full bg-muted sm:inset-x-6 @3xl:hidden" aria-hidden="true">
          <div className="h-full" style={{ width: `${Math.max(row.weight * 100, 1)}%`, backgroundColor: color }} />
        </div>
      ) : null}
    </li>
  );
}
