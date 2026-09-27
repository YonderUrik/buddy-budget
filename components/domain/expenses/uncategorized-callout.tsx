"use client";

/**
 * Riquadro "N transazioni da categorizzare" sopra la lista Transazioni: spiega cosa c'è da fare e offre
 * le due azioni possibili — filtrare la lista sulle sole transazioni da sistemare, o andare alla pagina
 * di categorizzazione in blocco (`categorizeHref`).
 */

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface UncategorizedCalloutProps {
  count: number;
  /** true = la lista mostra solo le transazioni da categorizzare. */
  filterActive: boolean;
  onToggleFilter: () => void;
  categorizeHref?: string;
}

export function UncategorizedCallout({
  count,
  filterActive,
  onToggleFilter,
  categorizeHref = "/categorizza",
}: UncategorizedCalloutProps) {
  const noun = count === 1 ? "transazione da categorizzare" : "transazioni da categorizzare";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neg/30 bg-neg-soft/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 text-sm text-foreground">
        <span className="inline-flex size-2 shrink-0 rounded-full bg-neg" aria-hidden="true" />
        <span>
          <span className="font-medium tabular-nums">{count}</span> {noun}
        </span>
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <button
          type="button"
          onClick={onToggleFilter}
          aria-pressed={filterActive}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-9 sm:h-8",
            filterActive && "border-neg/40 bg-neg-soft text-neg hover:bg-neg-soft"
          )}
        >
          {filterActive ? "Mostra tutte" : "Mostra solo queste"}
        </button>
        <Link href={categorizeHref} className={cn(buttonVariants({ size: "sm" }), "h-9 gap-1 sm:h-8")}>
          Categorizza
          <ArrowRightIcon className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
