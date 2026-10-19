"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";
/**
 * Row of a transaction: category icon to tap, description, a visible "Dividi" and the amount. Tapping anywhere else on
 * the row opens its detail (`onOpen`). Presentation only.
 */

import * as React from "react";
import { EllipsisIcon, SplitIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface MovementRowProps {
  description: string;
  /** Tooltip con il testo grezzo della banca, se diverso. */
  rawDescription?: string;
  categoryName: string;
  /** Da dove viene la categoria quando si è messa da sola (es. «AI · 96%»), accanto al nome. */
  categoryOrigin?: React.ReactNode;
  /** La categoria è quella di ripiego ("Da categorizzare"). */
  uncategorized: boolean;
  accountName?: string;
  /** Importo effettivo (già al netto della parte esclusa) e importo pieno. */
  amount: number;
  fullAmount: number;
  isIncome: boolean;
  isTransfer?: boolean;
  currency: string;
  /** Icona-categoria; è il bottone che apre la scelta (passato già avvolto nel suo pannello). */
  avatar: React.ReactNode;
  onSplit: () => void;
  splitOpen: boolean;
  onToggleActions: () => void;
  actionsOpen: boolean;
  actionsId: string;
  /** Quota esclusa (positiva) se il movimento è diviso. */
  excluded: number;
  statusMessage?: string;
  /** Opens the transaction's detail: the whole row is the target, except the icon and the buttons. */
  onOpen?: () => void;
}

export function MovementRow(props: MovementRowProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const { description, rawDescription, categoryName, uncategorized, accountName, amount, fullAmount, isIncome, currency, avatar, excluded } = props;
  const isSplit = excluded > 0 && !props.isTransfer;
  return (
    <div className="relative flex min-h-[3.75rem] items-center gap-3.5 rounded-2xl px-1.5 py-2.5 has-[[data-row-open]:hover]:bg-muted/60">
      <span className="relative z-10 shrink-0">{avatar}</span>
      <div className="min-w-0 flex-1">
        {props.onOpen ? (
          <button
            type="button"
            data-row-open=""
            onClick={props.onOpen}
            title={rawDescription ?? description}
            className="block max-w-full truncate text-left font-semibold outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:outline-ring"
          >
            {description}
          </button>
        ) : (
          <p className="truncate font-semibold" title={rawDescription ?? description}>
            {description}
          </p>
        )}
        <p className={cn("truncate text-sm", uncategorized ? "font-medium text-neg" : "text-text-2")}>
          {categoryName}
          {props.categoryOrigin ? <> {"·"}{props.categoryOrigin}</> : null}
          {accountName ? ` · ${accountName}` : ""}
          {isSplit && <span className="text-text-2">{" "}{tr("· diviso")}</span>}
        </p>
        {props.statusMessage && <p className="text-sm text-text-2">{props.statusMessage}</p>}
      </div>
      {!props.isTransfer && <button
        type="button"
        onClick={props.onSplit}
        aria-pressed={props.splitOpen}
        aria-label={tr("Dividi {0}", {0: description})}
        className={cn(
          "relative z-10 hidden min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold transition-colors hover:bg-muted sm:flex",
          props.splitOpen && "bg-muted"
        )}
      >
        <SplitIcon className="size-4" aria-hidden="true" />{tr("Dividi")}</button>}
      <div className="min-w-[5.5rem] shrink-0 text-right">
        <p className={cn("font-heading font-semibold tabular-nums", props.isTransfer ? "text-text-2" : isIncome ? "text-pos" : "text-neg")}>
          {isIncome ? "+" : "−"}
          {formatCurrency(props.isTransfer ? fullAmount : amount, currency)}
        </p>
        {props.isTransfer && <p className="text-xs text-text-2">{tr("Escluso dai conteggi")}</p>}
        {isSplit && (
          <p className="text-sm text-text-2">
            <span className="sr-only">{tr("Importo pieno")}{" "}</span>
            <span className="line-through">{formatCurrency(fullAmount, currency)}</span>
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={props.onToggleActions}
        aria-expanded={props.actionsOpen}
        aria-controls={props.actionsId}
        aria-label={tr("Altre azioni per {0}", {0: description})}
        className="relative z-10 -mr-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-text-2 hover:bg-muted"
      >
        <EllipsisIcon className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
