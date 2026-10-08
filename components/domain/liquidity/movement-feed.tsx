"use client";

/** Elenco dei movimenti a giorni: intestazione con etichetta e totale del giorno, poi i movimenti. Mostra a blocchi, con "Mostra altri". */

import * as React from "react";
import type { Category } from "@/lib/db/schema/categories";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { CategoryUsageCounts } from "@/lib/categories/picker";
import { formatCurrency } from "@/lib/format";
import { groupByDay } from "@/lib/liquidity/day-groups";
import { MovementItem } from "./movement-item";

/** Quanti giorni compaiono prima di "Mostra altri", e quanti se ne aggiungono a ogni clic. */
const DAYS_PER_PAGE = 10;

export interface MovementFeedProps {
  transactions: readonly Transaction[];
  categories: readonly Category[];
  usage?: CategoryUsageCounts;
  /** Nome del conto per id; con un solo conto filtrato si può omettere per non ripeterlo su ogni riga. */
  accountNames?: ReadonlyMap<string, string>;
  currency: string;
  today: Date;
  emptyMessage: string;
}

export function MovementFeed({ transactions, categories, usage, accountNames, currency, today, emptyMessage }: MovementFeedProps) {
  const [days, setDays] = React.useState(DAYS_PER_PAGE);
  const groups = React.useMemo(() => groupByDay([...transactions], today), [transactions, today]);
  if (groups.length === 0) return <p className="py-10 text-center text-text-2">{emptyMessage}</p>;
  return (
    <div>
      {groups.slice(0, days).map((group) => (
        <section key={group.date} aria-label={group.label}>
          <div className="flex items-baseline justify-between px-1.5 pt-5 pb-1 text-sm font-semibold text-text-2">
            <h3 className="capitalize">{group.label}</h3>
            <span className="font-mono tabular-nums">
              {group.total >= 0 ? "+" : "−"}
              {formatCurrency(Math.abs(group.total), currency)}
            </span>
          </div>
          <ul className="divide-y divide-border/70">
            {group.items.map((transaction) => (
              <MovementItem
                key={transaction.id}
                transaction={transaction}
                categories={categories}
                usage={usage}
                accountName={accountNames?.get(transaction.accountId)}
                currency={currency}
              />
            ))}
          </ul>
        </section>
      ))}
      {groups.length > days && (
        <div className="flex justify-center pt-5">
          <button type="button" onClick={() => setDays((d) => d + DAYS_PER_PAGE)} className="min-h-11 rounded-xl px-4 font-semibold text-primary hover:underline">
            Mostra altri movimenti
          </button>
        </div>
      )}
    </div>
  );
}
