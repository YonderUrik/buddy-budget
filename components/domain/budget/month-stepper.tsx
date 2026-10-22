"use client";

/** «‹ Ottobre 2026 ›»: moves one month at a time, never past `latest`. */

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useLocalization } from "@/lib/localization/provider";

export interface MonthStepperProps {
  /** `YYYY-MM`. */
  month: string;
  /** Last month that can be reached (`YYYY-MM`). */
  latest: string;
  onChange: (month: string) => void;
}

function shift(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthStepper({ month, latest, onChange }: MonthStepperProps) {
  const { t: tr, locale } = useLocalization();
  const [y, m] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
  const button = "flex size-11 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-30";
  return (
    <div className="flex items-center justify-between gap-2">
      <button type="button" className={button} onClick={() => onChange(shift(month, -1))} aria-label={tr("Mese prima")}>
        <ChevronLeftIcon className="size-5" aria-hidden="true" />
      </button>
      <p className="font-semibold first-letter:uppercase" aria-live="polite">{label}</p>
      <button type="button" className={button} onClick={() => onChange(shift(month, 1))} disabled={month >= latest} aria-label={tr("Mese dopo")}>
        <ChevronRightIcon className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
