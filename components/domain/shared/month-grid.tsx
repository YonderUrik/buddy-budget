"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Twelve months of one year with arrows to change year. Used to pick a range of months (Analitiche) and to jump to a
 * month inside the day calendar; the caller decides what counts as selected or inside the range.
 */

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { monthKey, outOfBounds, toMonthOf } from "@/lib/calc/calendar-range";
import { cn } from "@/lib/utils";

export interface MonthGridProps {
  year: number;
  onYearChange: (year: number) => void;
  /** Month keys (`YYYY-MM`) outside these bounds are shown but not tappable. */
  min?: string;
  max?: string;
  /** Ends of the selection (solid) and months between them (tinted). */
  isEdge: (key: string) => boolean;
  isInside: (key: string) => boolean;
  onPick: (key: string) => void;
}

export function MonthGrid({ year, onYearChange, min, max, isEdge, isInside, onPick }: MonthGridProps) {
  const { t: tr, locale } = useLocalization();
  const format = new Intl.DateTimeFormat(locale, { month: "short" });
  const minYear = min ? Number(min.slice(0, 4)) : undefined;
  const maxYear = max ? Number(max.slice(0, 4)) : undefined;
  const bounds = { min: min ? toMonthOf(min) : undefined, max: max ? toMonthOf(max) : undefined };
  return (
    <div className="flex flex-col gap-2">
      <CalendarNav label={String(year)} previousLabel={tr("Anno precedente")} nextLabel={tr("Anno successivo")}
        canPrevious={minYear === undefined || year > minYear} canNext={maxYear === undefined || year < maxYear}
        onPrevious={() => onYearChange(year - 1)} onNext={() => onYearChange(year + 1)} />
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 12 }, (_, index) => {
          const key = monthKey(year, index);
          const disabled = outOfBounds(key, bounds.min, bounds.max);
          const edge = isEdge(key);
          return (
            <button key={key} type="button" disabled={disabled} aria-pressed={edge || isInside(key)} onClick={() => onPick(key)}
              className={cn(
                "min-h-11 rounded-lg text-sm font-medium capitalize transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-35",
                edge ? "bg-primary text-primary-foreground" : isInside(key) ? "bg-primary/12 text-foreground" : "text-foreground hover:bg-muted disabled:hover:bg-transparent"
              )}>
              {format.format(new Date(year, index, 1)).replace(".", "")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface CalendarNavProps {
  label: string;
  previousLabel: string;
  nextLabel: string;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  /** When set, the label becomes a button (the day calendar opens the month view from it). */
  onLabelClick?: () => void;
  labelAction?: string;
}

/** Header of a calendar page: «‹ ottobre 2026 ›». */
export function CalendarNav({ label, previousLabel, nextLabel, canPrevious, canNext, onPrevious, onNext, onLabelClick, labelAction }: CalendarNavProps) {
  const arrow = "flex size-11 items-center justify-center rounded-lg text-text-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 disabled:hover:bg-transparent sm:size-9";
  return (
    <div className="flex items-center justify-between gap-1">
      <button type="button" className={arrow} aria-label={previousLabel} disabled={!canPrevious} onClick={onPrevious}>
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
      </button>
      {onLabelClick ? (
        <button type="button" onClick={onLabelClick} aria-label={labelAction ? `${label}, ${labelAction}` : label}
          className="min-h-11 rounded-lg px-3 font-heading text-base font-medium capitalize outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9">
          {label}
        </button>
      ) : (
        <span className="font-heading text-base font-medium capitalize" aria-live="polite">{label}</span>
      )}
      <button type="button" className={arrow} aria-label={nextLabel} disabled={!canNext} onClick={onNext}>
        <ChevronRightIcon className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
