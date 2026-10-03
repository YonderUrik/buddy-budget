"use client";

import * as React from "react";
import { addMonths, endOfMonth, startOfDay, startOfMonth } from "@/lib/calc/expenses";
import { toDateKey } from "@/lib/calc/net-worth";
import { authClient } from "@/lib/auth/client";
import { computeAccountsKpi } from "@/components/domain/accounts";
import { useAccountsQuery } from "@/lib/queries/accounts";
import { useAnalyticsAssumptionsQuery, useMarkWalkthroughSeenMutation, useUpdateAssumptionsMutation } from "@/lib/queries/analytics";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { useDebtsQuery } from "@/lib/queries/debts";
import { useInvestmentsOverviewQuery } from "@/lib/queries/investments";
import { useNetWorthSnapshotsQuery } from "@/lib/queries/net-worth";
import { usePensionQuery } from "@/lib/queries/pension";
import { useTransactionsQuery } from "@/lib/queries/transactions";
import type { AnalyticsAssumptions, UpdateAssumptionsInput } from "./assumptions";
import { ANALYTICS_HISTORY_MONTHS, buildAnalyticsBase, type AnalyticsBase } from "./base";
import { resolvePlan, type AnalyticsPlan } from "./plan";

/** Valore condiviso dalle schede di Analitiche: dati di partenza, ipotesi e cifre risultanti. */
export interface AnalyticsContextValue {
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  base: AnalyticsBase | null;
  assumptions: AnalyticsAssumptions | null;
  plan: AnalyticsPlan | null;
  walkthroughSeen: boolean;
  saveAssumptions: (input: UpdateAssumptionsInput) => Promise<void>;
  saving: boolean;
  saveError: string | null;
  markWalkthroughSeen: () => void;
  today: Date;
}

const AnalyticsContext = React.createContext<AnalyticsContextValue | null>(null);

/** Legge dalle altre sezioni (conti, movimenti, investimenti, previdenza, debiti) e le compone: nessuna richiesta nuova oltre alle ipotesi. */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const today = React.useMemo(() => startOfDay(new Date()), []);
  const { data: session } = authClient.useSession();
  const accounts = useAccountsQuery();
  const range = React.useMemo(() => ({ from: startOfMonth(addMonths(today, -(ANALYTICS_HISTORY_MONTHS - 1))), to: endOfMonth(today) }), [today]);
  const transactions = useTransactionsQuery(toDateKey(range.from), toDateKey(range.to), "tutte");
  const categories = useCategoriesQuery();
  const investments = useInvestmentsOverviewQuery("max");
  const pension = usePensionQuery();
  const debts = useDebtsQuery();
  const snapshots = useNetWorthSnapshotsQuery("2000-01-01", toDateKey(today));
  const assumptionsQuery = useAnalyticsAssumptionsQuery();
  const update = useUpdateAssumptionsMutation();
  const markSeen = useMarkWalkthroughSeenMutation();

  const critical = [accounts, transactions, categories, assumptionsQuery, snapshots];
  const isLoading = critical.some((q) => q.isLoading) || investments.isLoading;
  const isError = critical.some((q) => q.isError);

  const base = React.useMemo(() => {
    if (!accounts.data || !transactions.data || !categories.data || !snapshots.data) return null;
    return buildAnalyticsBase({
      today,
      currency: session?.user.currency ?? "EUR",
      liquidity: computeAccountsKpi(accounts.data).totalLiquidity,
      transactions: transactions.data,
      categories: categories.data,
      investments: investments.data,
      pensionFunds: pension.data?.funds ?? [],
      debtsTotal: debts.data?.overview.totalDebt ?? 0,
      snapshots: snapshots.data,
    });
  }, [accounts.data, transactions.data, categories.data, snapshots.data, investments.data, pension.data, debts.data, session?.user.currency, today]);

  const assumptions = assumptionsQuery.data?.assumptions ?? null;
  const plan = React.useMemo(() => (base && assumptions ? resolvePlan(base, assumptions) : null), [base, assumptions]);

  const value: AnalyticsContextValue = {
    isLoading,
    isError,
    refetch: () => {
      for (const q of [...critical, investments]) q.refetch();
    },
    base,
    assumptions,
    plan,
    walkthroughSeen: assumptionsQuery.data?.walkthroughSeen ?? true,
    saveAssumptions: async (input) => {
      await update.mutateAsync(input);
    },
    saving: update.isPending,
    saveError: update.isError ? update.error.message : null,
    markWalkthroughSeen: () => markSeen.mutate(),
    today,
  };
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

/** Dati e ipotesi di Analitiche; solo dentro `AnalyticsProvider`. */
export function useAnalytics(): AnalyticsContextValue {
  const ctx = React.useContext(AnalyticsContext);
  if (!ctx) throw new Error("useAnalytics va usato dentro AnalyticsProvider");
  return ctx;
}
