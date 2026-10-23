"use client";

/**
 * Every expense that counts between the members of a group, newest first: who paid, who it was for and what it means
 * for the viewer. Expenses written in the group open «Modifica la spesa»; the members' own bank expenses are changed
 * from their Movimenti. The ones before the last «Pareggiate» are greyed under a line.
 */

import * as React from "react";
import { PlusIcon } from "lucide-react";
import { CategoryAvatar } from "@/components/domain/categories";
import { LoadError, PAGE_TITLE } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import type { HouseholdExpenseEntry, HouseholdPerson } from "@/lib/households/types";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import { useHouseholdExpensesQuery, useHouseholdsQuery } from "@/lib/queries/households";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { cn } from "@/lib/utils";
import { GroupExpenseDialog } from "./group-expense-dialog";
import { joinNames } from "./people-names";

export interface HouseholdExpensesViewProps {
  householdId: string;
  currency: string;
}

type Tr = (text: string, values?: Record<string, string | number>) => string;

/** «Pagata da Marco · per tutti», «Pagata da te · per Luca». */
function whoLine(entry: HouseholdExpenseEntry, members: readonly HouseholdPerson[], tr: Tr): string {
  const payer = members.find((m) => m.id === entry.payerId);
  const paid = payer?.isMe ? tr("Pagata da te") : tr("Pagata da {0}", { 0: payer?.name ?? "" });
  const forWhom = entry.chosenForIds
    ? tr("per {0}", { 0: joinNames(members.filter((m) => entry.forIds.includes(m.id)).map((m) => (m.isMe ? tr("te") : m.name)), tr) })
    : tr("per tutti");
  return `${paid} · ${forWhom}`;
}

/** What the expense means for the viewer, with a name when there is only one other person in it: «Marco ti deve 60,00 €», «devi 9,00 € a Luca». */
function mineLine(entry: HouseholdExpenseEntry, members: readonly HouseholdPerson[], money: (n: number) => string, tr: Tr): string {
  if (entry.mine < 0) {
    const payer = members.find((m) => m.id === entry.payerId);
    return payer ? tr("devi {0} a {1}", { 0: money(-entry.mine), 1: payer.name }) : tr("devi {0}", { 0: money(-entry.mine) });
  }
  if (entry.mine === 0) return tr("non ti tocca");
  const debtors = members.filter((m) => !m.isMe && entry.forIds.includes(m.id));
  return debtors.length === 1 ? tr("{0} ti deve {1}", { 0: debtors[0].name, 1: money(entry.mine) }) : tr("ti devono {0}", { 0: money(entry.mine) });
}

export function HouseholdExpensesView({ householdId, currency }: HouseholdExpensesViewProps) {
  const { t: tr, locale } = useLocalization();
  const { formatCurrency, formatDateWithYear } = localizedFormats(locale);
  const money = (n: number) => formatCurrency(n, currency);
  const { data, isLoading, isError, refetch } = useHouseholdExpensesQuery(householdId);
  const group = useHouseholdsQuery().data?.find((g) => g.id === householdId);
  const [editing, setEditing] = React.useState<HouseholdExpenseEntry | null>(null);
  const [adding, setAdding] = React.useState(false);

  if (isError) return <LoadError message={tr("Impossibile caricare le spese del gruppo")} onRetry={() => refetch()} />;
  if (isLoading || !data) return <div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />;

  const open = data.expenses.filter((e) => !e.settled);
  const settled = data.expenses.filter((e) => e.settled);

  const row = (entry: HouseholdExpenseEntry) => {
    const body = (
      <>
        <CategoryAvatar color={(entry.category?.color ?? "slate") as CategoryColor} icon={(entry.category?.icon ?? "package") as CategoryIcon} size={18} className="size-10" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{entry.description}</span>
          <span className="block truncate text-sm text-text-2">{whoLine(entry, data.members, tr)}</span>
        </span>
        <span className="flex flex-col items-end">
          <span className="font-heading font-semibold tabular-nums">{money(entry.amount)}</span>
          <span className={cn("text-xs tabular-nums", entry.mine > 0 ? "text-pos" : entry.mine < 0 ? "text-neg" : "text-text-3")}>
            {mineLine(entry, data.members, money, tr)}
          </span>
        </span>
      </>
    );
    return (
      <li key={entry.id}>
        {entry.editable ? (
          <button type="button" onClick={() => setEditing(entry)} className="flex min-h-16 w-full items-center gap-3.5 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-foreground/[0.04]">
            {body}
          </button>
        ) : (
          <div className="flex min-h-16 items-center gap-3.5 px-2 py-2">{body}</div>
        )}
      </li>
    );
  };

  const byDay = (entries: HouseholdExpenseEntry[]) => {
    const days = new Map<string, HouseholdExpenseEntry[]>();
    for (const e of entries) days.set(e.date, [...(days.get(e.date) ?? []), e]);
    return [...days].map(([day, rows]) => (
      <section key={day} className="flex flex-col gap-1">
        <h2 className="px-2 text-sm font-medium text-text-2">{formatDateWithYear(day)}</h2>
        <ul className="flex flex-col">{rows.map(row)}</ul>
      </section>
    ));
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className={PAGE_TITLE}>{group ? tr("Spese di «{0}»", { 0: group.name }) : tr("Spese del gruppo")}</h1>
        <p className="text-text-2">{tr("Quelle che contano tra voi: le spese segnate «in comune» dai vostri conti e quelle aggiunte qui. Tocca una spesa aggiunta qui per cambiarla.")}</p>
        <Button variant="sun" className="h-11 w-fit gap-2 rounded-full px-5" onClick={() => setAdding(true)}>
          <PlusIcon className="size-4" aria-hidden="true" />
          {tr("Aggiungi una spesa")}
        </Button>
      </header>

      {data.expenses.length === 0 ? (
        <p className="text-text-2">{tr("Ancora nessuna spesa da dividere.")}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {open.length > 0 ? byDay(open) : <p className="px-2 text-text-2">{tr("Niente di nuovo dall'ultimo pareggio.")}</p>}
          {settled.length > 0 ? (
            <div className="flex flex-col gap-6 opacity-60">
              <p className="px-2 text-sm font-semibold text-text-2">
                {data.lastSettledAt ? tr("Pareggiate il {0}", { 0: formatDateWithYear(data.lastSettledAt.slice(0, 10)) }) : tr("Già pareggiate")}
              </p>
              {byDay(settled)}
            </div>
          ) : null}
        </div>
      )}

      <GroupExpenseDialog open={adding} onOpenChange={setAdding} householdId={householdId} members={data.members} currency={currency} expense={null} />
      <GroupExpenseDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} householdId={householdId} members={data.members} currency={currency} expense={editing} />
    </div>
  );
}
