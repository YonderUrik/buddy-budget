"use client";

/**
 * The group view in Panoramica: the net worth of the members who show it (with each one's part), «Tra voi», the
 * month's household spending (shared accounts and expenses marked «in comune»), the shared accounts.
 */

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AccountAvatar } from "@/components/domain/accounts";
import { CategoryAvatar } from "@/components/domain/categories";
// Direct file import: the net-worth barrel carries the charts.
import { MoneyHero } from "@/components/domain/net-worth/money-hero";
import { SECTION_TITLE } from "@/components/domain/shared";
import type { HouseholdOverview } from "@/lib/households/types";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import type { AccountColor, AccountIcon } from "@/lib/validation/accounts";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { cn } from "@/lib/utils";
import { HouseholdBalanceCard } from "./household-balance-card";
import { joinNames } from "./people-names";
import { PERSON_FILL_CLASSES, PersonAvatar } from "./person-avatar";

export interface HouseholdOverviewViewProps {
  overview: HouseholdOverview;
  currency: string;
}

export function HouseholdOverviewView({ overview, currency }: HouseholdOverviewViewProps) {
  const { t: tr, locale } = useLocalization();
  const { formatCurrency } = localizedFormats(locale);
  const money = (n: number) => formatCurrency(n, currency, { maximumFractionDigits: 0 });
  const person = (id: string) => overview.members.find((m) => m.userId === id);
  const monthName = new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(`${overview.month}T12:00:00`));
  const { netWorth, spending } = overview;
  const positiveTotal = netWorth ? netWorth.parts.reduce((s, p) => s + Math.max(p.amount, 0), 0) : 0;

  return (
    <div className="flex flex-col gap-10">
      {netWorth ? (
        <section aria-labelledby="household-net-worth" className="flex flex-col gap-3">
          <h2 id="household-net-worth" className="text-base font-medium text-muted-foreground">{tr("Patrimonio di «{0}»", { 0: overview.name })}</h2>
          <MoneyHero value={netWorth.total} currency={currency} className="text-5xl sm:text-6xl" />
          {netWorth.parts.length > 1 && positiveTotal > 0 ? (
            <div className="flex h-3 gap-1 overflow-hidden rounded-full" aria-hidden="true">
              {netWorth.parts.map((p) => (
                <span key={p.userId} className={cn("h-full rounded-full", PERSON_FILL_CLASSES[(person(p.userId)?.slot ?? 0) % PERSON_FILL_CLASSES.length])} style={{ flexGrow: Math.max(p.amount, 0) / positiveTotal }} />
              ))}
            </div>
          ) : null}
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {netWorth.parts.map((p) => {
              const who = person(p.userId);
              return who ? (
                <li key={p.userId} className="flex items-center gap-2">
                  <PersonAvatar initial={who.initial} slot={who.slot} name={who.name} size="xs" />
                  <span className="text-sm text-text-2">{who.isMe ? tr("Tu") : who.name}</span>
                  <span className="font-heading font-semibold tabular-nums">{money(p.amount)}</span>
                </li>
              ) : null;
            })}
          </ul>
          {netWorth.hiddenUserIds.length > 0 ? (
            <p className="text-sm text-text-3">
              {tr("Non mostrano il patrimonio: {0}", { 0: joinNames(netWorth.hiddenUserIds.map((id) => (person(id)?.isMe ? tr("tu") : (person(id)?.name ?? ""))), tr) })}
            </p>
          ) : null}
        </section>
      ) : null}

      <HouseholdBalanceCard overview={overview} currency={currency} />

      <section aria-labelledby="household-spending" className="flex flex-col gap-3">
        <h2 id="household-spending" className={SECTION_TITLE}>{tr("Spese in comune a {0}", { 0: monthName })}</h2>
        {spending.rows.length === 0 ? (
          <p className="text-text-2">{tr("Ancora nessuna spesa questo mese: arrivano dai conti in comune e dalle spese che segnate «in comune».")}</p>
        ) : (
          <>
            <p className="text-text-2">
              <span className="font-heading font-semibold text-foreground tabular-nums">{money(spending.total)}</span>{" "}
              {overview.accounts.length > 0 ? tr("dai conti in comune e dalle spese in comune") : tr("dalle spese in comune")}
            </p>
            <ul className="flex flex-col gap-1">
              {spending.rows.map((row) => (
                <li key={row.name} className="flex min-h-14 items-center gap-3.5 py-1">
                  <CategoryAvatar color={row.color as CategoryColor} icon={row.icon as CategoryIcon} size={18} className="size-10" />
                  <span className="min-w-0 flex-1 truncate">{row.name}</span>
                  <span className="flex items-center">
                    {row.payerIds.map((id, i) => {
                      const who = person(id);
                      return who ? <PersonAvatar key={id} initial={who.initial} slot={who.slot} name={who.name} size="xs" className={cn(i > 0 && "-ml-1.5 ring-2 ring-background")} /> : null;
                    })}
                  </span>
                  <span className="w-24 text-right font-heading font-semibold tabular-nums">{money(row.amount)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {overview.accounts.length > 0 ? (
        <section aria-labelledby="household-accounts" className="flex flex-col gap-3">
          <h2 id="household-accounts" className={SECTION_TITLE}>{tr("Conti in comune")}</h2>
          <ul className="flex flex-col gap-2">
            {overview.accounts.map((account) => {
              const owner = person(account.ownerId);
              const href = owner?.isMe ? `/liquidita?conto=${account.id}` : `/groups/${overview.id}/accounts/${account.id}`;
              return (
                <li key={account.id}>
                  <Link href={href} className="flex min-h-[4.25rem] items-center gap-3.5 rounded-2xl bg-foreground/[0.04] px-4 py-3 transition-colors hover:bg-foreground/[0.07]">
                    <AccountAvatar color={account.color as AccountColor} icon={account.icon as AccountIcon} className="size-11" size={19} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{account.name}</span>
                      <span className="flex items-center gap-1.5 text-sm text-text-2">
                        {owner ? <PersonAvatar initial={owner.initial} slot={owner.slot} name={owner.name} size="xs" /> : null}
                        {owner?.isMe ? tr("Tuo") : tr("Di {0}", { 0: owner?.name ?? "" })}
                      </span>
                    </span>
                    <span className="font-heading text-lg font-semibold tabular-nums">{formatCurrency(account.balance, currency)}</span>
                    <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <Link href={`/groups/${overview.id}`} className="w-fit text-sm font-semibold text-primary hover:underline">
        {tr("Chi c'è e cosa vede il gruppo")}
      </Link>
    </div>
  );
}
