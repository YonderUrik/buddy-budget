"use client";
import { useLocalization } from "@/lib/localization/provider";
/** Griglia di indicatori calcolati (multipli, margini, redditività, solidità): solo quelli disponibili, nell'ordine dato. */

import type { Indicator } from "@/lib/investments/title-fundamentals";
import { cn } from "@/lib/utils";
import { IndicatorItem } from "./indicator-item";
import { INDICATOR_META, formatIndicator, type IndicatorKey } from "./indicator-meta";

/** Fonte dei numeri calcolati dall'app sui bilanci di Yahoo. */
export const CALCULATED_SOURCE = "Calcolato dall'app sui bilanci pubblicati da Yahoo Finance (non ufficiali).";

export interface IndicatorGridProps<K extends IndicatorKey> {
  keys: readonly K[];
  values: Partial<Record<K, Indicator>>;
  currency: string;
  priceCurrency: string;
  /** Mostra la forbice degli esercizi passati sotto il valore, quando c'è. */
  withRange?: boolean;
  className?: string;
}

export function IndicatorGrid<K extends IndicatorKey>({ keys, values, currency, priceCurrency, withRange = false, className }: IndicatorGridProps<K>) {
  const { t: tr, locale } = useLocalization();
  const present = keys.filter((k) => values[k] !== undefined);
  if (present.length === 0) return null;
  return (
    <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-5", className)}>
      {present.map((key) => {
        const indicator = values[key]!;
        const meta = INDICATOR_META[key];
        return (
          <IndicatorItem
            key={key}
            label={tr(meta.label)}
            value={formatIndicator(indicator.value, meta.format, locale)}
            hint={tr(meta.hint)}
            range={withRange && indicator.history ? { range: indicator.history, value: indicator.value, format: meta.format } : null}
            help={{ id: key, title: meta.label, formula: meta.formula, indicator, format: meta.format, currency, priceCurrency, source: CALCULATED_SOURCE }}
          />
        );
      })}
    </dl>
  );
}
