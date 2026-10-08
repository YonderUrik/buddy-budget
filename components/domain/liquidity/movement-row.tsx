/** Riga di un movimento: icona-categoria da toccare, descrizione, "Dividi" ben visibile e importo. Solo presentazione. */

import * as React from "react";
import { EllipsisIcon, SplitIcon } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface MovementRowProps {
  description: string;
  /** Tooltip con il testo grezzo della banca, se diverso. */
  rawDescription?: string;
  categoryName: string;
  /** La categoria è quella di ripiego ("Da categorizzare"). */
  uncategorized: boolean;
  accountName?: string;
  /** Importo effettivo (già al netto della parte esclusa) e importo pieno. */
  amount: number;
  fullAmount: number;
  isIncome: boolean;
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
}

export function MovementRow(props: MovementRowProps) {
  const { description, rawDescription, categoryName, uncategorized, accountName, amount, fullAmount, isIncome, currency, avatar, excluded } = props;
  const isSplit = excluded > 0;
  return (
    <div className="flex min-h-[3.75rem] items-center gap-3.5 px-1.5 py-2.5">
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold" title={rawDescription ?? description}>
          {description}
        </p>
        <p className={cn("truncate text-sm", uncategorized ? "font-medium text-neg" : "text-text-2")}>
          {categoryName}
          {accountName ? ` · ${accountName}` : ""}
          {isSplit && <span className="text-text-2"> · diviso</span>}
        </p>
        {props.statusMessage && <p className="text-sm text-text-2">{props.statusMessage}</p>}
      </div>
      <button
        type="button"
        onClick={props.onSplit}
        aria-pressed={props.splitOpen}
        aria-label={`Dividi ${description}`}
        className={cn(
          "hidden min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold transition-colors hover:bg-muted sm:flex",
          props.splitOpen && "bg-muted"
        )}
      >
        <SplitIcon className="size-4" aria-hidden="true" />
        Dividi
      </button>
      <div className="min-w-[5.5rem] shrink-0 text-right">
        <p className={cn("font-heading font-semibold tabular-nums", isIncome ? "text-pos" : "text-neg")}>
          {isIncome ? "+" : "−"}
          {formatCurrency(amount, currency)}
        </p>
        {isSplit && (
          <p className="text-sm text-text-2">
            <span className="sr-only">Importo pieno </span>
            <span className="line-through">{formatCurrency(fullAmount, currency)}</span>
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={props.onToggleActions}
        aria-expanded={props.actionsOpen}
        aria-controls={props.actionsId}
        aria-label={`Altre azioni per ${description}`}
        className="-mr-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-text-2 hover:bg-muted"
      >
        <EllipsisIcon className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
