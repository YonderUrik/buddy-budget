"use client";

/** Navigazione del periodo Cash flow: sole frecce prev/next (nessun salto diretto a mese/anno, a differenza di Transazioni). */

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatCashflowPeriodLabel,
  getCashflowPeriodRange,
  shiftCashflowReferenceDate,
  type CashflowPeriod,
} from "@/lib/calc/cashflow";
import { startOfDay } from "@/lib/calc/expenses";

export interface CashflowReferenceNavProps {
  period: CashflowPeriod;
  referenceDate: Date;
  onChange: (newReferenceDate: Date) => void;
}

export function CashflowReferenceNav({ period, referenceDate, onChange }: CashflowReferenceNavProps) {
  const today = startOfDay(new Date());
  const range = getCashflowPeriodRange(period, referenceDate);
  const isNextDisabled = range.to.getTime() >= today.getTime();

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(shiftCashflowReferenceDate(period, referenceDate, -1))}
        aria-label="Periodo precedente"
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" />
      </button>

      <span className="min-w-[9rem] px-2 py-1 text-center text-sm text-muted-foreground">
        {formatCashflowPeriodLabel(range)}
      </span>

      <button
        type="button"
        onClick={() => onChange(shiftCashflowReferenceDate(period, referenceDate, 1))}
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
