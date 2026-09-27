"use client";

/**
 * Pagina Transazioni (ex Spese): orchestra periodo, filtri e due viste.
 * - "Movimenti": riepilogo del periodo + lista transazioni (vista di lavoro, default).
 * - "Analisi": KPI uscite/entrate, torta categorie/budget, andamento 6 mesi.
 * I filtri categoria/testo valgono per entrambe le viste; il toggle Tutte/Uscite/Entrate solo per la lista.
 */

import * as React from "react";
import { Plus } from "lucide-react";
import {
  AddTransactionForm,
  CategoryBreakdownDonut,
  ExpensesFilterBar,
  ExpensesKpiCards,
  ExpensesPeriodSelector,
  ExpensesReferenceNav,
  ExpenseTrendChart,
  IncomeKpiCards,
  TransactionRow,
  TransactionsPeriodSummary,
  TransactionsTypeToggle,
  UncategorizedCallout,
} from "@/components/domain/expenses";
import { LoadError, SegmentedControl } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { authClient } from "@/lib/auth/client";
import {
  computeCategoryBreakdown,
  computeCategoryMonthlyStacks,
  computeGroupTotals,
  computeIncomeSummary,
  computeSummary,
  filterByTransactionType,
  filterTransactions,
  getPeriodRange,
  isExpense,
  isIncome,
  type ExpensePeriod,
  type TransactionDirection,
} from "@/lib/calc/expenses";
import { useBudgetsQuery } from "@/lib/queries/budgets";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { useTransactionsQuery } from "@/lib/queries/transactions";

type TransactionsView = "movimenti" | "analisi";

const VIEW_OPTIONS = [
  { value: "movimenti", label: "Movimenti" },
  { value: "analisi", label: "Analisi" },
] as const satisfies readonly { value: TransactionsView; label: string }[];

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Finestra di fetch: dal 1° gennaio dell'anno precedente al 31 dicembre corrente — copre "anno", il confronto col periodo precedente e l'andamento 6 mesi. */
function fetchWindow(referenceDate: Date): { from: string; to: string } {
  const from = new Date(referenceDate.getFullYear() - 1, 0, 1);
  const to = new Date(referenceDate.getFullYear(), 11, 31);
  return { from: toDateString(from), to: toDateString(to) };
}

