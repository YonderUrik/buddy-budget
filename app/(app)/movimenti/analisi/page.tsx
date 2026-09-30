"use client";

/**
 * Movimenti · Analisi: cifre del periodo, andamento mensile (entrate/uscite o per categoria), spesa per gruppo e categoria
 * con budget, fonti di entrata e risparmio accumulato. Sostituisce l'ex Cash flow e la vista Analisi di Transazioni.
 */

import { AccumulatedSavingsChart, IncomeSourcesList } from "@/components/domain/cashflow";
import { CategoryBreakdownDonut, ExpensesFilterBar } from "@/components/domain/expenses";
import { MovementsKpiStrip, MovementsTrendSwitch, movementsFetchWindow, useMovements } from "@/components/domain/movements";
import { LoadError } from "@/components/domain/shared";
import { authClient } from "@/lib/auth/client";
import {
  computeAccumulatedSavings,
  computeIncomeSources,
  computeMonthlySeries,
} from "@/lib/calc/cashflow";
import {
  computeCategoryBreakdown,
  computeCategoryMonthlyStacks,
  computeGroupTotals,
  filterTransactions,
  getPeriodRange,
  isExpense,
} from "@/lib/calc/expenses";
import { TREND_MONTHS_DEFAULT, TREND_MONTHS_YEAR, getTrendRange } from "@/lib/calc/movements";
import { useBudgetsQuery } from "@/lib/queries/budgets";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { useTransactionsQuery } from "@/lib/queries/transactions";

export default function MovimentiAnalisiPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const { period, referenceDate, today, categoryFilter, setCategoryFilter, searchText, setSearchText } = useMovements();

  const { from, to } = movementsFetchWindow(referenceDate);
  const { data: transactions, isLoading, isError, refetch } = useTransactionsQuery(from, to, "tutte");
  const { data: categories } = useCategoriesQuery();
  const { data: budgets } = useBudgetsQuery();
  const safeCategories = categories ?? [];
  const safeBudgets = budgets ?? [];

  const filtered = filterTransactions(transactions ?? [], { categoryId: categoryFilter, searchText });
  const expenses = filtered.filter(isExpense);
  const range = getPeriodRange(period, referenceDate);
  const trendRange = getTrendRange(period, referenceDate);
  const trendMonths = period === "anno" ? TREND_MONTHS_YEAR : TREND_MONTHS_DEFAULT;

  return (
    <>
      <ExpensesFilterBar
        categories={safeCategories}
        categoryId={categoryFilter}
        onCategoryChange={setCategoryFilter}
        searchText={searchText}
        onSearchTextChange={setSearchText}
      />

      {isLoading ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : isError ? (
        <LoadError message="Impossibile caricare i dati dell'analisi." onRetry={() => refetch()} />
      ) : (
        <>
          <MovementsKpiStrip transactions={filtered} period={period} referenceDate={referenceDate} currency={currency} />

          <MovementsTrendSwitch
            monthlySeries={computeMonthlySeries(filtered, trendRange)}
            monthlyStacks={computeCategoryMonthlyStacks(expenses, safeCategories, referenceDate, 6, trendMonths)}
            currency={currency}
          />

          <CategoryBreakdownDonut
            categoryAmounts={computeCategoryBreakdown(expenses, safeCategories, period, referenceDate, today)}
            groupTotals={computeGroupTotals(expenses, safeCategories, period, referenceDate, today)}
            budgets={categoryFilter ? safeBudgets.filter((b) => b.categoryId === categoryFilter) : safeBudgets}
            currency={currency}
          />

          <IncomeSourcesList sources={computeIncomeSources(filtered, safeCategories, range)} currency={currency} />

          <AccumulatedSavingsChart entries={computeAccumulatedSavings(filtered, trendRange)} currency={currency} />
        </>
      )}
    </>
  );
}
