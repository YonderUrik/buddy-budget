"use client";

/**
 * Budgets the app proposes from the user's own months (median month for Dovute and Volute, a twelfth of the year with
 * rollover for Saltuarie). Every amount can be changed in place; one button creates them all. With no budget yet it
 * opens the page; otherwise it stays one line that opens on tap.
 */

import * as React from "react";
import { CategoryAvatar } from "@/components/domain/categories";
import { SECTION_TITLE } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GROUP_DISPLAY } from "@/lib/categories/groups";
import { getCurrencySymbol } from "@/lib/format";
import { localizedFormats, parseLocaleNumber } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import type { BudgetMonthView } from "@/lib/views/budget-month";

type Proposal = BudgetMonthView["proposals"][number];

export interface AcceptedProposal {
  categoryId: string;
  amount: number;
  rollover: boolean;
  changed: boolean;
}

export interface BudgetProposalsProps {
  proposals: Proposal[];
  currency: string;
  /** Usual income of the month, to show what would be left over with these budgets (plus the ones already set). */
  income: number | null;
  /** Total of the budgets already set this month. */
  alreadyBudgeted: number;
  /** No budget yet: the proposals open the page instead of waiting behind a line. */
  first: boolean;
  pending: boolean;
  onAccept: (items: AcceptedProposal[]) => void;
}

export function BudgetProposals({ proposals, currency, income, alreadyBudgeted, first, pending, onAccept }: BudgetProposalsProps) {
  const { t: tr, locale } = useLocalization();
  const { formatCurrency } = localizedFormats(locale);
  const money = (n: number) => formatCurrency(n, currency, { maximumFractionDigits: 0 });
  const [open, setOpen] = React.useState(first);
  const [texts, setTexts] = React.useState<Record<string, string>>({});
  const amountOf = (p: Proposal) => {
    const text = texts[p.categoryId];
    if (text === undefined) return p.amount;
    const value = parseLocaleNumber(text, locale);
    return value === null || value < 0 ? 0 : Math.round(value * 100) / 100;
  };
  const total = proposals.reduce((sum, p) => sum + amountOf(p), 0) + alreadyBudgeted;
  const groups = ["dovuta", "voluta", "saltuaria"] as const;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-ring">
        <span className="text-text-2">{proposals.length === 1 ? tr("Una categoria ha spese regolari senza budget") : tr("{0} categorie hanno spese regolari senza budget", { 0: proposals.length })}</span>
        <span className="shrink-0 font-semibold text-primary">{tr("Vedi le proposte")}</span>
      </button>
    );
  }

  return (
    <section aria-label={tr("Budget proposti")}>
      <h2 className={SECTION_TITLE}>{first ? tr("I tuoi budget, già pronti") : tr("Budget proposti")}</h2>
      <p className="mt-1 max-w-[60ch] text-text-2">{tr("Li ho calcolati da quanto hai speso negli ultimi mesi. Cambia una cifra se vuoi, poi tocca il bottone.")}</p>
      {groups.map((group) => {
        const items = proposals.filter((p) => p.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group} className="mt-4">
            <p className="text-sm text-text-3">{tr(GROUP_DISPLAY[group].label)}{group === "saltuaria" ? ` · ${tr("l'avanzo resta per i mesi dopo")}` : ""}</p>
            <ul className="mt-1 flex flex-col">
              {items.map((p) => (
                <li key={p.categoryId} className="flex items-center gap-3 py-2">
                  <CategoryAvatar color={p.color as CategoryColor} icon={p.icon as CategoryIcon} size={16} className="size-9" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block text-sm text-text-3">
                      {p.basis.kind === "monthly"
                        ? tr("di solito {0} al mese", { 0: money(p.basis.usual) })
                        : p.basis.months >= 12
                          ? tr("{0} nell'ultimo anno", { 0: money(p.basis.total) })
                          : tr("{0} in {1} mesi", { 0: money(p.basis.total), 1: p.basis.months })}
                    </span>
                  </span>
                  <span className="relative w-28 shrink-0">
                    <Input
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={tr("Budget al mese per {0}", { 0: p.name })}
                      value={texts[p.categoryId] ?? new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: false }).format(p.amount)}
                      onChange={(event) => setTexts((current) => ({ ...current, [p.categoryId]: event.target.value }))}
                      className="pr-8 text-right font-semibold tabular-nums"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-text-3" aria-hidden="true">{getCurrencySymbol(currency, locale) || currency}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {income !== null && (
        <dl className="mt-4 grid grid-cols-3 gap-3 rounded-2xl bg-card p-4">
          <div><dt className="text-xs text-text-3">{tr("Entrate di solito")}</dt><dd className="font-heading font-semibold tabular-nums">{money(income)}</dd></div>
          <div><dt className="text-xs text-text-3">{tr("Budget")}</dt><dd className="font-heading font-semibold tabular-nums">{money(total)}</dd></div>
          <div>
            <dt className="text-xs text-text-3">{income - total >= 0 ? tr("Ti avanzano") : tr("Ti mancano")}</dt>
            <dd className="font-heading font-semibold tabular-nums" style={{ color: income - total >= 0 ? "var(--pos)" : "var(--neg)" }}>{money(Math.abs(income - total))}</dd>
          </div>
        </dl>
      )}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button
          variant="sun"
          className="h-12 rounded-full px-6 text-base"
          disabled={pending}
          onClick={() => onAccept(proposals.filter((p) => amountOf(p) > 0).map((p) => ({ categoryId: p.categoryId, amount: amountOf(p), rollover: p.rollover, changed: amountOf(p) !== p.amount })))}
        >
          {pending ? tr("Salvo…") : tr("Usa questi budget")}
        </Button>
        <Button variant="ghost" className="h-12 rounded-full px-6 text-base" onClick={() => setOpen(false)}>{first ? tr("Li imposto io") : tr("Non ora")}</Button>
      </div>
    </section>
  );
}
