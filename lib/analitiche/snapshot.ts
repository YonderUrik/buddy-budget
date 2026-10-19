import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { startOfDay } from "@/lib/calc/expenses";
import { toDateKey } from "@/lib/calc/net-worth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { transactions } from "@/lib/db/schema/transactions";
import { loadUserDebts } from "@/lib/debts/data";
import { buildDebtsView } from "@/lib/debts/view";
import { loadInvestmentData } from "@/lib/investments/data";
import { loadUserPension } from "@/lib/pension/data";
import type { AnalyticsAssumptions } from "./assumptions";
import { analyticsTransactionsRange, buildAnalyticsBase, type AnalyticsBase } from "./base";
import { loadAssumptions } from "./data";
import { resolveExpectedReturn, withExpectedReturn } from "./historical-return";
import { resolvePlan, type AnalyticsPlan } from "./plan";
import { essentialSpendingFrom, type EssentialSpending } from "@/lib/goals/essential";
import type { AccountColor, AccountIcon } from "@/lib/validation/accounts";
import { refreshDerivedCashHistory } from "@/lib/net-worth/snapshots";

/** Conto come serve a chi legge la fotografia: nome, tipo e saldo di oggi. */
export interface SnapshotAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
  color: AccountColor;
  icon: AccountIcon;
}

/** Fotografia delle Analitiche lato server: stessi dati e stesse ipotesi della pagina, letti una volta. */
export interface AnalyticsSnapshot {
  today: Date;
  todayKey: string;
  currency: string;
  accounts: SnapshotAccount[];
  base: AnalyticsBase;
  /** Ipotesi usate, con il rendimento atteso già risolto (dallo storico se automatico). */
  assumptions: AnalyticsAssumptions;
  plan: AnalyticsPlan;
  /** Spese del mese da coprire con un fondo di emergenza (base della proposta negli Obiettivi). */
  essential: EssentialSpending | null;
}

/**
 * Carica dati e ipotesi delle Analitiche e ne ricava il piano, come fa la pagina: lo usano la sidebar (traguardo
 * FIRE), gli Obiettivi e le email. È una lettura pesante: chi la chiama la tiene in cache o la fa di rado.
 */
export async function loadAnalyticsSnapshot(userId: string, now = new Date()): Promise<AnalyticsSnapshot> {
  const today = startOfDay(now);
  const todayKey = toDateKey(today);
  // Le ipotesi servono prima: il periodo scelto dice quali movimenti leggere.
  const { assumptions } = await loadAssumptions(userId);
  // Stored cash rows feed the history: bring them up to date first (a no-op unless transactions changed).
  await refreshDerivedCashHistory(userId, now);
  const { from, to } = analyticsTransactionsRange(assumptions.dataPeriod, today);
  const [[user], accountRows, txs, cats, snapshots, investments, pension, debtData] = await Promise.all([
    db.select({ currency: authUser.currency }).from(authUser).where(eq(authUser.id, userId)),
    db.select({ id: accounts.id, name: accounts.name, type: accounts.type, balance: accounts.balance, color: accounts.color, icon: accounts.icon }).from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(transactions).where(and(eq(transactions.userId, userId), gte(transactions.date, from), lte(transactions.date, to))),
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select().from(netWorthSnapshots).where(and(eq(netWorthSnapshots.userId, userId), lte(netWorthSnapshots.date, todayKey))).orderBy(asc(netWorthSnapshots.date)),
    loadInvestmentData(userId, null),
    loadUserPension(userId),
    loadUserDebts(userId),
  ]);
  const currency = user?.currency ?? "EUR";
  const accountList = accountRows.map((a) => ({ ...a, balance: Number(a.balance), color: a.color as AccountColor, icon: a.icon as AccountIcon }));
  const debtsTotal = buildDebtsView(debtData.debts, debtData.events, todayKey).overview.totalDebt;
  const base = buildAnalyticsBase({
    today,
    currency,
    period: assumptions.dataPeriod,
    liquidity: accountList.reduce((sum, a) => sum + a.balance, 0),
    transactions: txs,
    categories: cats,
    investments,
    pensionFunds: pension.funds,
    debtsTotal,
    snapshots,
  });
  // Come in Analitiche: il rendimento in automatico viene dallo storico, non dal valore di riserva salvato.
  const used = withExpectedReturn(assumptions, resolveExpectedReturn(assumptions, base.historicalReturn));
  const essential = essentialSpendingFrom({ transactions: txs, categories: cats, today });
  return { today, todayKey, currency, accounts: accountList, base, assumptions: used, plan: resolvePlan(base, used), essential };
}
