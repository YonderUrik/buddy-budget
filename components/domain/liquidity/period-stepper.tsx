"use client";

/** Scelta del periodo da analizzare: frecce per il periodo prima/dopo, etichetta e selettore Mese · 3 mesi · Anno. */

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { SegmentedControl } from "@/components/domain/shared";
import { formatPeriodLabel, getPeriodRange, shiftReferenceDate, type ExpensePeriod } from "@/lib/calc/expenses";

const PERIOD_OPTIONS = [
  { value: "mese", label: "Mese" },
  { value: "3mesi", label: "3 mesi" },
  { value: "anno", label: "Anno" },
] as const satisfies readonly { value: ExpensePeriod; label: string }[];

export interface PeriodStepperProps {
  period: ExpensePeriod;
  onPeriodChange: (period: ExpensePeriod) => void;
  referenceDate: Date;
  onReferenceDateChange: (date: Date) => void;
  /** Impedisce di andare oltre il periodo che contiene questa data (di solito oggi). */
  latest: Date;
}

export function PeriodStepper({ period, onPeriodChange, referenceDate, onReferenceDateChange, latest }: PeriodStepperProps) {
  const label = formatPeriodLabel(period, getPeriodRange(period, referenceDate));
  const atLatest = getPeriodRange(period, referenceDate).to.getTime() >= latest.getTime();
  const arrow = "flex size-11 items-center justify-center rounded-xl text-text-2 hover:bg-muted disabled:opacity-35 disabled:hover:bg-transparent";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        <button type="button" className={arrow} aria-label="Periodo precedente" onClick={() => onReferenceDateChange(shiftReferenceDate(period, referenceDate, -1))}>
          <ChevronLeftIcon className="size-5" aria-hidden="true" />
        </button>
        <span className="min-w-36 text-center font-heading text-lg font-medium" aria-live="polite">
          {label}
        </span>
        <button type="button" className={arrow} aria-label="Periodo successivo" disabled={atLatest} onClick={() => onReferenceDateChange(shiftReferenceDate(period, referenceDate, 1))}>
          <ChevronRightIcon className="size-5" aria-hidden="true" />
        </button>
      </div>
      <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={onPeriodChange} ariaLabel="Ampiezza del periodo" />
    </div>
  );
}
