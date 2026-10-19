"use client";

/**
 * Monthly budget of an expense category, inside the category's detail window: saved on blur (or Enter),
 * emptied to remove it. Panoramica, Analisi and the budget alert emails read the same value.
 */

import * as React from "react";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { useLocalization } from "@/lib/localization/provider";
import { parseLocaleNumber } from "@/lib/localization/format";
import { useBudgetsQuery, useRemoveBudgetMutation, useUpsertBudgetMutation } from "@/lib/queries/budgets";
import { getCurrencySymbol } from "@/lib/format";

export interface CategoryBudgetFieldProps {
  categoryId: string;
  categoryName: string;
}

/** Amount as the user would type it in `locale` (no grouping, at most two decimals); empty when there is no budget. */
function toInputText(amount: number | null, locale: string): string {
  if (amount === null) return "";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: false }).format(amount);
}

function currencySymbol(currency: string, locale: string): string {
  return getCurrencySymbol(currency, locale) || currency;
}

export function CategoryBudgetField({ categoryId, categoryName }: CategoryBudgetFieldProps) {
  const { t: tr, locale } = useLocalization();
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const budgetsQuery = useBudgetsQuery();
  const upsertMutation = useUpsertBudgetMutation();
  const removeMutation = useRemoveBudgetMutation();

  const saved = budgetsQuery.data?.find((b) => b.categoryId === categoryId);
  const savedAmount = saved ? Number(saved.monthlyAmount) : null;
  const [text, setText] = React.useState(() => toInputText(savedAmount, locale));
  const [syncedAmount, setSyncedAmount] = React.useState(savedAmount);
  const [error, setError] = React.useState<string | null>(null);

  // The saved budget changed elsewhere (first load, a save that went through): realign the field.
  if (savedAmount !== syncedAmount) {
    setSyncedAmount(savedAmount);
    setText(toInputText(savedAmount, locale));
  }

  function commit() {
    const trimmed = text.trim();
    if (trimmed === "") {
      if (savedAmount === null) return;
      setError(null);
      removeMutation.mutate(categoryId, { onError: () => { setError(tr("Non è stato possibile togliere il budget, riprova.")); setText(toInputText(savedAmount, locale)); } });
      return;
    }
    const value = parseLocaleNumber(trimmed, locale);
    if (value === null || value < 0) {
      setError(tr("Scrivi un importo, per esempio 300."));
      return;
    }
    const rounded = Math.round(value * 100) / 100;
    if (rounded === savedAmount) return setText(toInputText(savedAmount, locale));
    setError(null);
    upsertMutation.mutate(
      { categoryId, input: { monthlyAmount: rounded } },
      { onError: () => { setError(tr("Non è stato possibile salvare il budget, riprova.")); setText(toInputText(savedAmount, locale)); } }
    );
  }

  const saving = upsertMutation.isPending || removeMutation.isPending;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="category-budget" className="text-xs font-medium text-muted-foreground">{tr("Budget al mese (facoltativo)")}</label>
      <div className="relative max-w-48">
        <Input
          id="category-budget"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          placeholder={tr("Nessun budget")}
          disabled={budgetsQuery.isPending}
          aria-busy={saving}
          aria-invalid={error !== null}
          aria-describedby="category-budget-hint"
          aria-label={tr("Budget mensile per {0}", { 0: categoryName })}
          onChange={(event) => { setText(event.target.value); setError(null); }}
          onBlur={commit}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
          className="pr-10 tabular-nums"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-text-3" aria-hidden="true">
          {currencySymbol(currency, locale)}
        </span>
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">{error}</p>
      ) : (
        <p id="category-budget-hint" className="text-xs text-text-3">
          {tr("Lascia vuoto per non avere un tetto. Lo vedi in Panoramica e in Analisi, e negli avvisi email se li hai accesi.")}
        </p>
      )}
    </div>
  );
}
