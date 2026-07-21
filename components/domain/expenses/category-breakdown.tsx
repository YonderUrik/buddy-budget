"use client";

/**
 * Blocco "Per categoria": importo speso e budget mensile editabile inline, per ciascuna categoria dell'utente.
 * Il salvataggio avviene on-blur; mentre è in corso l'input della riga interessata è disabilitato, e in caso di
 * errore viene mostrato un messaggio sotto l'input (convenzione `text-sm text-destructive` usata anche in
 * `add-account-form.tsx`). Un valore non valido (vuoto, non numerico o negativo) non viene inviato: l'input torna
 * a mostrare l'ultimo budget noto invece di restare bloccato sul testo non valido.
 */

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { useUpsertBudgetMutation } from "@/lib/queries/budgets";
import type { CategoryAmount } from "@/lib/calc/expenses";
import type { Budget } from "@/lib/db/schema/budgets";
import { CategoryAvatar } from "@/components/domain/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";

export interface CategoryBreakdownProps {
  categoryAmounts: CategoryAmount[];
  budgets: Budget[];
  currency: string;
}

export function CategoryBreakdown({ categoryAmounts, budgets, currency }: CategoryBreakdownProps) {
  const upsertMutation = useUpsertBudgetMutation();
  const [pendingCategoryId, setPendingCategoryId] = React.useState<string | null>(null);
  const [errorCategoryId, setErrorCategoryId] = React.useState<string | null>(null);

  function budgetFor(categoryId: string): number {
    const budget = budgets.find((b) => b.categoryId === categoryId);
    return budget ? Number(budget.monthlyAmount) : 0;
  }

  /** Valida e invia il nuovo budget per una categoria. Ritorna false se il valore non è valido (nessuna mutation inviata). */
  function commitBudget(categoryId: string, raw: string): boolean {
    const normalized = raw.trim().replace(",", ".");
    const value = Number(normalized);
    if (normalized === "" || !Number.isFinite(value) || value < 0) return false;
    if (value === budgetFor(categoryId)) return true;

    setErrorCategoryId((prev) => (prev === categoryId ? null : prev));
    setPendingCategoryId(categoryId);
    upsertMutation.mutate(
      { categoryId, input: { monthlyAmount: value } },
      {
        onError: () => setErrorCategoryId(categoryId),
        onSuccess: () => setErrorCategoryId((prev) => (prev === categoryId ? null : prev)),
        onSettled: () => setPendingCategoryId((prev) => (prev === categoryId ? null : prev)),
      }
    );
    return true;
  }

  return (
    <Card className="divide-y divide-border p-0">
      {categoryAmounts.map((entry) => (
        <CategoryBreakdownRow
          key={entry.categoryId}
          entry={entry}
          budgetAmount={budgetFor(entry.categoryId)}
          currency={currency}
          isSaving={pendingCategoryId === entry.categoryId}
          hasError={errorCategoryId === entry.categoryId}
          onCommitBudget={(raw) => commitBudget(entry.categoryId, raw)}
        />
      ))}
    </Card>
  );
}

interface CategoryBreakdownRowProps {
  entry: CategoryAmount;
  budgetAmount: number;
  currency: string;
  /** True mentre il budget di questa categoria è in salvataggio. */
  isSaving: boolean;
  /** True se l'ultimo tentativo di salvataggio per questa categoria è fallito. */
  hasError: boolean;
  /** Valida e invia il nuovo valore; ritorna false se non valido (l'input va ripristinato). */
  onCommitBudget: (raw: string) => boolean;
}

function CategoryBreakdownRow({
  entry,
  budgetAmount,
  currency,
  isSaving,
  hasError,
  onCommitBudget,
}: CategoryBreakdownRowProps) {
  const [budgetInput, setBudgetInput] = React.useState(String(budgetAmount));

  React.useEffect(() => {
    setBudgetInput(String(budgetAmount));
  }, [budgetAmount]);

  function handleBlur() {
    const isValid = onCommitBudget(budgetInput);
    if (!isValid) {
      setBudgetInput(String(budgetAmount));
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-3">
        <CategoryAvatar
          color={entry.color as CategoryColor}
          icon={entry.icon as CategoryIcon}
          size={14}
          className="size-7"
        />
        <div>
          <p className="text-sm font-medium text-foreground">{entry.name}</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(entry.amount, currency)} speso</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span>Budget</span>
          <Input
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            onBlur={handleBlur}
            disabled={isSaving}
            className="h-7 w-20 text-right text-sm"
            aria-label={`Budget mensile per ${entry.name}`}
          />
        </div>
        {hasError && <p className="text-sm text-destructive">Salvataggio non riuscito</p>}
      </div>
    </div>
  );
}
