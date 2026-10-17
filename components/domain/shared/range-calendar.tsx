"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * One month of days for picking a range by tapping its first and last day. Arrow keys move between days (also across
 * months); the month title opens a month view to jump far back without tapping the arrow dozens of times.
 */

import * as React from "react";
import { addDaysKey, dayKey, inDraft, monthGrid, monthKey, outOfBounds, parseMonth, toMonthOf, type RangeDraft } from "@/lib/calc/calendar-range";
import { cn } from "@/lib/utils";
import { CalendarNav, MonthGrid } from "./month-grid";

export interface RangeCalendarProps {
  draft: RangeDraft;
  onPick: (key: string) => void;
  /** Day keys (`YYYY-MM-DD`). */
  min?: string;
  max?: string;
}

const KEY_STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

export function RangeCalendar({ draft, onPick, min, max }: RangeCalendarProps) {
  const { t: tr, locale } = useLocalization();
  const [visible, setVisible] = React.useState(() => parseMonth(draft.to ?? draft.from));
  const [view, setView] = React.useState<"days" | "months">("days");
  const [focusKey, setFocusKey] = React.useState(draft.to ?? draft.from);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const moveFocus = React.useRef(false);

  const days = monthGrid(visible.year, visible.monthIndex);
  const current = monthKey(visible.year, visible.monthIndex);
  const title = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(visible.year, visible.monthIndex, 1));
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(new Date(2026, 0, 5 + i)));
  const fullDate = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const showMonth = (offset: number) => setVisible(parseMonth(monthKey(visible.year, visible.monthIndex + offset)));
  // The focusable day stays inside the visible month, so Tab always lands on a day of the page being shown.
  const tabKey = toMonthOf(focusKey) === current ? focusKey : dayKey(visible.year, visible.monthIndex, 1);

  React.useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusKey}"]`)?.focus();
  }, [focusKey, visible]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = KEY_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    const next = addDaysKey(tabKey, step);
    if (outOfBounds(next, min, max)) return;
    moveFocus.current = true;
    setFocusKey(next);
    if (toMonthOf(next) !== current) setVisible(parseMonth(next));
  };

  if (view === "months") {
    return (
      <MonthGrid year={visible.year} onYearChange={(year) => setVisible({ ...visible, year })} min={min} max={max}
        isEdge={(key) => key === current} isInside={() => false}
        onPick={(key) => { setVisible(parseMonth(key)); setView("days"); }} />
    );
  }

  const minMonth = min ? toMonthOf(min) : undefined;
  const maxMonth = max ? toMonthOf(max) : undefined;
  return (
    <div className="flex flex-col gap-1">
      <CalendarNav label={title} previousLabel={tr("Mese precedente")} nextLabel={tr("Mese successivo")}
        canPrevious={!minMonth || current > minMonth} canNext={!maxMonth || current < maxMonth}
        onPrevious={() => showMonth(-1)} onNext={() => showMonth(1)}
        onLabelClick={() => setView("months")} labelAction={tr("scegli il mese")} />
      <div className="grid grid-cols-7 text-center text-xs text-text-3" aria-hidden="true">
        {weekdays.map((day, i) => <span key={i} className="py-1 capitalize">{day}</span>)}
      </div>
      <div ref={gridRef} role="group" aria-label={title} className="grid grid-cols-7 gap-y-0.5" onKeyDown={onKeyDown}>
        {days.map(({ key, day, inMonth }) => {
          const disabled = outOfBounds(key, min, max);
          const edge = key === draft.from || key === draft.to;
          const inside = !edge && inDraft(draft, key);
          const { year, monthIndex } = parseMonth(key);
          return (
            <button key={key} type="button" data-day={key} disabled={disabled} tabIndex={key === tabKey ? 0 : -1}
              aria-pressed={edge || inside} aria-label={fullDate.format(new Date(year, monthIndex, day))}
              onClick={() => { setFocusKey(key); onPick(key); }}
              className={cn(
                "relative flex h-11 items-center justify-center text-sm tabular-nums outline-none transition-colors sm:h-9",
                "focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring rounded-lg disabled:opacity-30",
                inside && "rounded-none bg-primary/12",
                key === draft.from && draft.to !== null && draft.to !== draft.from && "rounded-r-none",
                key === draft.to && draft.to !== draft.from && "rounded-l-none",
                edge ? "bg-primary font-semibold text-primary-foreground" : inMonth ? "text-foreground" : "text-text-3",
                !edge && !inside && !disabled && "hover:bg-muted"
              )}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
