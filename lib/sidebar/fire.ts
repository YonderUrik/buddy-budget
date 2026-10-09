import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { addMonths, endOfMonth, startOfDay, startOfMonth } from "@/lib/calc/expenses";
import { toDateKey } from "@/lib/calc/net-worth";
import { ANALYTICS_HISTORY_MONTHS, buildAnalyticsBase } from "@/lib/analitiche/base";
import { loadAssumptions } from "@/lib/analitiche/data";
import { resolvePlan } from "@/lib/analitiche/plan";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { transactions } from "@/lib/db/schema/transactions";
import { loadUserDebts } from "@/lib/debts/data";
import { buildDebtsView } from "@/lib/debts/view";
import { loadInvestmentData } from "@/lib/investments/data";
import { loadUserPension } from "@/lib/pension/data";
import { liquidity } from "./summary";
import { toSidebarFire } from "./fire-summary";
import type { SidebarFire } from "./types";

/**
 * Avanzamento verso il numero FIRE per la sidebar: stessi dati e stesse ipotesi di Analitiche (`buildAnalyticsBase` e
 * `resolvePlan`), così le due cifre coincidono. È la query più pesante della sidebar: il client la chiede solo se il
 * modulo è acceso e la tiene in cache a lungo.
 */
export async function loadSidebarFire(userId: string): Promise<SidebarFire> {
  const today = startOfDay(new Date());
  const from = toDateKey(startOfMonth(addMonths(today, -(ANALYTICS_HISTORY_MONTHS - 1))));
  const to = toDateKey(endOfMonth(today));
  const todayKey = toDateKey(today);
  const [[user], liquid, txs, cats, snapshots, investments, pension, debtData, { assumptions }] = await Promise.all([
    db.select({ currency: authUser.currency }).from(authUser).where(eq(authUser.id, userId)),
    liquidity(userId),
    db.select().from(transactions).where(and(eq(transactions.userId, userId), gte(transactions.date, from), lte(transactions.date, to))),
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select().from(netWorthSnapshots).where(and(eq(netWorthSnapshots.userId, userId), lte(netWorthSnapshots.date, todayKey))).orderBy(asc(netWorthSnapshots.date)),
    loadInvestmentData(userId, null),
    loadUserPension(userId),
    loadUserDebts(userId),
    loadAssumptions(userId),
  ]);
  const currency = user?.currency ?? "EUR";
  const debtsTotal = buildDebtsView(debtData.debts, debtData.events, todayKey).overview.totalDebt;
  const base = buildAnalyticsBase({
    today,
    currency,
    liquidity: liquid,
    transactions: txs,
    categories: cats,
    investments,
    pensionFunds: pension.funds,
    debtsTotal,
    snapshots,
  });
  return toSidebarFire(resolvePlan(base, assumptions), currency);
}
