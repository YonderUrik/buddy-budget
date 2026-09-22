"use client";

/** Pagina Cash flow: cruscotto di sola lettura — confronto entrate/uscite, fonti di entrata, dove va ogni euro, risparmio accumulato. */

import * as React from "react";
import {
  AccumulatedSavingsChart,
  CashflowKpiCards,
  CashflowPeriodSelector,
  CashflowReferenceNav,
  CashflowTrendChart,
  IncomeSourcesList,
  WhereItGoesBreakdown,
} from "@/components/domain/cashflow";
import { LoadError } from "@/components/domain/shared";
import { authClient } from "@/lib/auth/client";
import {
  computeAccumulatedSavings,
  computeIncomeSources,
  computeMonthlySeries,
  computeWhereItGoes,
  getCashflowPeriodRange,
  type CashflowPeriod,
} from "@/lib/calc/cashflow";
import { startOfDay } from "@/lib/calc/expenses";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { useTransactionsQuery } from "@/lib/queries/transactions";

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Finestra di fetch: 24 mesi prima del riferimento fino a oggi — copre il periodo massimo selezionabile (24M) più il confronto col periodo precedente. */
function fetchWindow(referenceDate: Date): { from: string; to: string } {
  const from = new Date(referenceDate.getFullYear() - 4, referenceDate.getMonth(), 1);
  const to = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
  return { from: toDateString(from), to: toDateString(to) };
}

export default function CashFlowPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const [referenceDate, setReferenceDate] = React.useState<Date>(() => new Date());
  const [period, setPeriod] = React.useState<CashflowPeriod>("6mesi");

  const { from, to } = fetchWindow(referenceDate);
  const { data: transactions, isLoading, isError, refetch } = useTransactionsQuery(from, to, "tutte");
  const { data: categories } = useCategoriesQuery();

  const safeTransactions = transactions ?? [];
  const safeCategories = categories ?? [];

  const range = getCashflowPeriodRange(period, referenceDate);
  const today = startOfDay(new Date());

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">Cash flow</h1>
          <CashflowReferenceNav period={period} referenceDate={referenceDate} onChange={setReferenceDate} />
        </div>
        <CashflowPeriodSelector value={period} onChange={setPeriod} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <LoadError message="Impossibile caricare i dati del cash flow." onRetry={() => refetch()} />
      ) : (
        <>
          <CashflowKpiCards
            transactions={safeTransactions}
            period={period}
            currency={currency}
            referenceDate={referenceDate}
            today={today}
          />

          <CashflowTrendChart monthlySeries={computeMonthlySeries(safeTransactions, range)} currency={currency} />

          <IncomeSourcesList
            sources={computeIncomeSources(safeTransactions, safeCategories, range)}
            currency={currency}
          />

          <WhereItGoesBreakdown
            entries={computeWhereItGoes(safeTransactions, safeCategories, referenceDate)}
            currency={currency}
          />

          <AccumulatedSavingsChart
            entries={computeAccumulatedSavings(safeTransactions, range)}
            currency={currency}
          />
        </>
      )}
    </div>
  );
}