export default function TransazioniPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const [referenceDate, setReferenceDate] = React.useState<Date>(() => new Date());
  const today = React.useMemo(() => new Date(), []);
  const [period, setPeriod] = React.useState<ExpensePeriod>("mese");
  const [view, setView] = React.useState<TransactionsView>("movimenti");
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [showUncategorizedOnly, setShowUncategorizedOnly] = React.useState(false);
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(null);
  const [searchText, setSearchText] = React.useState("");
  const [listTypeFilter, setListTypeFilter] = React.useState<TransactionDirection>("tutte");

  const { from, to } = fetchWindow(referenceDate);
  const { data: transactions, isLoading, isError, refetch } = useTransactionsQuery(from, to, "tutte");
  const { data: categories } = useCategoriesQuery();
  const { data: budgets } = useBudgetsQuery();

  const safeTransactions = transactions ?? [];
  const safeCategories = categories ?? [];
  const safeBudgets = budgets ?? [];

  const filteredTransactions = filterTransactions(safeTransactions, {
    categoryId: categoryFilter,
    searchText,
  });

  // Widget di analisi (KPI/donut/trend): sempre e solo uscite, indipendentemente dal toggle tipo-lista.
  const expenseTransactionsForAnalysis = filteredTransactions.filter(isExpense);
  // Card KPI entrate: stesso filtro categoria/testo, ma sul lato entrate.
  const incomeTransactionsForAnalysis = filteredTransactions.filter(isIncome);
  const filteredBudgets = categoryFilter
    ? safeBudgets.filter((b) => b.categoryId === categoryFilter)
    : safeBudgets;

  // Lista: rispetta il toggle Tutte/Uscite/Entrate.
  const listFiltered = filterByTransactionType(filteredTransactions, listTypeFilter);

  const fallbackCategoryIds = new Set(
    safeCategories.filter((c) => c.isFallback).map((c) => c.id)
  );

  const range = getPeriodRange(period, referenceDate);
  const transactionsInPeriodAll = listFiltered.filter(
    (t) => t.date >= toDateString(range.from) && t.date <= toDateString(range.to)
  );
  const uncategorizedCount = transactionsInPeriodAll.filter(
    (t) => t.categoryId !== null && fallbackCategoryIds.has(t.categoryId)
  ).length;
  const transactionsInPeriod = showUncategorizedOnly
    ? transactionsInPeriodAll.filter((t) => t.categoryId !== null && fallbackCategoryIds.has(t.categoryId))
    : transactionsInPeriodAll;

  const hasActiveFilter = categoryFilter !== null || searchText.trim() !== "";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-medium text-foreground">Transazioni</h1>
          <ExpensesReferenceNav
            period={period}
            referenceDate={referenceDate}
            onChange={setReferenceDate}
            onPeriodChange={setPeriod}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ExpensesPeriodSelector value={period} onChange={setPeriod} className="hidden sm:inline-flex" />
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger
              render={
                <Button className="gap-1.5 shadow-xs">
                  <Plus size={15} aria-hidden="true" /> Aggiungi
                </Button>
              }
            />
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nuova transazione</DialogTitle>
              </DialogHeader>
              <AddTransactionForm
                categories={safeCategories}
                currency={currency}
                stacked
                onSuccess={() => setAddDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <SegmentedControl
          options={VIEW_OPTIONS}
          value={view}
          onChange={setView}
          ariaLabel="Vista"
          className="w-full sm:w-fit"
          stretch
        />
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
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <LoadError message="Impossibile caricare le transazioni." onRetry={() => refetch()} />
      ) : view === "movimenti" ? (
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
              <TransactionsTypeToggle
                value={listTypeFilter}
                onChange={setListTypeFilter}
                stretch
                className="sm:w-fit"
              />
            </div>
            <TransactionsPeriodSummary
              expenses={computeSummary(expenseTransactionsForAnalysis, range)}
              income={computeIncomeSummary(incomeTransactionsForAnalysis, range)}
              currency={currency}
            />
            {transactionsInPeriod.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                {showUncategorizedOnly
                  ? "Nessuna transazione da categorizzare in questo periodo."
                  : hasActiveFilter
                    ? "Nessuna transazione corrisponde ai filtri applicati in questo periodo."
                    : "Nessuna transazione in questo periodo. Registrane una con “Aggiungi”."}
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
          </Card>
        </>
      ) : (
        <>
          <section className="flex flex-col gap-3" aria-labelledby="kpi-uscite">
            <h2 id="kpi-uscite" className="text-sm font-medium text-muted-foreground">
              Uscite
            </h2>
            <ExpensesKpiCards
              transactions={expenseTransactionsForAnalysis}
              budgets={filteredBudgets}
              period={period}
              currency={currency}
              referenceDate={referenceDate}
              today={today}
            />
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="kpi-entrate">
            <h2 id="kpi-entrate" className="text-sm font-medium text-muted-foreground">
              Entrate
            </h2>
            <IncomeKpiCards
              transactions={incomeTransactionsForAnalysis}
              period={period}
              currency={currency}
              referenceDate={referenceDate}
              today={today}
            />
          </section>

          <CategoryBreakdownDonut
            categoryAmounts={computeCategoryBreakdown(expenseTransactionsForAnalysis, safeCategories, period, referenceDate, today)}
            groupTotals={computeGroupTotals(expenseTransactionsForAnalysis, safeCategories, period, referenceDate, today)}
            budgets={safeBudgets}
            currency={currency}
          />

          <ExpenseTrendChart
            monthlyStacks={computeCategoryMonthlyStacks(expenseTransactionsForAnalysis, safeCategories, referenceDate)}
            currency={currency}
          />
        </>
      )}
    </div>
  );
}
