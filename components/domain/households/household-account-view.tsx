"use client";

/** An account another member shows the group: balance and transactions, read-only, with whose it is. */

import { AccountAvatar } from "@/components/domain/accounts";
import { CategoryAvatar } from "@/components/domain/categories";
import { LoadError, PAGE_TITLE } from "@/components/domain/shared";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import { useHouseholdAccountQuery } from "@/lib/queries/households";
import type { AccountColor, AccountIcon } from "@/lib/validation/accounts";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "./person-avatar";

export interface HouseholdAccountViewProps {
  householdId: string;
  accountId: string;
  currency: string;
}

export function HouseholdAccountView({ householdId, accountId, currency }: HouseholdAccountViewProps) {
  const { t: tr, locale } = useLocalization();
  const { formatCurrency, formatDateWithYear } = localizedFormats(locale);
  const { data, isLoading, isError, refetch } = useHouseholdAccountQuery(householdId, accountId);
  if (isError) return <LoadError message={tr("Impossibile caricare il conto")} onRetry={() => refetch()} />;
  if (isLoading || !data) return <div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />;
  const { account, owner, transactions } = data;
  const byDay = new Map<string, typeof transactions>();
  for (const t of transactions) byDay.set(t.date, [...(byDay.get(t.date) ?? []), t]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <AccountAvatar color={account.color as AccountColor} icon={account.icon as AccountIcon} className="size-14" size={24} />
        <h1 className={PAGE_TITLE}>{account.name}</h1>
        <p className="flex items-center gap-2 text-text-2">
          <PersonAvatar initial={owner.initial} slot={owner.slot} name={owner.name} size="xs" />
          {owner.isMe ? tr("Tuo, in comune con il gruppo") : tr("Di {0}: lo gestisce {0}, tu lo vedi", { 0: owner.name })}
        </p>
        <p className="font-heading text-4xl font-semibold tabular-nums">{formatCurrency(account.balance, currency)}</p>
      </header>
      {transactions.length === 0 ? (
        <p className="text-text-2">{tr("Ancora nessun movimento su questo conto.")}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {[...byDay].map(([day, rows]) => (
            <section key={day} className="flex flex-col gap-1">
              <h2 className="text-sm font-medium text-text-2">{formatDateWithYear(day)}</h2>
              <ul className="flex flex-col">
                {rows.map((t) => (
                  <li key={t.id} className="flex min-h-14 items-center gap-3.5 py-1.5">
                    {t.category ? <CategoryAvatar color={t.category.color as CategoryColor} icon={t.category.icon as CategoryIcon} size={18} className="size-10" /> : <span className="size-10" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{t.description}</span>
                      <span className="block truncate text-sm text-text-2">{t.category?.name ?? tr("Senza categoria")}</span>
                    </span>
                    <span className={cn("font-heading font-semibold tabular-nums", t.amount > 0 ? "text-pos" : "text-foreground")}>
                      {t.amount > 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(t.amount), currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
