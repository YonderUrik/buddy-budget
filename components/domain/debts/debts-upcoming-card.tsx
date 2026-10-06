"use client";

/** Prossime rate dei finanziamenti con il pulsante per segnarle pagate senza entrare nel debito; una rata scaduta è evidenziata. */

import * as React from "react";
import { CheckIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LoanPlanRow } from "@/lib/calc/debt-plan";
import { todayIso } from "@/lib/debts/dates";
import { findDueRow } from "@/lib/debts/overview-insights";
import type { DebtDueItem, DebtView } from "@/lib/debts/view";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PayInstallmentDialog } from "./pay-installment-dialog";

export interface DebtsUpcomingCardProps {
  items: DebtDueItem[];
  debts: DebtView[];
  currency: string;
}

const MONTH_ABBR = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const MS_PER_DAY = 86_400_000;

/** Giorni da `today` a `date` (negativi se passata). */
export function daysBetween(today: string, date: string): number {
  return Math.round((Date.parse(date) - Date.parse(today)) / MS_PER_DAY);
}

/** "oggi", "domani", "tra 12 giorni", "scaduta da 3 giorni". */
export function dueText(days: number): string {
  if (days === 0) return "oggi";
  if (days === 1) return "domani";
  if (days > 1) return `tra ${days} giorni`;
  return days === -1 ? "scaduta ieri" : `scaduta da ${-days} giorni`;
}

export function DebtsUpcomingCard({ items, debts, currency }: DebtsUpcomingCardProps) {
  const [pay, setPay] = React.useState<{ debtId: string; row: LoanPlanRow } | null>(null);
  if (items.length === 0) return null;
  const today = todayIso();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prossime rate</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {items.map((item, index) => {
            const [, month, day] = item.date.split("-").map(Number);
            const days = daysBetween(today, item.date);
            const debt = debts.find((d) => d.id === item.debtId);
            const row = debt ? findDueRow(debt, item.date) : undefined;
            return (
              <li key={`${item.debtId}-${item.date}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className={cn("flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-muted leading-tight", index === 0 && !item.overdue && "bg-primary/10 text-primary", item.overdue && "bg-neg-soft text-neg")}>
                  <span className="font-heading text-base font-medium">{day}</span>
                  <span className="text-[11px] font-semibold">{MONTH_ABBR[month - 1]}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                  <p className={cn("text-xs", item.overdue ? "text-neg" : "text-muted-foreground")}>{dueText(days)}</p>
                </div>
                <p className="font-heading text-base font-medium tabular-nums text-foreground">{formatCurrency(item.amount, currency)}</p>
                <button
                  type="button"
                  disabled={!row}
                  onClick={() => row && setPay({ debtId: item.debtId, row })}
                  aria-label={`Segna pagata la rata di ${item.name}`}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-border text-transparent transition-colors hover:border-primary hover:text-primary focus-visible:border-primary focus-visible:text-primary disabled:opacity-40"
                >
                  <CheckIcon size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
      <PayInstallmentDialog debtId={pay?.debtId ?? ""} row={pay?.row ?? null} currency={currency} onOpenChange={(open) => !open && setPay(null)} />
    </Card>
  );
}
