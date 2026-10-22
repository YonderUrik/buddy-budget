"use client";

/**
 * A category's budget, opened from Liquidità · Budget (a bottom sheet on the phone): the amount that repeats every
 * month, «Porta l'avanzo al mese dopo», a different amount for the month on screen only, and its last three months.
 * Every field saves by itself; a category without a budget only shows the amount, and saving it creates one.
 */

import * as React from "react";
import { CategoryAvatar } from "@/components/domain/categories";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { GROUP_DISPLAY, type CategoryGroupKey } from "@/lib/categories/groups";
import { getCurrencySymbol } from "@/lib/format";
import { localizedFormats, parseLocaleNumber } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import { useRemoveBudgetMutation, useUpsertBudgetMutation } from "@/lib/queries/budgets";
import { cn } from "@/lib/utils";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import type { BudgetCategory } from "./budget-category-row";

/** What the sheet is about: a budgeted category, or one without a budget yet. */
export type BudgetSheetTarget =
  | { kind: "budget"; category: BudgetCategory }
  | { kind: "new"; category: { categoryId: string; name: string; group: CategoryGroupKey; color: string; icon: string } };

export interface BudgetSheetProps {
  target: BudgetSheetTarget | null;
  currency: string;
  /** `YYYY-MM` on screen; the single-month amount applies to it. */
  month: string;
  /** The month on screen is already over: no single-month amount. */
  past: boolean;
  onClose: () => void;
}

function toText(amount: number | null, locale: string): string {
  return amount === null ? "" : new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: false }).format(amount);
}

/** Amount field that saves on blur (or Enter); empty means «none» when `allowEmpty`. */
function AmountField({ id, label, value, currency, allowEmpty, onCommit, hint }: { id: string; label: string; value: number | null; currency: string; allowEmpty: boolean; onCommit: (value: number | null) => void; hint?: string }) {
  const { t: tr, locale } = useLocalization();
  const [text, setText] = React.useState(() => toText(value, locale));
  const [synced, setSynced] = React.useState(value);
  const [error, setError] = React.useState<string | null>(null);
  if (value !== synced) {
    setSynced(value);
    setText(toText(value, locale));
  }
  function commit() {
    const trimmed = text.trim();
    if (trimmed === "") {
      if (allowEmpty && value !== null) onCommit(null);
      else setText(toText(value, locale));
      return;
    }
    const parsed = parseLocaleNumber(trimmed, locale);
    if (parsed === null || parsed < 0) return setError(tr("Scrivi un importo, per esempio 300."));
    const rounded = Math.round(parsed * 100) / 100;
    setError(null);
    if (rounded !== value) onCommit(rounded);
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-text-2">{label}</label>
      <div className="relative max-w-48">
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          aria-invalid={error !== null}
          onChange={(event) => { setText(event.target.value); setError(null); }}
          onBlur={commit}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
          className="pr-10 tabular-nums"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-text-3" aria-hidden="true">{getCurrencySymbol(currency, locale) || currency}</span>
      </div>
      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : hint ? <p className="text-xs text-text-3">{hint}</p> : null}
    </div>
  );
}

function SwitchRow({ id, title, hint, checked, onChange }: { id: string; title: string; hint: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="mt-0.5 block text-sm text-text-3">{hint}</span>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-1" />
    </div>
  );
}

