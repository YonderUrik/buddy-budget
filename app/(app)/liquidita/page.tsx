"use client";

/** Liquidità · Movimenti: frase del mese, cifra eroe, chip dei conti, elenco a giorni e colonna "Il mese". */

import Link from "next/link";
import * as React from "react";
import { LoadError } from "@/components/domain/shared";
import {
  LIQUIDITY_HREF,
  LiquidityOverview,
  MonthAside,
  MovementFeed,
  MovementsToolbar,
  liquidityFetchWindow,
  useLiquidity,
} from "@/components/domain/liquidity";
import { authClient } from "@/lib/auth/client";
import { computeMonthPace } from "@/lib/calc/month-pace";
import {
  computeGroupTotals,
  computeIncomeSummary,
  computeSummary,
  endOfMonth,
  filterByTransactionType,
  filterTransactions,
  startOfDay,
  startOfMonth,
  type TransactionDirection,
} from "@/lib/calc/expenses";
import { track } from "@/lib/analytics";
import { useAccountsQuery } from "@/lib/queries/accounts";
import { useAttentionQuery } from "@/lib/queries/attention";
import { useBudgetsQuery } from "@/lib/queries/budgets";
import { useCategoriesQuery, useCategoryUsageQuery } from "@/lib/queries/categories";
import { useTransactionsQuery } from "@/lib/queries/transactions";

export default function LiquiditaPage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const { today: now, accountId, categoryId, setCategoryId, searchText, setSearchText } = useLiquidity();
  const today = React.useMemo(() => startOfDay(now), [now]);
  const [direction, setDirection] = React.useState<TransactionDirection>("tutte");
  const [toFixOnly, setToFixOnly] = React.useState(false);

  React.useEffect(() => track("liquidity_tab_viewed", { tab: "movimenti" }), []);

  const { from, to } = liquidityFetchWindow(today);
  const { data: transactions, isLoading, isError, refetch } = useTransactionsQuery(from, to, "tutte");
  const categoriesQuery = useCategoriesQuery();
  const categories = React.useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const usage = useCategoryUsageQuery().data;
  const accountsQuery = useAccountsQuery();
  const accounts = React.useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const budgetsQuery = useBudgetsQuery();
  const budgets = React.useMemo(() => budgetsQuery.data ?? [], [budgetsQuery.data]);
  const toFix = useAttentionQuery().data?.uncategorizedCount ?? 0;

  const accountNames = React.useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const fallbackIds = React.useMemo(() => new Set(categories.filter((c) => c.isFallback).map((c) => c.id)), [categories]);
  const all = React.useMemo(() => transactions ?? [], [transactions]);

  const visible = React.useMemo(() => {
    const filtered = filterByTransactionType(filterTransactions(all, { categoryId, searchText, accountId }), direction);
    return toFixOnly ? filtered.filter((t) => fallbackIds.has(t.categoryId)) : filtered;
  }, [all, categoryId, searchText, accountId, direction, toFixOnly, fallbackIds]);

  const month = { from: startOfMonth(today), to: endOfMonth(today) };
  const scoped = React.useMemo(() => filterTransactions(all, { categoryId: null, searchText: "", accountId }), [all, accountId]);
  const spent = computeSummary(scoped, month).speseEffettive;
  const income = computeIncomeSummary(scoped, month).entrateEffettive;
  const pace = React.useMemo(() => computeMonthPace(scoped, budgets, today), [scoped, budgets, today]);
  const groups = computeGroupTotals(scoped, categories, "mese", today, today);

  return (
    <div className="flex flex-col gap-8">
      <LiquidityOverview />
      <Link href="/importazioni" className="text-sm font-medium text-primary hover:underline">Importa un CSV personale →</Link>
      <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <MovementsToolbar
            searchText={searchText}
            onSearchTextChange={setSearchText}
            direction={direction}
            onDirectionChange={setDirection}
            toFix={toFix}
            toFixOnly={toFixOnly}
            onToFixOnlyChange={setToFixOnly}
            categoryName={categories.find((c) => c.id === categoryId)?.name}
            onClearCategory={() => setCategoryId(null)}
          />
          {isLoading ? (
            <div className="flex flex-col gap-3 pt-4" aria-busy="true" aria-label="Caricamento dei movimenti">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : isError ? (
            <LoadError message="Impossibile caricare i movimenti." onRetry={() => refetch()} />
          ) : (
            <MovementFeed
              transactions={visible}
              categories={categories}
              usage={usage}
              accountNames={accountId ? undefined : accountNames}
              currency={currency}
              today={today}
              emptyMessage={searchText || categoryId || toFixOnly ? "Nessun movimento corrisponde ai filtri." : "Nessun movimento ancora: collega una banca o aggiungine uno a mano."}
            />
          )}
        </div>
        <MonthAside
          income={income}
          spent={spent}
          typicalSoFar={pace.typicalSoFar}
          toFix={toFix}
          groups={groups}
          currency={currency}
          analysisHref={`${LIQUIDITY_HREF}/analisi`}
          fixHref="/categorizza"
        />
      </div>
    </div>
  );
}
