"use client";
import { useLocalization } from "@/lib/localization/provider";

import { PeriodSelector } from "@/components/domain/shared";
import type { PeriodSurface } from "@/lib/analytics";
import { validChartRange, type PortfolioChartPeriod, type PortfolioChartRange } from "@/lib/investments/chart-period";

const OPTIONS = [
  { value: "1mese", label: "1M" }, { value: "3mesi", label: "3M" },
  { value: "ytd", label: "YTD" }, { value: "1anno", label: "1A" },
  { value: "max", label: "Max" },
] as const;

export interface PortfolioPeriodSelectorProps {
  value: PortfolioChartPeriod;
  range: PortfolioChartRange;
  today: string;
  onChange: (period: PortfolioChartPeriod) => void;
  onRangeChange: (range: PortfolioChartRange) => void;
  /** Screen, for the calendar's product events. */
  surface?: PeriodSurface;
  /** Write the chosen dates under the presets (off where the page already shows them). */
  showRangeCaption?: boolean;
}

/** Portfolio chart presets plus a calendar for an inclusive date range up to today. */
export function PortfolioPeriodSelector({ value, range, today, onChange, onRangeChange, surface = "investimenti", showRangeCaption = true }: PortfolioPeriodSelectorProps) {
  const { t: tr } = useLocalization();
  return <PeriodSelector options={OPTIONS} value={value} onChange={onChange} ariaLabel={tr("Periodo del grafico")}
    custom={{
      value: "custom", granularity: "day", range, max: today, surface, showCaption: showRangeCaption,
      validate: (next) => validChartRange(next, today) ? null : tr("Scegli date valide, in ordine e non successive a oggi."),
      onApply: onRangeChange,
    }} />;
}
