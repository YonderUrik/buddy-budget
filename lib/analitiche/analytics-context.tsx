"use client";

import * as React from "react";
import { startOfDay } from "@/lib/calc/expenses";
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
import { analyticsTransactionsRange, buildAnalyticsBase, type AnalyticsBase } from "./base";
import { DEFAULT_DATA_PERIOD } from "./period";
import { resolveExpectedReturn, withExpectedReturn, type ExpectedReturnInfo } from "./historical-return";
import { resolvePlan, type AnalyticsPlan } from "./plan";

/** Valore condiviso dalle schede di Analitiche: dati di partenza, ipotesi e cifre risultanti. */
export interface AnalyticsContextValue {
  isLoading: boolean;
  /** Arrivano i movimenti di un periodo appena scelto: le cifre sono ancora quelle del periodo di prima. */
  isUpdatingPeriod: boolean;
  isError: boolean;
  refetch: () => void;
  base: AnalyticsBase | null;
  /** Ipotesi in uso: quelle salvate, con il rendimento dallo storico se è in automatico. */
  assumptions: AnalyticsAssumptions | null;
  /** Da dove viene il rendimento in uso (storico, valore prudente o scelto dall'utente). */
  returnInfo: ExpectedReturnInfo | null;
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
  const assumptionsQuery = useAnalyticsAssumptionsQuery();
  // Il periodo dei dati decide quali movimenti leggere: finché le ipotesi non arrivano si parte da quello di default.
  const period = assumptionsQuery.data?.assumptions.dataPeriod ?? DEFAULT_DATA_PERIOD;
  const periodKey = JSON.stringify(period);
  const range = React.useMemo(() => analyticsTransactionsRange(JSON.parse(periodKey), today), [periodKey, today]);
  const transactions = useTransactionsQuery(range.from, range.to, "tutte", { enabled: assumptionsQuery.isSuccess, keepPrevious: true });
  const categories = useCategoriesQuery();
  const investments = useInvestmentsOverviewQuery("max");
  const pension = usePensionQuery();
  const debts = useDebtsQuery();
  const snapshots = useNetWorthSnapshotsQuery("2000-01-01", toDateKey(today));
  const update = useUpdateAssumptionsMutation();
  const markSeen = useMarkWalkthroughSeenMutation();

  // Cambiando periodo restano i movimenti di prima finché arrivano i nuovi: i conti si fanno sul periodo che hanno davvero.
  const [shownPeriodKey, setShownPeriodKey] = React.useState(periodKey);
  if (transactions.data && !transactions.isPlaceholderData && shownPeriodKey !== periodKey) setShownPeriodKey(periodKey);

  const critical = [accounts, transactions, categories, assumptionsQuery, snapshots];
  // isPending e non isLoading: i movimenti aspettano le ipotesi (per il periodo) e intanto non stanno caricando.
  const isError = critical.some((q) => q.isError);
  const isLoading = !isError && (critical.some((q) => q.isPending) || investments.isLoading);

  const base = React.useMemo(() => {
    if (!accounts.data || !transactions.data || !categories.data || !snapshots.data) return null;
    return buildAnalyticsBase({
      today,
      currency: session?.user.currency ?? "EUR",
      period: JSON.parse(shownPeriodKey),
      liquidity: computeAccountsKpi(accounts.data).totalLiquidity,
      transactions: transactions.data,
      categories: categories.data,
      investments: investments.data,
      pensionFunds: pension.data?.funds ?? [],
      debtsTotal: debts.data?.overview.totalDebt ?? 0,
      snapshots: snapshots.data,
    });
  }, [accounts.data, transactions.data, categories.data, snapshots.data, investments.data, pension.data, debts.data, session?.user.currency, today, shownPeriodKey]);

  const stored = assumptionsQuery.data?.assumptions ?? null;
  const returnInfo = React.useMemo(() => (base && stored ? resolveExpectedReturn(stored, base.historicalReturn) : null), [base, stored]);
  const assumptions = React.useMemo(() => (stored && returnInfo ? withExpectedReturn(stored, returnInfo) : stored), [stored, returnInfo]);
  const plan = React.useMemo(() => (base && assumptions ? resolvePlan(base, assumptions) : null), [base, assumptions]);

  const value: AnalyticsContextValue = {
    isLoading,
    isUpdatingPeriod: shownPeriodKey !== periodKey,
    isError,
    refetch: () => {
      for (const q of [...critical, investments]) q.refetch();
    },
    base,
    assumptions,
    returnInfo,
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
