"use client";
import { useLocalization } from "@/lib/localization/provider";
/** I movimenti di un esercente in breve: data, importo e, se diversa dal nome, la descrizione della banca. */

import { localizedFormats } from "@/lib/localization/format";
import { cn } from "@/lib/utils";

/** Quanti movimenti mostrare prima di «e altri N». */
export const MOVEMENTS_PREVIEW_LIMIT = 3;

export interface MovementsPreviewProps {
  /** Nome mostrato del gruppo: le descrizioni uguali non si ripetono. */
  label: string;
  dates: readonly string[];
  amounts: readonly number[];
  descriptions: readonly string[];
  currency: string;
  limit?: number;
  className?: string;
}

export function MovementsPreview({ label, dates, amounts, descriptions, currency, limit = MOVEMENTS_PREVIEW_LIMIT, className }: MovementsPreviewProps) {
  const { t: tr, locale } = useLocalization();
  const { formatCurrency, formatShortDate } = localizedFormats(locale);
  const order = dates.map((_, index) => index).sort((a, b) => dates[b].localeCompare(dates[a]));
  const shown = order.slice(0, limit);
  const hidden = order.length - shown.length;
  return (
    <ul className={cn("flex flex-col gap-1 text-xs text-muted-foreground", className)} aria-label={tr("Movimenti")}>
      {shown.map((index) => (
        <li key={index} className="flex items-baseline gap-2">
          <span className="w-12 shrink-0 tabular-nums">{formatShortDate(dates[index])}</span>
          <span className="min-w-0 flex-1 truncate" title={descriptions[index]}>
            {descriptions[index] !== label ? descriptions[index] : null}
          </span>
          <span className={cn("shrink-0 tabular-nums", amounts[index] > 0 ? "text-pos" : "text-foreground")}>
            {formatCurrency(amounts[index], currency)}
          </span>
        </li>
      ))}
      {hidden > 0 ? <li className="pl-14">{tr("e")}{" "}{hidden === 1 ? tr("un altro") : tr("altri {0}", {0: hidden})}</li> : null}
    </ul>
  );
}
