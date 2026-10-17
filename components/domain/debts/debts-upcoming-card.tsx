"use client";
import { localizedFormats } from "@/lib/localization/format";

import type { Language } from "@/lib/localization/config";
import { translate } from "@/lib/localization/messages";
import { useLocalization } from "@/lib/localization/provider";

/** Prossime rate dei finanziamenti con il pulsante per segnarle pagate senza entrare nel debito; una rata scaduta è evidenziata. */

import * as React from "react";
import { CalendarClockIcon, CheckIcon } from "lucide-react";
import { PanelSection } from "@/components/domain/investments/light";
import type { LoanPlanRow } from "@/lib/calc/debt-plan";
import { todayIso } from "@/lib/debts/dates";
import { findDueRow } from "@/lib/debts/overview-insights";
import type { DebtDueItem, DebtView } from "@/lib/debts/view";

import { cn } from "@/lib/utils";
import { PayInstallmentDialog } from "./pay-installment-dialog";
import { DEBTS_COLORS } from "./debts-theme";

export interface DebtsUpcomingCardProps {
  items: DebtDueItem[];
  debts: DebtView[];
  currency: string;
}

const MS_PER_DAY = 86_400_000;

/** Giorni da `today` a `date` (negativi se passata). */
export function daysBetween(today: string, date: string): number {
  return Math.round((Date.parse(date) - Date.parse(today)) / MS_PER_DAY);
}

/** "oggi", "domani", "tra 12 giorni", "scaduta da 3 giorni", in `language`. */
export function dueText(days: number, language: Language = "it"): string {
  const t = (source: string, values?: Record<string, number>) => translate(language, source, values);
  if (days === 0) return t("oggi");
  if (days === 1) return t("domani");
  if (days > 1) return t("tra {0} giorni", { 0: days });
  return days === -1 ? t("scaduta ieri") : t("scaduta da {0} giorni", { 0: -days });
}

export function DebtsUpcomingCard({ items, debts, currency }: DebtsUpcomingCardProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr, language } = useLocalization();
  const [pay, setPay] = React.useState<{ debtId: string; row: LoanPlanRow } | null>(null);
  if (items.length === 0) return null;
  const today = todayIso();
  return (
    <PanelSection icon={CalendarClockIcon} title={tr("Prossime rate")} color={DEBTS_COLORS.dues}>
      <ul>
          {items.map((item, index) => {
            const [, month, day] = item.date.split("-").map(Number);
            const days = daysBetween(today, item.date);
            const debt = debts.find((d) => d.id === item.debtId);
            const row = debt ? findDueRow(debt, item.date) : undefined;
            return (
              <li key={`${item.debtId}-${item.date}`} className="flex items-center gap-3 border-b py-3 last:border-b-0">
                <span className={cn("flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-muted leading-tight text-muted-foreground", index === 0 && !item.overdue && "border-transparent bg-primary/10 text-primary", item.overdue && "border-transparent bg-neg-soft text-neg")}>
                  <span className="font-heading text-base font-medium">{day}</span>
                  <span className="text-[11px] font-semibold">{new Intl.DateTimeFormat(formattingLocale, { month: "short" }).format(new Date(2000, month - 1, 1)).replace(".", "")}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                  <p className={cn("text-xs", item.overdue ? "text-neg" : "text-muted-foreground")}>{dueText(days, language)}</p>
                </div>
                <p className="font-heading text-base font-medium tabular-nums text-foreground">{formatCurrency(item.amount, currency)}</p>
                <button
                  type="button"
                  disabled={!row}
                  onClick={() => row && setPay({ debtId: item.debtId, row })}
                  aria-label={tr("Segna pagata la rata di {0}", {0: item.name})}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-border text-transparent transition-colors hover:border-primary hover:text-primary focus-visible:border-primary focus-visible:text-primary disabled:opacity-40"
                >
                  <CheckIcon size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
      </ul>
      <PayInstallmentDialog debtId={pay?.debtId ?? ""} row={pay?.row ?? null} currency={currency} onOpenChange={(open) => !open && setPay(null)} />
    </PanelSection>
  );
}
