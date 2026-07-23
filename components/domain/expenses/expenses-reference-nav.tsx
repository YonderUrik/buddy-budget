"use client";

/** Frecce prev/next per navigare il periodo mostrato in Spese, con l'etichetta del periodo attivo. */

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatPeriodLabel,
  getPeriodRange,
  shiftReferenceDate,
  startOfDay,
  type ExpensePeriod,
} from "@/lib/calc/expenses";

export interface ExpensesReferenceNavProps {
  period: ExpensePeriod;
  referenceDate: Date;
  onChange: (newReferenceDate: Date) => void;
}

export function ExpensesReferenceNav({ period, referenceDate, onChange }: ExpensesReferenceNavProps) {
  const range = getPeriodRange(period, referenceDate);
  const today = startOfDay(new Date());
  const isNextDisabled = range.to.getTime() >= today.getTime();

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(shiftReferenceDate(period, referenceDate, -1))}
        aria-label="Periodo precedente"
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" />
      </button>
      <span className="min-w-[9rem] text-center text-sm text-muted-foreground">
        {formatPeriodLabel(period, range)}
      </span>
      <button
        type="button"
        onClick={() => onChange(shiftReferenceDate(period, referenceDate, 1))}
        disabled={isNextDisabled}
        aria-label="Periodo successivo"
        className={cn(
          "rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground",
          isNextDisabled && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground"
        )}
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </div>
  );
}
