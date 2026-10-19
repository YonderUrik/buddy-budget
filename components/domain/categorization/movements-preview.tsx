"use client";
import { useLocalization } from "@/lib/localization/provider";
/**
 * A merchant's transactions in brief: date, amount and, when it differs from the name, the bank's description. With
 * `ids` each line opens that transaction's detail.
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { localizedFormats } from "@/lib/localization/format";
import { cn } from "@/lib/utils";

// Opened only on a tap: its code loads then, not with Categorizza.
const MovementDetailDialog = dynamic(() => import("@/components/domain/liquidity/light").then((m) => m.MovementDetailDialog), { ssr: false });

/** Quanti movimenti mostrare prima di «e altri N». */
export const MOVEMENTS_PREVIEW_LIMIT = 3;

export interface MovementsPreviewProps {
  /** Nome mostrato del gruppo: le descrizioni uguali non si ripetono. */
  label: string;
  dates: readonly string[];
  amounts: readonly number[];
  descriptions: readonly string[];
  /** Ids of the transactions, in the same order: each line then opens its detail. */
  ids?: readonly string[];
  currency: string;
  limit?: number;
  className?: string;
}

export function MovementsPreview({ label, dates, amounts, descriptions, ids, currency, limit = MOVEMENTS_PREVIEW_LIMIT, className }: MovementsPreviewProps) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const { t: tr, locale } = useLocalization();
  const { formatCurrency, formatShortDate } = localizedFormats(locale);
  const order = dates.map((_, index) => index).sort((a, b) => dates[b].localeCompare(dates[a]));
  const shown = order.slice(0, limit);
  const hidden = order.length - shown.length;
  return (
    <ul className={cn("flex flex-col gap-1 text-xs text-muted-foreground", className)} aria-label={tr("Movimenti")}>
      {shown.map((index) => {
        const line = (
          <>
            <span className="w-12 shrink-0 tabular-nums">{formatShortDate(dates[index])}</span>
            <span className="min-w-0 flex-1 truncate" title={descriptions[index]}>
              {descriptions[index] !== label ? descriptions[index] : null}
            </span>
            <span className={cn("shrink-0 tabular-nums", amounts[index] > 0 ? "text-pos" : "text-foreground")}>
              {formatCurrency(amounts[index], currency)}
            </span>
          </>
        );
        const id = ids?.[index];
        return (
          <li key={index}>
            {id ? (
              <button
                type="button"
                onClick={() => setOpenId(id)}
                aria-label={tr("Apri il movimento del {0}", { 0: formatShortDate(dates[index]) })}
                className="-mx-1.5 flex min-h-8 w-[calc(100%+0.75rem)] items-baseline gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-foreground/[0.06] focus-visible:outline-2 focus-visible:outline-ring"
              >
                {line}
              </button>
            ) : (
              <div className="flex items-baseline gap-2">{line}</div>
            )}
          </li>
        );
      })}
      {hidden > 0 ? <li className="pl-14">{tr("e")}{" "}{hidden === 1 ? tr("un altro") : tr("altri {0}", {0: hidden})}</li> : null}
      {ids ? <MovementDetailDialog transactionId={openId} onOpenChange={(open) => !open && setOpenId(null)} from="categorizza" /> : null}
    </ul>
  );
}
