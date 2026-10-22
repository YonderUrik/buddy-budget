"use client";

/**
 * Opening of Liquidità · Budget: what can still be spent this month within the budgets (or how it went, for a past
 * month), the money per day, the bar with today's tick, and the month's plan: usual income, budgets, what is left over.
 */

import { MoneyHero } from "@/components/domain/net-worth";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import type { BudgetMonthView } from "@/lib/views/budget-month";
import { BudgetBar } from "./budget-bar";

export interface BudgetHeroProps {
  view: BudgetMonthView;
}

export function BudgetHero({ view }: BudgetHeroProps) {
  const { t: tr, locale } = useLocalization();
  const { formatCurrency } = localizedFormats(locale);
  const money = (n: number) => formatCurrency(n, view.currency, { maximumFractionDigits: 0 });
  const { total, income } = view;
  const over = total.left < 0;
  const headline = view.when === "past" ? (over ? tr("Sei andato oltre i budget di") : tr("Ti sono avanzati")) : over ? tr("Sei oltre i budget di") : tr("Puoi ancora spendere");
  const leftOver = income ? income.amount - total.available : null;
  return (
    <section aria-label={tr("Il mese in breve")} className="rounded-3xl bg-card p-5 sm:p-6">
      <p className="text-text-2">{headline}</p>
      <MoneyHero value={Math.abs(total.left)} currency={view.currency} className={over ? "text-5xl leading-none tracking-tight text-neg sm:text-6xl" : "text-5xl leading-none tracking-tight sm:text-6xl"} />
      {total.perDay !== null && view.daysLeft !== null && (
        <p className="mt-2 text-text-2">
          {view.daysLeft === 1
            ? tr("{0} per oggi, l'ultimo giorno del mese", { 0: money(total.perDay) })
            : tr("circa {0} al giorno fino a fine mese ({1} giorni)", { 0: money(total.perDay), 1: view.daysLeft })}
        </p>
      )}
      <BudgetBar
        className="mt-4"
        spent={total.spent}
        available={total.available}
        expectedShare={view.expectedShare}
        label={tr("Budget usato: {0}% di {1}", { 0: total.available > 0 ? Math.round((total.spent / total.available) * 100) : 0, 1: money(total.available) })}
      />
      <p className="mt-2 text-sm text-text-3">
        {tr("Spesi {0} su {1}.", { 0: money(total.spent), 1: money(total.available) })}
        {view.expectedShare !== null && !over ? ` ${tr("La tacca è dove dovresti essere oggi.")}` : ""}
      </p>
      {income && leftOver !== null && (
        <dl className="mt-5 grid grid-cols-3 gap-3">
          <div>
            <dt className="text-xs text-text-3">{income.kind === "usual" ? tr("Entrate di solito") : tr("Entrate")}</dt>
            <dd className="font-heading font-semibold tabular-nums">{money(income.amount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-3">{tr("Budget")}</dt>
            <dd className="font-heading font-semibold tabular-nums">{money(total.available)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-3">{leftOver >= 0 ? tr("Ti avanzano") : tr("Ti mancano")}</dt>
            <dd className="font-heading font-semibold tabular-nums" style={{ color: leftOver >= 0 ? "var(--pos)" : "var(--neg)" }}>{money(Math.abs(leftOver))}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
