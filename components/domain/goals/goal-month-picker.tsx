"use client";

/**
 * Month and year as two native selects, instead of `<input type="month">`: Safari on Mac and Firefox show that as a
 * plain text field, and a half-typed value («2», «ott») used to crash the form. Picking only one of the two fills the
 * other with the first allowed choice, so the value is always a complete month key (YYYY-MM) or null.
 */

import * as React from "react";
import { isMonthKey, monthKeyAtLeast } from "@/lib/goals/plan";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";

/** How many years after the first allowed one the year list reaches. */
const GOAL_YEARS_AHEAD = 40;

const SELECT_CLASS =
  "h-11 min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-9 dark:bg-input/30";

export interface GoalMonthPickerProps {
  /** Chosen month (YYYY-MM) or null for no date. */
  value: string | null;
  /** First month that can be chosen (YYYY-MM). */
  min: string;
  onChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
}

export function GoalMonthPicker({ value, min, onChange, className, "aria-label": ariaLabel }: GoalMonthPickerProps) {
  const { t: tr, locale } = useLocalization();
  const [minYear, minMonth] = min.split("-").map(Number);
  const chosen = value && isMonthKey(value) ? value.split("-").map(Number) : null;
  const year = chosen?.[0] ?? null;
  const month = chosen?.[1] ?? null;

  const monthNames = React.useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" });
    return Array.from({ length: 12 }, (_, i) => format.format(new Date(Date.UTC(2000, i, 15))));
  }, [locale]);
  const years = Array.from({ length: GOAL_YEARS_AHEAD + 1 }, (_, i) => minYear + i);
  if (year !== null && !years.includes(year)) years.push(year);

  return (
    <div role="group" aria-label={ariaLabel} className={cn("flex items-center gap-2", className)}>
      <select
        value={month ?? ""}
        onChange={(e) => {
          const m = Number(e.target.value);
          onChange(monthKeyAtLeast(year ?? (m >= minMonth ? minYear : minYear + 1), m, min));
        }}
        className={cn(SELECT_CLASS, "capitalize")}
        aria-label={tr("Mese")}
      >
        {month === null ? (
          <option value="" disabled>
            {tr("Mese")}
          </option>
        ) : null}
        {monthNames.map((name, i) => (
          <option key={name} value={i + 1} disabled={year === minYear && i + 1 < minMonth}>
            {name}
          </option>
        ))}
      </select>
      <select
        value={year ?? ""}
        onChange={(e) => onChange(monthKeyAtLeast(Number(e.target.value), month ?? minMonth, min))}
        className={SELECT_CLASS}
        aria-label={tr("Anno")}
      >
        {year === null ? (
          <option value="" disabled>
            {tr("Anno")}
          </option>
        ) : null}
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
