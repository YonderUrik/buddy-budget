"use client";

/** The same merchant over the last year, inside a transaction's detail: count, total and the latest others, each one tappable. */

import { ChevronRightIcon } from "lucide-react";
import { PAGE_TITLE_FACE } from "@/components/domain/shared";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import { localizedDetailText } from "@/lib/transactions/detail-text";
import type { MerchantSummary } from "@/lib/transactions/detail";
import { cn } from "@/lib/utils";

export interface MovementDetailMerchantProps {
  summary: MerchantSummary;
  currency: string;
  /** Opens another transaction of the list in the same detail. */
  onOpen: (id: string) => void;
}

export function MovementDetailMerchant({ summary, currency, onOpen }: MovementDetailMerchantProps) {
  const { t: tr, locale, language } = useLocalization();
  const { formatCurrency, formatDateWithYear } = localizedFormats(locale);
  const { merchantCountText } = localizedDetailText(language);
  const signed = (value: number) => `${value > 0 ? "+" : "−"}${formatCurrency(Math.abs(value), currency)}`;
  return (
    <section aria-labelledby="movement-merchant-title" className="flex flex-col gap-2">
      <h3 id="movement-merchant-title" className={cn(PAGE_TITLE_FACE, "text-[1.75rem]")}>{tr("Da questo esercente")}</h3>
      <p className="text-sm text-text-2">
        {merchantCountText(summary.count)}
        {", "}
        <span className="font-heading font-semibold text-foreground tabular-nums">{signed(summary.total)}</span>
        {" "}{tr("in tutto")}
      </p>
      <ul className="-mx-2 flex flex-col">
        {summary.recent.map((movement) => (
          <li key={movement.id}>
            <button
              type="button"
              onClick={() => onOpen(movement.id)}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="flex-1 text-text-2">{formatDateWithYear(movement.date)}</span>
              <span className={cn("font-heading font-semibold tabular-nums", movement.amount > 0 ? "text-pos" : "text-foreground")}>{signed(movement.amount)}</span>
              <ChevronRightIcon className="size-4 text-text-3" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
