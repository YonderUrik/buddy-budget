"use client";

/** Movimenti · Elenco: riepilogo del periodo e lista delle transazioni, con filtri categoria/testo e tipo (Tutte/Uscite/Entrate). */

import * as React from "react";
import {
  ExpensesFilterBar,
  TransactionRow,
  TransactionsPeriodSummary,
  TransactionsTypeToggle,
  UncategorizedCallout,
} from "@/components/domain/expenses";
import { movementsFetchWindow, useMovements } from "@/components/domain/movements";
import { LoadError } from "@/components/domain/shared";
import { Card } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";
import {
  computeIncomeSummary,
  computeSummary,
  filterByTransactionType,
  filterTransactions,
  getPeriodRange,
  isExpense,
  isIncome,
  type TransactionDirection,
} from "@/lib/calc/expenses";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { useTransactionsQuery } from "@/lib/queries/transactions";

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function MovimentiElencoPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const { period, referenceDate, categoryFilter, setCategoryFilter, searchText, setSearchText } = useMovements();
  const [showUncategorizedOnly, setShowUncategorizedOnly] = React.useState(false);
  const [listTypeFilter, setListTypeFilter] = React.useState<TransactionDirection>("tutte");

  const { from, to } = movementsFetchWindow(referenceDate);
  const { data: transactions, isLoading, isError, refetch } = useTransactionsQuery(from, to, "tutte");
  const { data: categories } = useCategoriesQuery();
  const safeCategories = categories ?? [];

  const filtered = filterTransactions(transactions ?? [], { categoryId: categoryFilter, searchText });
  const range = getPeriodRange(period, referenceDate);
  const fallbackCategoryIds = new Set(safeCategories.filter((c) => c.isFallback).map((c) => c.id));
  const isUncategorized = (categoryId: string | null) => categoryId !== null && fallbackCategoryIds.has(categoryId);

  const inPeriod = filterByTransactionType(filtered, listTypeFilter).filter(
    (t) => t.date >= toDateString(range.from) && t.date <= toDateString(range.to)
  );
  const uncategorizedCount = inPeriod.filter((t) => isUncategorized(t.categoryId)).length;
  const visible = showUncategorizedOnly ? inPeriod.filter((t) => isUncategorized(t.categoryId)) : inPeriod;
  const hasActiveFilter = categoryFilter !== null || searchText.trim() !== "";

  return (
    <>
      <ExpensesFilterBar
        categories={safeCategories}
        categoryId={categoryFilter}
        onCategoryChange={(categoryId) => {
          setCategoryFilter(categoryId);
          setShowUncategorizedOnly(false);
        }}
        searchText={searchText}
        onSearchTextChange={setSearchText}
      />

      {isLoading ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <LoadError message="Impossibile caricare le transazioni." onRetry={() => refetch()} />
      ) : (
        <>
          {uncategorizedCount > 0 && (
            <UncategorizedCallout
              count={uncategorizedCount}
              filterActive={showUncategorizedOnly}
              onToggleFilter={() => setShowUncategorizedOnly((v) => !v)}
            />
          )}

          <Card className="gap-0 p-0">
            <div className="border-b border-border px-4 py-3">
              <TransactionsTypeToggle value={listTypeFilter} onChange={setListTypeFilter} stretch className="sm:w-fit" />
            </div>
            <TransactionsPeriodSummary
              expenses={computeSummary(filtered.filter(isExpense), range)}
              income={computeIncomeSummary(filtered.filter(isIncome), range)}
              currency={currency}
            />
            {visible.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                {showUncategorizedOnly
                  ? "Nessuna transazione da categorizzare in questo periodo."
                  : hasActiveFilter
                    ? "Nessuna transazione corrisponde ai filtri applicati in questo periodo."
                    : "Nessuna transazione in questo periodo. Registrane una con “Aggiungi”."}
              </p>
            ) : (
              visible.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} categories={safeCategories} currency={currency} />
              ))
            )}
          </Card>
        </>
      )}
    </>
  );
}
