"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/** Cifra eroe di Liquidità (totale o di un conto) con variazione, grafico a tutta larghezza e selettore del periodo. */

import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { MoneyHero } from "@/components/domain/net-worth";
import { PeriodSelector, HeroField } from "@/components/domain/shared";

import type { NetWorthPeriod } from "@/lib/calc/net-worth";
import { cn } from "@/lib/utils";
import { TrendChart, type TrendPoint } from "./trend-chart";

const PERIOD_OPTIONS = [
  { value: "1mese", label: "1M" },
  { value: "3mesi", label: "3M" },
  { value: "1anno", label: "1A" },
  { value: "max", label: "Max" },
] as const satisfies readonly { value: NetWorthPeriod; label: string }[];

/** Testo del periodo nella riga della variazione ("negli ultimi 3 mesi"). */
export const PERIOD_PHRASES: Record<NetWorthPeriod, string> = {
  "1mese": "nell'ultimo mese",
  "3mesi": "negli ultimi 3 mesi",
  "1anno": "nell'ultimo anno",
  max: "da quando c'è lo storico",
};

export interface LiquidityHeroProps {
  /** Nome di ciò che si guarda ("Liquidità totale", "Conto corrente"). */
  label: string;
  value: number;
  currency: string;
  /** Variazione nel periodo; null se non calcolabile. */
  delta: number | null;
  period: NetWorthPeriod;
  onPeriodChange: (period: NetWorthPeriod) => void;
  points: readonly TrendPoint[];
  className?: string;
}

export function LiquidityHero({ label, value, currency, delta, period, onPeriodChange, points, className }: LiquidityHeroProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const up = (delta ?? 0) >= 0;
  const Icon = up ? TrendingUpIcon : TrendingDownIcon;
  const first = points[0];
  const description = first
    ? tr("{0}: da {1} a {2} {3}.", { 0: label, 1: formatCurrency(first.value, currency, { maximumFractionDigits: 0 }), 2: formatCurrency(value, currency, { maximumFractionDigits: 0 }), 3: tr(PERIOD_PHRASES[period]) })
    : `${label}: ${formatCurrency(value, currency, { maximumFractionDigits: 0 })}.`;
  return (
    <HeroField>
    <section aria-label={tr(label)} className={className}>
      <p className="text-base text-text-2">{tr(label)}</p>
      <MoneyHero value={value} currency={currency} className="text-5xl leading-none tracking-tight sm:text-7xl" />
      <div className="mt-3 min-h-5">
        {delta !== null && (
          <p className="flex flex-wrap items-center gap-x-2 text-sm">
            <span className={cn("inline-flex items-center gap-1.5 font-semibold tabular-nums", up ? "text-pos" : "text-neg")}>
              <Icon className="size-4" aria-hidden="true" />
              {up ? "+" : "−"}
              {formatCurrency(Math.abs(delta), currency, { maximumFractionDigits: 0 })}
            </span>
            <span className="text-text-2">{tr(PERIOD_PHRASES[period])}</span>
          </p>
        )}
      </div>
      <div className="-mx-4 mt-2 sm:-mx-6">
        <TrendChart points={points} description={tr(description)} height={260} formatValue={(n) => formatCurrency(n, currency, { maximumFractionDigits: 0 })} />
      </div>
      <div className="mt-3 flex justify-center">
        <PeriodSelector options={PERIOD_OPTIONS} value={period} onChange={onPeriodChange} ariaLabel={tr("Periodo del grafico")} />
      </div>
    </section>
    </HeroField>
  );
}
