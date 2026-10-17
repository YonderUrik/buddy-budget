"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Body of the custom-range sheet: the two ends («Dal», «Al») as boxes, a calendar of days or months, the reason a
 * range cannot be used, and «Applica». It keeps its own draft, so closing without applying changes nothing.
 */

import * as React from "react";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inDraft, parseMonth, pickRange, type RangeDraft, type RangeGranularity } from "@/lib/calc/calendar-range";
import { cn } from "@/lib/utils";
import { MonthGrid } from "./month-grid";
import { RangeCalendar } from "./range-calendar";

export interface PeriodRange {
  from: string;
  to: string;
}

export interface PeriodRangePanelProps {
  granularity: RangeGranularity;
  initial: PeriodRange;
  min?: string;
  max?: string;
  /** Why a complete range cannot be used (already translated), or null when it is fine. */
  validate?: (range: PeriodRange) => string | null;
  onApply: (range: PeriodRange) => void;
  onCancel: () => void;
}

export function PeriodRangePanel({ granularity, initial, min, max, validate, onApply, onCancel }: PeriodRangePanelProps) {
  const { t: tr, locale } = useLocalization();
  const [draft, setDraft] = React.useState<RangeDraft>(initial);
  const [monthYear, setMonthYear] = React.useState(() => parseMonth(initial.to).year);
  const complete = draft.to !== null ? { from: draft.from, to: draft.to } : null;
  const error = complete ? (validate?.(complete) ?? null) : null;
  const pick = (key: string) => setDraft((current) => pickRange(current, key));

  const format = new Intl.DateTimeFormat(locale, granularity === "day" ? { day: "numeric", month: "short", year: "numeric" } : { month: "long", year: "numeric" });
  const label = (key: string) => {
    const { year, monthIndex } = parseMonth(key);
    return format.format(new Date(year, monthIndex, granularity === "day" ? Number(key.slice(8, 10)) : 1));
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="font-heading text-base font-medium">{granularity === "day" ? tr("Scegli le date") : tr("Scegli i mesi")}</p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2" aria-live="polite">
        <End label={tr("Dal")} value={label(draft.from)} waiting={false} />
        <ArrowRightIcon className="size-4 text-text-3" aria-hidden="true" />
        <End label={tr("Al")} value={draft.to ? label(draft.to) : granularity === "day" ? tr("Tocca l'ultimo giorno") : tr("Tocca l'ultimo mese")} waiting={draft.to === null} />
      </div>
      {granularity === "day" ? (
        <RangeCalendar draft={draft} onPick={pick} min={min} max={max} />
      ) : (
        <MonthGrid year={monthYear} onYearChange={setMonthYear} min={min} max={max} onPick={pick}
          isEdge={(key) => key === draft.from || key === draft.to} isInside={(key) => inDraft(draft, key)} />
      )}
      {error ? <p role="alert" className="text-xs text-neg">{error}</p> : null}
      <div className="flex gap-2 max-sm:flex-col-reverse sm:justify-end">
        <Button type="button" variant="ghost" className="max-sm:h-11" onClick={onCancel}>{tr("Annulla")}</Button>
        <Button type="button" className="max-sm:h-11" disabled={!complete || error !== null} onClick={() => complete && onApply(complete)}>{tr("Applica")}</Button>
      </div>
    </div>
  );
}

function End({ label, value, waiting }: { label: string; value: string; waiting: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-lg border px-3 py-2", waiting ? "border-primary ring-2 ring-primary/20" : "border-border")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("truncate text-sm font-medium tabular-nums", waiting && "text-muted-foreground")}>{value}</p>
    </div>
  );
}
