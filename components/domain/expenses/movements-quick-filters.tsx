"use client";

/**
 * Chip dei filtri rapidi dell'elenco su mobile: tipo (Tutte/Uscite/Entrate), «Divise» e «Da categorizzare» in una
 * sola riga scorrevole, al posto di avviso, selettore di tipo e nota sulle divise, che su schermo piccolo
 * mangiavano lo spazio dei movimenti. Da `sm` in su non compare (restano i blocchi estesi).
 */

import { SplitIcon } from "lucide-react";
import type { TransactionDirection } from "@/lib/calc/expenses";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS = [
  { value: "tutte", label: "Tutte" },
  { value: "uscita", label: "Uscite" },
  { value: "entrata", label: "Entrate" },
] as const satisfies readonly { value: TransactionDirection; label: string }[];

const CHIP_CLASS =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-sm font-medium whitespace-nowrap";
const CHIP_ON_CLASS = "border-primary bg-primary/10 font-semibold text-primary";

export interface MovementsQuickFiltersProps {
  type: TransactionDirection;
  onTypeChange: (type: TransactionDirection) => void;
  uncategorizedCount: number;
  uncategorizedActive: boolean;
  onToggleUncategorized: () => void;
  splitCount: number;
  splitActive: boolean;
  onToggleSplit: () => void;
}

export function MovementsQuickFilters({
  type,
  onTypeChange,
  uncategorizedCount,
  uncategorizedActive,
  onToggleUncategorized,
  splitCount,
  splitActive,
  onToggleSplit,
}: MovementsQuickFiltersProps) {
  return (
    <div
      role="group"
      aria-label="Filtri rapidi"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:hidden [&::-webkit-scrollbar]:hidden"
    >
      {TYPE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={type === option.value}
          onClick={() => onTypeChange(option.value)}
          className={cn(CHIP_CLASS, type === option.value && CHIP_ON_CLASS)}
        >
          {option.label}
        </button>
      ))}
      {uncategorizedCount > 0 && (
        <button
          type="button"
          aria-pressed={uncategorizedActive}
          onClick={onToggleUncategorized}
          className={cn(
            CHIP_CLASS,
            "border-neg/40 text-neg",
            uncategorizedActive && "bg-neg-soft font-semibold",
          )}
        >
          <span className="size-2 rounded-full bg-neg" aria-hidden="true" />
          Da categorizzare · {uncategorizedCount}
        </button>
      )}
      {splitCount > 0 && (
        <button
          type="button"
          aria-pressed={splitActive}
          onClick={onToggleSplit}
          className={cn(CHIP_CLASS, splitActive && CHIP_ON_CLASS)}
        >
          <SplitIcon className="size-3.5" aria-hidden="true" />
          Divise · {splitCount}
        </button>
      )}
    </div>
  );
}
