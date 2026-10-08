"use client";

/** Strumenti sopra l'elenco: ricerca, tipo (tutti/uscite/entrate), "Da sistemare" e il filtro di categoria attivo. */

import { SearchIcon, XIcon } from "lucide-react";
import { SegmentedControl } from "@/components/domain/shared";
import type { TransactionDirection } from "@/lib/calc/expenses";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS = [
  { value: "tutte", label: "Tutti" },
  { value: "uscita", label: "Uscite" },
  { value: "entrata", label: "Entrate" },
] as const satisfies readonly { value: TransactionDirection; label: string }[];

export interface MovementsToolbarProps {
  searchText: string;
  onSearchTextChange: (text: string) => void;
  direction: TransactionDirection;
  onDirectionChange: (direction: TransactionDirection) => void;
  /** Movimenti da sistemare; con 0 il filtro non compare. */
  toFix: number;
  toFixOnly: boolean;
  onToFixOnlyChange: (value: boolean) => void;
  /** Nome della categoria filtrata, se c'è. */
  categoryName?: string;
  onClearCategory: () => void;
}

export function MovementsToolbar(props: MovementsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label className="flex min-h-11 min-w-0 flex-1 basis-56 items-center gap-2 rounded-xl border border-input bg-card px-3">
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={props.searchText}
          onChange={(event) => props.onSearchTextChange(event.target.value)}
          placeholder="Cerca nei movimenti"
          aria-label="Cerca nei movimenti"
          className="h-11 w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </label>
      <SegmentedControl options={TYPE_OPTIONS} value={props.direction} onChange={props.onDirectionChange} ariaLabel="Tipo di movimento" />
      {props.toFix > 0 && (
        <button
          type="button"
          aria-pressed={props.toFixOnly}
          onClick={() => props.onToFixOnlyChange(!props.toFixOnly)}
          className={cn("min-h-11 rounded-xl border-[1.5px] px-3.5 text-sm font-semibold", props.toFixOnly ? "border-neg bg-neg-soft text-neg" : "border-border bg-card hover:bg-muted")}
        >
          Da sistemare · {props.toFix}
        </button>
      )}
      {props.categoryName && (
        <button type="button" onClick={props.onClearCategory} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-primary/10 px-3.5 text-sm font-semibold text-primary">
          {props.categoryName}
          <XIcon className="size-4" aria-hidden="true" />
          <span className="sr-only">Togli il filtro</span>
        </button>
      )}
    </div>
  );
}
