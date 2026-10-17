"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * The app's period selector: short presets (1M, 3M, YTD…) on one line that never wraps, and, when the screen allows
 * a custom range, a calendar button that opens a sheet with a real calendar (a bottom sheet on the phone). Every
 * time-period choice uses this, so the presets look and behave the same everywhere.
 */

import * as React from "react";
import { motion } from "motion/react";
import { CalendarDaysIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { track, type PeriodSurface } from "@/lib/analytics";
import { rangeSpan, shortRangeLabel, type RangeGranularity } from "@/lib/calc/calendar-range";
import { SPRING_BOUNCY } from "@/lib/motion/springs";
import { cn } from "@/lib/utils";
import { PeriodRangePanel, type PeriodRange } from "./period-range-panel";

export interface PeriodOption<T extends string> {
  value: T;
  /** Short label (Italian source text, translated here). */
  label: string;
}

export interface PeriodCustomRange<T extends string> {
  /** Value that `value` takes while the custom range is in use. */
  value: T;
  granularity: RangeGranularity;
  /** Last applied range: `YYYY-MM-DD` for days, `YYYY-MM` for months. */
  range: PeriodRange;
  min?: string;
  /** Usually today (days) or the last full month (months). */
  max?: string;
  /** Why a range cannot be used (already translated), or null. */
  validate?: (range: PeriodRange) => string | null;
  /** Called with the chosen range; the caller stores it and switches `value` to the custom one. */
  onApply: (range: PeriodRange) => void;
  /** Screen name for the calendar's product events. */
  surface: PeriodSurface;
  /** Show the chosen range under the presets (off where the screen already writes it). */
  showCaption?: boolean;
}

export interface PeriodSelectorProps<T extends string> {
  options: readonly PeriodOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  custom?: PeriodCustomRange<T>;
  /** Full width with equal segments (phone layouts). */
  stretch?: boolean;
  className?: string;
}

const SEGMENT = "relative flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 sm:min-w-9";

export function PeriodSelector<T extends string>({ options, value, onChange, ariaLabel, custom, stretch = false, className }: PeriodSelectorProps<T>) {
  const { t: tr, locale } = useLocalization();
  const pillId = React.useId();
  const [open, setOpen] = React.useState(false);
  const customActive = custom !== undefined && value === custom.value;
  const caption = customActive && custom.showCaption !== false
    ? shortRangeLabel(custom.range.from, custom.range.to, custom.granularity, locale, new Date().getFullYear())
    : null;

  const pill = (active: boolean) => active ? (
    <motion.span layoutId={pillId} transition={SPRING_BOUNCY} aria-hidden="true" className="absolute inset-0 rounded-full bg-background" />
  ) : null;
  const tone = (active: boolean) => active ? "text-foreground" : "text-muted-foreground hover:text-foreground";

  const openChange = (next: boolean) => {
    setOpen(next);
    if (next && custom) track("period_calendar_opened", { surface: custom.surface });
  };
  const apply = (range: PeriodRange) => {
    if (!custom) return;
    custom.onApply(range);
    if (value !== custom.value) onChange(custom.value);
    track("period_range_applied", { surface: custom.surface, granularity: custom.granularity, span: rangeSpan(range.from, range.to, custom.granularity) });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={openChange}>
      <div className={cn("min-w-0 flex-col gap-1.5", stretch ? "flex w-full" : "inline-flex max-w-full")}>
        <div role="group" aria-label={tr(ariaLabel)} className={cn(
          "scrollbar-hidden flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-muted p-1",
          stretch ? "w-full" : "w-fit",
          className
        )}>
          {options.map((option) => (
            <button key={option.value} type="button" onClick={() => onChange(option.value)} aria-pressed={value === option.value}
              className={cn(SEGMENT, stretch && "flex-1", tone(value === option.value))}>
              {pill(value === option.value)}
              <span className="relative">{tr(option.label)}</span>
            </button>
          ))}
          {custom ? (
            <PopoverTrigger aria-pressed={customActive}
              aria-label={customActive ? tr("Date scelte: {0}. Cambia le date", { 0: shortRangeLabel(custom.range.from, custom.range.to, custom.granularity, locale, new Date().getFullYear()) }) : custom.granularity === "day" ? tr("Scegli le date") : tr("Scegli i mesi")}
              title={custom.granularity === "day" ? tr("Scegli le date") : tr("Scegli i mesi")}
              className={cn(SEGMENT, stretch && "flex-1", tone(customActive))}>
              {pill(customActive)}
              <CalendarDaysIcon className="relative size-4" aria-hidden="true" />
            </PopoverTrigger>
          ) : null}
        </div>
        {caption ? (
          <button type="button" onClick={() => openChange(true)}
            className="self-center rounded-full px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">
            {caption}
          </button>
        ) : null}
      </div>
      {custom ? (
        <PopoverContent align="end" className="w-80 p-3">
          {open ? (
            <PeriodRangePanel granularity={custom.granularity} initial={custom.range} min={custom.min} max={custom.max}
              validate={custom.validate} onApply={apply} onCancel={() => setOpen(false)} />
          ) : null}
        </PopoverContent>
      ) : null}
    </Popover>
  );
}
