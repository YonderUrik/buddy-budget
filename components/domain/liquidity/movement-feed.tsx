"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/**
 * Transactions grouped by day: a heading with the day's label and total, then the transactions, shown in blocks with
 * "Mostra altri". Tapping a transaction opens its detail.
 */

import * as React from "react";
import dynamic from "next/dynamic";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryUsageCounts } from "@/lib/categories/picker";
import { LogoCredit } from "@/components/domain/categorization";
import type { ListedTransaction } from "@/lib/queries/transactions";

import { groupByDay } from "@/lib/liquidity/day-groups";
import { MovementItem } from "./movement-item";

// Opened only on a tap: its code loads then, not with the list.
const MovementDetailDialog = dynamic(() => import("./movement-detail-dialog").then((m) => m.MovementDetailDialog), { ssr: false });

/** Quanti giorni compaiono prima di "Mostra altri", e quanti se ne aggiungono a ogni clic. */
const DAYS_PER_PAGE = 10;

export interface MovementFeedProps {
  transactions: readonly ListedTransaction[];
  categories: readonly Category[];
  usage?: CategoryUsageCounts;
  /** Nome del conto per id; con un solo conto filtrato si può omettere per non ripeterlo su ogni riga. */
  accountNames?: ReadonlyMap<string, string>;
  currency: string;
  today: Date;
  emptyMessage: string;
}

export function MovementFeed({ transactions, categories, usage, accountNames, currency, today, emptyMessage }: MovementFeedProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const [days, setDays] = React.useState(DAYS_PER_PAGE);
  const [logosShown, setLogosShown] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const showLogoCredit = React.useCallback(() => setLogosShown(true), []);
  const groups = React.useMemo(() => groupByDay([...transactions], today, formattingLocale), [transactions, today, formattingLocale]);
  if (groups.length === 0) return <p className="py-10 text-center text-text-2">{tr(emptyMessage)}</p>;
  return (
    <div>
      {groups.slice(0, days).map((group) => (
        <section key={group.date} aria-label={tr(group.label)}>
          <div className="flex items-baseline justify-between px-1.5 pt-5 pb-1 text-sm font-semibold text-text-2">
            <h3 className="capitalize">{tr(group.label)}</h3>
            <span className="tabular-nums">
              {group.total >= 0 ? "+" : "−"}
              {formatCurrency(Math.abs(group.total), currency)}
            </span>
          </div>
          <ul>
            {group.items.map((transaction) => (
              <MovementItem
                key={transaction.id}
                transaction={transaction}
                categories={categories}
                usage={usage}
                accountName={accountNames?.get(transaction.accountId)}
                currency={currency}
                onRemoteLogo={showLogoCredit}
                onOpen={() => setOpenId(transaction.id)}
              />
            ))}
          </ul>
        </section>
      ))}
      {groups.length > days && (
        <div className="flex justify-center pt-5">
          <button type="button" onClick={() => setDays((d) => d + DAYS_PER_PAGE)} className="min-h-11 rounded-xl px-4 font-semibold text-primary hover:underline">{tr("Mostra altri movimenti")}</button>
        </div>
      )}
      <LogoCredit visible={logosShown} className="pt-4" />
      <MovementDetailDialog
        transactionId={openId}
        onOpenChange={(open) => !open && setOpenId(null)}
        from="movimenti"
        placeholder={openId ? transactions.find((t) => t.id === openId) : undefined}
      />
    </div>
  );
}
