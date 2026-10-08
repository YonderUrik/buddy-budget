"use client";

/** Parte alta della scheda Movimenti: frase del mese, cifra eroe con grafico e chip dei conti. Prende i dati e li passa ai componenti di sola vista. */

import * as React from "react";
import { computeAccountsKpi } from "@/components/domain/accounts";
import { track } from "@/lib/analytics";
import { authClient } from "@/lib/auth/client";
import { addMonths, endOfMonth, startOfDay, startOfMonth } from "@/lib/calc/expenses";
import { computeMonthPace, MONTH_PACE_LOOKBACK } from "@/lib/calc/month-pace";
import {
  buildNetWorthSeries,
  computeNetWorthChange,
  getNetWorthPeriodRange,
  toDateKey,
  type NetWorthPeriod,
} from "@/lib/calc/net-worth";
import { computeConnectionHealth, needsRenewal } from "@/lib/gocardless/connection-health";
import { buildAccountBalanceSeries } from "@/lib/liquidity/account-series";
import { buildVoiceLines } from "@/lib/overview/voice";
import { useAccountsQuery } from "@/lib/queries/accounts";
import { useBudgetsQuery } from "@/lib/queries/budgets";
import { useBankConnectionsStatusQuery } from "@/lib/queries/gocardless";
import { useNetWorthSnapshotsQuery } from "@/lib/queries/net-worth";
import { useTransactionsQuery } from "@/lib/queries/transactions";
import { useAttentionQuery } from "@/lib/queries/attention";
import { AccountChips } from "./account-chips";
import { useLiquidityActions } from "./liquidity-actions";
import { useLiquidity } from "./liquidity-context";
import { LiquidityHero } from "./liquidity-hero";
import type { TrendPoint } from "./trend-chart";

const DEFAULT_PERIOD: NetWorthPeriod = "3mesi";
const MONTH_NAME = new Intl.DateTimeFormat("it-IT", { month: "long" });

export function LiquidityOverview() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const { today: now, accountId, setAccountId } = useLiquidity();
  const { addAccount } = useLiquidityActions();
  const today = React.useMemo(() => startOfDay(now), [now]);
  const [period, setPeriod] = React.useState<NetWorthPeriod>(DEFAULT_PERIOD);

  const accountsQuery = useAccountsQuery();
  const snapshotsQuery = useNetWorthSnapshotsQuery("2000-01-01", toDateKey(today));
  const connectionsQuery = useBankConnectionsStatusQuery();
  const connections = React.useMemo(() => connectionsQuery.data ?? [], [connectionsQuery.data]);
  const budgetsQuery = useBudgetsQuery();
  const budgets = React.useMemo(() => budgetsQuery.data ?? [], [budgetsQuery.data]);
  const attention = useAttentionQuery().data;
  const monthRange = React.useMemo(() => ({ from: addMonths(startOfMonth(today), -MONTH_PACE_LOOKBACK), to: endOfMonth(today) }), [today]);
  const transactionsQuery = useTransactionsQuery(toDateKey(monthRange.from), toDateKey(monthRange.to), "tutte");
  const transactions = React.useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data]);

  const accounts = React.useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const selected = accounts.find((a) => a.id === accountId) ?? null;
  const total = computeAccountsKpi(accounts).totalLiquidity;
  const needsAttention = new Set(connections.filter((c) => needsRenewal(computeConnectionHealth(c, today).state)).map((c) => c.accountId));

  const { points, delta } = React.useMemo(() => {
    if (selected) {
      const earliest = transactions.reduce<string | null>((min, t) => (min === null || t.date < min ? t.date : min), null);
      const { from } = getNetWorthPeriodRange(period, today, earliest);
      const series = buildAccountBalanceSeries(selected, transactions, from, today);
      const pts: TrendPoint[] = series.map((p) => ({ label: p.date, value: p.value }));
      return { points: pts, delta: series.length > 1 ? series[series.length - 1].value - series[0].value : null };
    }
    const liquidity = (snapshotsQuery.data ?? []).filter((row) => row.assetClass === "liquidita");
    const series = buildNetWorthSeries(liquidity, { liquidita: total }, period, today);
    return { points: series.map((p) => ({ label: p.date, value: p.value })), delta: series.length > 1 ? computeNetWorthChange(series).delta : null };
  }, [selected, transactions, snapshotsQuery.data, total, period, today]);

  const pace = React.useMemo(() => computeMonthPace(transactions, budgets, today), [transactions, budgets, today]);
  const lines = buildVoiceLines({ pace, monthLabel: MONTH_NAME.format(today), currency, nextDue: null, today });
  const toFix = attention?.uncategorizedCount ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-[62ch] text-lg leading-relaxed text-text-2 sm:text-xl">
        {accounts.length > 0 && (
          <>
            Hai <strong className="font-heading font-medium text-foreground">{new Intl.NumberFormat("it-IT", { style: "currency", currency, maximumFractionDigits: 0 }).format(total)}</strong> su {accounts.length} {accounts.length === 1 ? "conto" : "conti"}.{" "}
          </>
        )}
        {lines.map((line) => (
          <span key={line.key}>
            {line.segments.map((s, i) => (s.strong ? <strong key={i} className="font-heading font-medium text-foreground">{s.text}</strong> : <span key={i}>{s.text}</span>))}{" "}
          </span>
        ))}
        {toFix > 0 && (
          <>
            <strong className="font-heading font-medium text-foreground">{toFix} {toFix === 1 ? "movimento aspetta" : "movimenti aspettano"}</strong> una categoria.
          </>
        )}
      </p>
      <LiquidityHero
        label={selected ? selected.name : "Liquidità totale"}
        value={selected ? Number(selected.balance) : total}
        currency={currency}
        delta={delta}
        period={period}
        onPeriodChange={setPeriod}
        points={points}
      />
      <AccountChips
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, balance: Number(a.balance), needsAttention: needsAttention.has(a.id) }))}
        total={total}
        currency={currency}
        selectedId={accountId}
        onSelect={(id) => {
          setAccountId(id);
          track("liquidity_account_filtered", { scope: id ? "conto" : "tutti" });
        }}
        onAdd={addAccount}
      />
    </div>
  );
}
