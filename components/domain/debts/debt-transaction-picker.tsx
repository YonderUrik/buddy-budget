"use client";

/**
 * Scelta facoltativa della transazione che corrisponde a una rata: mostra le uscite vicine alla scadenza, filtrabili per
 * testo e categoria, con in cima quelle dall'importo atteso. Non collega mai niente da sola: se non scegli nulla la rata
 * si segna senza transazione.
 */

import * as React from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { ExpensesFilterBar } from "@/components/domain/expenses";
import { CategoryAvatar } from "@/components/domain/categories";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { addDaysIso } from "@/lib/debts/dates";
import { describeFilterUsage, rankInstallmentCandidates } from "@/lib/debts/transaction-candidates";
import type { Transaction } from "@/lib/db/schema/transactions";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { useTransactionsQuery } from "@/lib/queries/transactions";
import { cn } from "@/lib/utils";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";

/** Giorni prima e dopo la scadenza in cui cercare la transazione. */
export const TRANSACTION_SEARCH_WINDOW_DAYS = 20;
const LIST_MAX_HEIGHT_CLASS = "max-h-56";

export interface DebtTransactionPickerProps {
  /** Scadenza della rata (ISO): centro dell'intervallo di ricerca. */
  dueDate: string;
  /** Importo atteso della rata: le transazioni con lo stesso importo salgono in cima. */
  expectedAmount: number;
  value: string | null;
  onChange: (transactionId: string | null) => void;
  currency: string;
}

export function DebtTransactionPicker({ dueDate, expectedAmount, value, onChange, currency }: DebtTransactionPickerProps) {
  const query = useTransactionsQuery(
    addDaysIso(dueDate, -TRANSACTION_SEARCH_WINDOW_DAYS),
    addDaysIso(dueDate, TRANSACTION_SEARCH_WINDOW_DAYS),
    "uscita"
  );
  const categoriesQuery = useCategoriesQuery();
  const categories = categoriesQuery.data ?? [];
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [searchText, setSearchText] = React.useState("");

  const all = query.data ?? [];
  const visible = rankInstallmentCandidates(all, { categoryId, searchText }, dueDate, expectedAmount);
  const selected = all.find((t) => t.id === value) ?? null;

  function select(transaction: Transaction) {
    track("debt_installment_transaction_linked", { filter: describeFilterUsage({ categoryId, searchText }) });
    onChange(transaction.id);
  }

  function renderRow(t: Transaction) {
    const category = categories.find((c) => c.id === t.categoryId);
    const isSelected = t.id === value;
    return (
      <li key={t.id}>
        <button
          type="button"
          role="radio"
          aria-checked={isSelected}
          onClick={() => (isSelected ? onChange(null) : select(t))}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
            isSelected && "bg-primary/10"
          )}
        >
          {category ? (
            <CategoryAvatar color={category.color as CategoryColor} icon={category.icon as CategoryIcon} size={10} className="size-5 shrink-0" />
          ) : null}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate">{t.description}</span>
            <span className="text-xs text-text-2">{formatShortDate(t.date)}</span>
          </span>
          <span className="shrink-0 font-heading tabular-nums">{formatCurrency(Math.abs(Number(t.amount)), currency)}</span>
          {isSelected ? <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden /> : null}
        </button>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ExpensesFilterBar
        categories={categories}
        categoryId={categoryId}
        onCategoryChange={setCategoryId}
        searchText={searchText}
        onSearchTextChange={setSearchText}
      />
      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-2 py-1 text-sm">
          <span className="truncate">
            Collegata: {selected.description} · {formatCurrency(Math.abs(Number(selected.amount)), currency)}
          </span>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Scollega la transazione" onClick={() => onChange(null)}>
            <XIcon aria-hidden />
          </Button>
        </div>
      ) : null}
      <ul role="radiogroup" aria-label="Transazione collegata" className={cn("flex flex-col overflow-y-auto rounded-md border", LIST_MAX_HEIGHT_CLASS)}>
        {query.isPending ? (
          <li className="px-2 py-3 text-sm text-text-2">Cerco le transazioni…</li>
        ) : visible.length === 0 ? (
          <li className="px-2 py-3 text-sm text-text-2">
            {all.length === 0 ? "Nessuna uscita vicina alla scadenza." : "Nessuna transazione corrisponde ai filtri."}
          </li>
        ) : (
          visible.map(renderRow)
        )}
      </ul>
    </div>
  );
}
