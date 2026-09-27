"use client";

/**
 * Navigazione del periodo mostrato in Spese: frecce prev/next + click sull'etichetta per aprire
 * un menu di salto diretto a un mese/anno specifico (griglia mesi, anni futuri/mesi futuri disabilitati).
 * Se `onPeriodChange` è passato, sotto `sm` il menu include anche la scelta del tipo di periodo
 * (Settimana/Mese/...), così su mobile il selettore separato può essere nascosto.
 */

import * as React from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatPeriodLabel,
  getPeriodRange,
  shiftReferenceDate,
  startOfDay,
  MONTH_LABELS,
  type ExpensePeriod,
} from "@/lib/calc/expenses";
import { PERIOD_OPTIONS } from "./expenses-period-selector";

export interface ExpensesReferenceNavProps {
  period: ExpensePeriod;
  referenceDate: Date;
  onChange: (newReferenceDate: Date) => void;
  /** Se presente, il menu mostra anche la scelta del tipo di periodo (solo su mobile). */
  onPeriodChange?: (period: ExpensePeriod) => void;
}

export function ExpensesReferenceNav({ period, referenceDate, onChange, onPeriodChange }: ExpensesReferenceNavProps) {
  const [open, setOpen] = React.useState(false);
  const [gridYear, setGridYear] = React.useState(referenceDate.getFullYear());
  const today = startOfDay(new Date());
  const range = getPeriodRange(period, referenceDate);
  const isNextDisabled = range.to.getTime() >= today.getTime();
  const isFutureGridYear = gridYear >= today.getFullYear();

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setGridYear(referenceDate.getFullYear());
    }
    setOpen(nextOpen);
  }

  function pickMonth(month: number) {
    onChange(new Date(gridYear, month, 1));
    setOpen(false);
  }

  return (
    <div className="-ml-1 flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(shiftReferenceDate(period, referenceDate, -1))}
        aria-label="Periodo precedente"
        className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:size-7"
      >
        <ChevronLeftIcon className="size-4" />
      </button>

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          className="flex min-h-9 min-w-[9rem] items-center justify-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground sm:min-h-7"
        >
          {formatPeriodLabel(period, range)}
          <ChevronDownIcon className="size-3.5 shrink-0" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent className="w-72 max-w-[calc(100vw-2rem)] p-3">
          {onPeriodChange && (
            <div role="group" aria-label="Tipo di periodo" className="mb-3 grid grid-cols-4 gap-1 border-b border-border pb-3 sm:hidden">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onPeriodChange(option.value)}
                  aria-pressed={period === option.value}
                  className={cn(
                    "min-h-9 rounded-md px-1 text-xs font-medium",
                    period === option.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setGridYear((y) => y - 1)}
              aria-label="Anno precedente"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronLeftIcon className="size-4" />
            </button>
            <span className="font-heading text-sm font-medium text-foreground">{gridYear}</span>
            <button
              type="button"
              onClick={() => setGridYear((y) => y + 1)}
              disabled={isFutureGridYear}
              aria-label="Anno successivo"
              className={cn(
                "rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground",
                isFutureGridYear && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground"
              )}
            >
              <ChevronRightIcon className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTH_LABELS.map((label, month) => {
              const isFutureMonth =
                gridYear > today.getFullYear() || (gridYear === today.getFullYear() && month > today.getMonth());
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => pickMonth(month)}
                  disabled={isFutureMonth}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted",
                    isFutureMonth && "cursor-not-allowed opacity-40 hover:bg-transparent"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      <button
        type="button"
        onClick={() => onChange(shiftReferenceDate(period, referenceDate, 1))}
        disabled={isNextDisabled}
        aria-label="Periodo successivo"
        className={cn(
          "flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:size-7",
          isNextDisabled && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground"
        )}
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </div>
  );
}
