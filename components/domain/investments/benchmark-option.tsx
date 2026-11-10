"use client";

/**
 * One common index in «Confronta con un indice»: logo, name, what it holds (where, how many companies, how many
 * countries) and the ETF the comparison really uses. One full-width list row.
 * The chosen one gets the yellow ring and a check; the state is also in `aria-pressed`, never in colour alone.
 */

import { CheckIcon } from "lucide-react";
import type { BenchmarkSuggestion } from "@/lib/investments/benchmark-suggestions";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import { BenchmarkLogo } from "./benchmark-logo";

export interface BenchmarkOptionProps {
  suggestion: BenchmarkSuggestion;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export function BenchmarkOption({ suggestion, selected, disabled = false, onSelect }: BenchmarkOptionProps) {
  const { t: tr, locale } = useLocalization();
  const { formatRatio } = localizedFormats(locale);
  const companies = tr(suggestion.companies >= 1000 ? "circa {0} aziende" : "{0} aziende", { 0: formatRatio(suggestion.companies, 0) });
  const countries = suggestion.countries === 1 ? tr("1 paese") : tr("{0} paesi", { 0: suggestion.countries });
  const ticker = suggestion.yahooSymbol.split(".")[0];
  const check = (
    <span aria-hidden="true" className={cn("grid size-6 shrink-0 place-items-center rounded-full", selected ? "bg-sun text-on-sun" : "ring-1 ring-border ring-inset")}>
      {selected ? <CheckIcon className="size-4" strokeWidth={3} /> : null}
    </span>
  );
  const base = cn(
    "w-full text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
    selected ? "bg-highlight/60 ring-2 ring-sun dark:bg-sun/10" : "bg-muted/60 hover:bg-muted",
  );

  return (
    <button type="button" aria-pressed={selected} disabled={disabled} onClick={onSelect} className={cn(base, "flex min-w-0 items-center gap-3 rounded-2xl p-3")}>
      <BenchmarkLogo suggestion={suggestion} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">{suggestion.label}</span>
          <span className="text-sm text-muted-foreground">{tr(suggestion.area)}</span>
        </span>
        <span className="text-sm tabular-nums text-foreground">{companies}{" · "}{countries}</span>
        <span className="truncate text-xs text-muted-foreground">{tr("ETF {0} · {1}", { 0: suggestion.etfShortName, 1: ticker })}</span>
      </span>
      {check}
    </button>
  );
}
