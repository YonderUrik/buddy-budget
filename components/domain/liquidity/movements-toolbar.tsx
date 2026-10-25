"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Strumenti sopra l'elenco: ricerca, tipo (tutti/uscite/entrate), "Da decidere" e il filtro di categoria attivo. */

import Link from "next/link";
import { SearchIcon, SparklesIcon, XIcon } from "lucide-react";
import { track } from "@/lib/analytics";
import { SegmentedControl } from "@/components/domain/shared";
import type { TransactionDirection } from "@/lib/calc/expenses";
import { cn } from "@/lib/utils";
import { MOVEMENTS_LIST_ID } from "./liquidity-nav";

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
  const { t: tr } = useLocalization();
  return (
    <div id={MOVEMENTS_LIST_ID} className="flex scroll-mt-20 flex-wrap items-center gap-2.5">
      <label className="flex min-h-11 min-w-0 flex-1 basis-56 items-center gap-2 rounded-xl border border-input bg-card px-3">
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={props.searchText}
          onChange={(event) => props.onSearchTextChange(event.target.value)}
          placeholder={tr("Cerca nei movimenti")}
          aria-label={tr("Cerca nei movimenti")}
          className="h-11 w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </label>
      <SegmentedControl options={TYPE_OPTIONS} value={props.direction} onChange={props.onDirectionChange} ariaLabel={tr("Tipo di movimento")} />
      {props.toFix > 0 && (
        <button
          type="button"
          aria-pressed={props.toFixOnly}
          onClick={() => props.onToFixOnlyChange(!props.toFixOnly)}
          className={cn("min-h-11 rounded-xl border-[1.5px] px-3.5 text-sm font-semibold", props.toFixOnly ? "border-neg bg-neg-soft text-neg" : "border-border bg-card hover:bg-muted")}
        >
          {tr("Da decidere ·")}{props.toFix}
        </button>
      )}
      {props.toFix > 0 && (
        <Link
          href="/categorizza"
          onClick={() => track("categorize_ai_link_clicked", { from: "movimenti" })}
          className="flex min-h-11 items-center gap-1.5 rounded-xl border-[1.5px] border-primary/30 bg-primary/10 px-3.5 text-sm font-semibold text-primary hover:bg-primary/15"
        >
          <SparklesIcon className="size-4" aria-hidden="true" />{tr("Categorizza con l'AI")}</Link>
      )}
      {props.categoryName && (
        <button type="button" onClick={props.onClearCategory} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-primary/10 px-3.5 text-sm font-semibold text-primary">
          {props.categoryName}
          <XIcon className="size-4" aria-hidden="true" />
          <span className="sr-only">{tr("Togli il filtro")}</span>
        </button>
      )}
    </div>
  );
}