export function BudgetSheet({ target, currency, month, past, onClose }: BudgetSheetProps) {
  const { t: tr, locale } = useLocalization();
  const { formatCurrency } = localizedFormats(locale);
  const money = (n: number) => formatCurrency(n, currency, { maximumFractionDigits: 0 });
  const upsert = useUpsertBudgetMutation();
  const remove = useRemoveBudgetMutation();
  const [error, setError] = React.useState<string | null>(null);
  const [y, m] = month.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(y, m - 1, 1));
  const monthLabel = (key: string) => {
    const [ky, km] = key.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(ky, km - 1, 1));
  };
  const save = (input: Parameters<typeof upsert.mutate>[0]["input"]) => {
    if (!target) return;
    setError(null);
    upsert.mutate({ categoryId: target.category.categoryId, input }, { onError: () => setError(tr("Non è stato possibile salvare il budget, riprova.")) });
  };

  const budget = target?.kind === "budget" ? target.category : null;
  const [singleOn, setSingleOn] = React.useState(false);
  const singleVisible = singleOn || (budget?.singleMonth ?? false);

  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open) { setSingleOn(false); setError(null); onClose(); } }}>
      <DialogContent>
        {target && (
          <div className="flex flex-col gap-6">
            <DialogHeader className="flex-row items-center gap-3 text-left">
              <CategoryAvatar color={target.category.color as CategoryColor} icon={target.category.icon as CategoryIcon} size={18} className="size-11" />
              <div>
                <DialogTitle>{target.category.name}</DialogTitle>
                <DialogDescription>{tr(GROUP_DISPLAY[target.category.group].label)}</DialogDescription>
              </div>
            </DialogHeader>
            <AmountField
              id="budget-amount"
              label={tr("Budget al mese")}
              value={budget ? budget.monthlyAmount : null}
              currency={currency}
              allowEmpty={false}
              hint={budget ? tr("Vale da questo mese in poi: i mesi passati tengono la loro cifra.") : tr("Si ripete ogni mese, finché non lo cambi.")}
              onCommit={(value) => value !== null && save({ monthlyAmount: value })}
            />
            {budget && (
              <>
                <SwitchRow
                  id="budget-rollover"
                  title={tr("Porta l'avanzo al mese dopo")}
                  hint={tr("Quello che non spendi resta qui per i mesi dopo; se sfori, il mese dopo parti da meno. Utile per spese che non arrivano ogni mese.")}
                  checked={budget.rollover}
                  onChange={(checked) => save({ rollover: checked })}
                />
                {!past && (
                  <div className="flex flex-col gap-3">
                    <SwitchRow
                      id="budget-single"
                      title={tr("Cifra diversa solo a {0}", { 0: monthName })}
                      hint={tr("Per un mese che sai già più caro (o più leggero). Il mese dopo torna a {0}.", { 0: money(budget.monthlyAmount) })}
                      checked={singleVisible}
                      onChange={(checked) => {
                        setSingleOn(checked);
                        if (!checked && budget.singleMonth) save({ singleMonth: { month, amount: null } });
                      }}
                    />
                    {singleVisible && (
                      <AmountField
                        id="budget-single-amount"
                        label={tr("Budget di {0}", { 0: monthName })}
                        value={budget.singleMonth ? budget.amount : null}
                        currency={currency}
                        allowEmpty
                        onCommit={(value) => save({ singleMonth: { month, amount: value } })}
                      />
                    )}
                  </div>
                )}
                <section aria-label={tr("Ultimi mesi")}>
                  <h3 className="font-display text-2xl">{tr("Ultimi mesi")}</h3>
                  <ul className="mt-2 flex flex-col gap-2">
                    {budget.history.map((h) => (
                      <li key={h.month} className="flex items-baseline justify-between gap-3">
                        <span className="first-letter:uppercase">{monthLabel(h.month)}</span>
                        <span className="text-right text-sm tabular-nums">
                          <span className={cn(h.spent > h.amount ? "text-neg" : "text-text-2")}>{tr("spesi {0} su {1}", { 0: money(h.spent), 1: money(h.amount) })}</span>
                          {h.carriedOut !== null && Math.abs(h.carriedOut) >= 0.5 && (
                            <span className={cn("block text-xs", h.carriedOut > 0 ? "text-pos" : "text-neg")}>
                              {h.carriedOut > 0 ? tr("+{0} messi da parte", { 0: money(h.carriedOut) }) : tr("−{0} sul mese dopo", { 0: money(-h.carriedOut) })}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
                <Button
                  variant="destructive"
                  className="h-11 self-start rounded-full px-5"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(budget.categoryId, { onSuccess: onClose, onError: () => setError(tr("Non è stato possibile togliere il budget, riprova.")) })}
                >
                  {tr("Togli il budget")}
                </Button>
              </>
            )}
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
