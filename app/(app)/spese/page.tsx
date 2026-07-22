"use client";

/** Pagina Spese: orchestra periodo selezionato, KPI, grafici, categorie/budget, lista transazioni e form di aggiunta. */

import * as React from "react";
import {
  AddTransactionForm,
  CategoryBreakdownDonut,
  ExpensesKpiCards,
  ExpensesPeriodSelector,
  ExpenseTrendChart,
  TransactionRow,
} from "@/components/domain/expenses";
import { Card } from "@/components/ui/card";
import { authClient } from "@/lib/auth/client";
import {
  compute6MonthTrend,
  computeCategoryBreakdown,
  computeFixedVsVariable,
  computeSummary,
  getPeriodRange,
  type ExpensePeriod,
} from "@/lib/calc/expenses";
import { formatCurrency } from "@/lib/format";
import { useBudgetsQuery } from "@/lib/queries/budgets";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { useTransactionsQuery } from "@/lib/queries/transactions";

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Finestra di fetch: dal 1° gennaio dell'anno precedente al 31 dicembre corrente — copre "anno", il confronto col periodo precedente e l'andamento 6 mesi. */
function fetchWindow(referenceDate: Date): { from: string; to: string } {
  const from = new Date(referenceDate.getFullYear() - 1, 0, 1);
  const to = new Date(referenceDate.getFullYear(), 11, 31);
  return { from: toDateString(from), to: toDateString(to) };
}

export default function SpesePage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const referenceDate = React.useMemo(() => new Date(), []);
  const [period, setPeriod] = React.useState<ExpensePeriod>("mese");
  const [showUncategorizedOnly, setShowUncategorizedOnly] = React.useState(false);

  const { from, to } = fetchWindow(referenceDate);
  const { data: transactions, isLoading, isError, refetch } = useTransactionsQuery(from, to);
  const { data: categories } = useCategoriesQuery();
  const { data: budgets } = useBudgetsQuery();

  const safeTransactions = transactions ?? [];
  const safeCategories = categories ?? [];
  const safeBudgets = budgets ?? [];

  const fallbackCategoryIds = new Set(
    safeCategories.filter((c) => c.isFallback).map((c) => c.id)
  );

  const range = getPeriodRange(period, referenceDate);
  const transactionsInPeriodAll = safeTransactions.filter(
    (t) => t.date >= toDateString(range.from) && t.date <= toDateString(range.to)
  );
  const uncategorizedCount = transactionsInPeriodAll.filter(
    (t) => t.categoryId !== null && fallbackCategoryIds.has(t.categoryId)
  ).length;
  const transactionsInPeriod = showUncategorizedOnly
    ? transactionsInPeriodAll.filter((t) => t.categoryId !== null && fallbackCategoryIds.has(t.categoryId))
    : transactionsInPeriodAll;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">Spese</h1>
          <p className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(range.from)} –{" "}
            {new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" }).format(range.to)}
          </p>
        </div>
        <a
          href="/categorie"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Gestisci categorie
        </a>
        {uncategorizedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowUncategorizedOnly((v) => !v)}
            aria-pressed={showUncategorizedOnly}
            className={
              showUncategorizedOnly
                ? "flex items-center gap-1.5 rounded-full border border-neg/40 bg-neg-soft px-3 py-1 text-sm font-medium text-neg"
                : "flex items-center gap-1.5 rounded-full border border-neg/40 px-3 py-1 text-sm font-medium text-neg hover:bg-neg-soft/50"
            }
          >
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-neg opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-neg" />
            </span>
            Da categorizzare ({uncategorizedCount})
          </button>
        )}
        <ExpensesPeriodSelector value={period} onChange={setPeriod} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Impossibile caricare le transazioni.{" "}
          <button onClick={() => refetch()} className="underline underline-offset-2">
            Riprova
          </button>
        </div>
      ) : (
        <>
          <ExpensesKpiCards
            transactions={safeTransactions}
            budgets={safeBudgets}
            period={period}
            currency={currency}
            referenceDate={referenceDate}
          />

          <CategoryBreakdownDonut
            categoryAmounts={computeCategoryBreakdown(safeTransactions, safeCategories, period, referenceDate)}
            fixedVsVariable={computeFixedVsVariable(safeTransactions, safeCategories, period, referenceDate)}
            budgets={safeBudgets}
            currency={currency}
          />

          <Card className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm text-muted-foreground">
              {(() => {
                const summary = computeSummary(safeTransactions, range);
                return (
                  <>
                    <span>Uscite: {formatCurrency(summary.uscite, currency)}</span>
                    <span>Escluse: {formatCurrency(summary.escluse, currency)}</span>
                    <span className="font-medium text-foreground">
                      Spese effettive: {formatCurrency(summary.speseEffettive, currency)}
                    </span>
                  </>
                );
              })()}
            </div>
            {transactionsInPeriod.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                {showUncategorizedOnly
                  ? "Nessuna transazione da categorizzare in questo periodo."
                  : "Nessuna transazione in questo periodo. Aggiungine una dal form qui sotto."}
              </p>
            ) : (
              transactionsInPeriod.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  categories={safeCategories}
                  currency={currency}
                />
              ))
            )}
            <AddTransactionForm categories={safeCategories} currency={currency} />
          </Card>

          <ExpenseTrendChart
            monthlyTrend={compute6MonthTrend(safeTransactions, referenceDate)}
            currency={currency}
          />
        </>
      )}
    </div>
  );
}
