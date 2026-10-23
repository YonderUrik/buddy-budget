"use client";

/** «Tra voi»: who owes whom in the group, what each paid since the last time you evened out, and «Pareggiate». */

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { HouseholdOverview } from "@/lib/households/types";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import { useSettleHouseholdMutation } from "@/lib/queries/households";
import { balanceHeadline, transferLine } from "./balance-text";
import { SettleDialog } from "./confirm-dialogs";
import { PersonAvatar } from "./person-avatar";

export interface HouseholdBalanceCardProps {
  overview: HouseholdOverview;
  currency: string;
}

export function HouseholdBalanceCard({ overview, currency }: HouseholdBalanceCardProps) {
  const { t: tr, locale } = useLocalization();
  const { formatCurrency } = localizedFormats(locale);
  const money = (n: number) => formatCurrency(n, currency);
  const settle = useSettleHouseholdMutation(overview.id);
  const [open, setOpen] = React.useState(false);
  const { balance, members } = overview;
  const even = balance.transfers.length === 0;
  const lines = balance.transfers.map((t) => transferLine(t, members, money, tr));
  const headline = balanceHeadline(balance.mine, balance.transfers, members, money, tr);
  /** The passages under the headline, without the one it already says. */
  const others = balance.transfers.map((t, i) => ({ t, line: lines[i] })).filter((x) => x.line !== headline);
  const paid = balance.paid.filter((p) => p.amount > 0);

  async function confirm() {
    await settle.mutateAsync();
    setOpen(false);
    toast.success(tr("Pareggiato: si riparte da zero"));
  }

  return (
    <section aria-labelledby="household-balance" className="flex flex-col gap-4 rounded-3xl bg-foreground/[0.05] p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id="household-balance" className="text-base font-medium text-text-2">{tr("Tra voi")}</h2>
        <p className="font-heading text-2xl font-semibold tabular-nums sm:text-3xl">{headline}</p>
        {balance.expenseCount > 0 ? (
          <p className="text-sm text-text-2">
            {balance.expenseCount === 1 ? tr("1 spesa in comune dall'ultimo pareggio") : tr("{0} spese in comune dall'ultimo pareggio", { 0: balance.expenseCount })}
            {paid.length > 0
              ? `: ${paid
                  .map((p) => {
                    const who = members.find((m) => m.id === p.memberId);
                    return `${who?.isMe ? tr("tu") : who?.name} ${money(p.amount)}`;
                  })
                  .join(", ")}`
              : ""}
          </p>
        ) : (
          <p className="text-sm text-text-2">{tr("Aggiungi una spesa qui, o apri una spesa del tuo conto e scegli «In comune con»: l'app tiene il conto.")}</p>
        )}
      </div>
      {members.length > 2 && others.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {others.map(({ t, line }) => {
            const from = members.find((m) => m.id === t.from);
            return (
              <li key={`${t.from}-${t.to}`} className="flex items-center gap-3">
                {from ? <PersonAvatar initial={from.initial} slot={from.slot} name={from.name} size="sm" /> : null}
                <span className="flex-1">{line}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {even ? null : (
        <Button variant="outline" className="h-11 w-fit rounded-full bg-card px-5" onClick={() => setOpen(true)}>
          {tr("Pareggiate")}
        </Button>
      )}
      <SettleDialog open={open} onOpenChange={setOpen} lines={lines} pending={settle.isPending} onConfirm={confirm} />
    </section>
  );
}
