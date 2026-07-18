"use client";

/** Blocco "Per categoria": importo speso e budget mensile editabile inline, per ciascuna categoria dell'utente. */

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { useUpsertBudgetMutation } from "@/lib/queries/budgets";
import type { CategoryAmount } from "@/lib/calc/expenses";
import type { Budget } from "@/lib/db/schema/budgets";

export interface CategoryBreakdownProps {
  categoryAmounts: CategoryAmount[];
  budgets: Budget[];
  currency: string;
}

export function CategoryBreakdown({ categoryAmounts, budgets, currency }: CategoryBreakdownProps) {
  const upsertMutation = useUpsertBudgetMutation();

  function budgetFor(categoryId: string): number {
    const budget = budgets.find((b) => b.categoryId === categoryId);
    return budget ? Number(budget.monthlyAmount) : 0;
  }

  function commitBudget(categoryId: string, raw: string) {
    const normalized = raw.trim().replace(",", ".");
    const value = Number(normalized);
    if (normalized === "" || !Number.isFinite(value) || value < 0) return;
    if (value === budgetFor(categoryId)) return;
    upsertMutation.mutate({ categoryId, input: { monthlyAmount: value } });
  }

  return (
    <Card className="divide-y divide-border p-0">
      {categoryAmounts.map((entry) => (
        <CategoryBreakdownRow
          key={entry.categoryId}
          entry={entry}
          budgetAmount={budgetFor(entry.categoryId)}
          currency={currency}
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
  onCommitBudget: (raw: string) => void;
}

function CategoryBreakdownRow({ entry, budgetAmount, currency, onCommitBudget }: CategoryBreakdownRowProps) {
  const [budgetInput, setBudgetInput] = React.useState(String(budgetAmount));

  React.useEffect(() => {
    setBudgetInput(String(budgetAmount));
  }, [budgetAmount]);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{entry.name}</p>
        <p className="text-xs text-muted-foreground">{formatCurrency(entry.amount, currency)} speso</p>
      </div>
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <span>Budget</span>
        <Input
          value={budgetInput}
          onChange={(e) => setBudgetInput(e.target.value)}
          onBlur={() => onCommitBudget(budgetInput)}
          className="h-7 w-20 text-right text-sm"
          aria-label={`Budget mensile per ${entry.name}`}
        />
      </div>
    </div>
  );
}
