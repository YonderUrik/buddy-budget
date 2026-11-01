import "server-only";
import { and, desc, eq, isNull, lte, ne, notInArray, or } from "drizzle-orm";
import { loadBudgetMonths } from "@/lib/budgets/store.server";
import { monthKey, ROLLOVER_MAX_MONTHS, shiftMonth } from "@/lib/calc/budget-plan";
import { addMonths, endOfMonth, startOfMonth } from "@/lib/calc/expenses";
import { MONTH_PACE_LOOKBACK } from "@/lib/calc/month-pace";
import { toDateKey } from "@/lib/calc/net-worth";
import { db } from "@/lib/db/client";
import { transactions } from "@/lib/db/schema/transactions";
import { loadTransactionRows, withTransactionLogos } from "@/lib/liquidity/transactions-list.server";
import { resolveProfile } from "@/lib/localization/config";
import { loadUserBudgets, loadUserCategories } from "./data.server";
import type { WidgetSpending } from "./schemas";
import { buildWidgetSpending, type WidgetMovementRow } from "./widget-spending";

export interface WidgetSpendingUser {
  id: string;
  currency?: string | null;
  productCountry?: string | null;
  language?: string | null;
  hideAmounts?: boolean | null;
}

/**
 * Loads and computes `GET /api/widgets/spending`. One transaction read covers both calculations: the month-pace
 * lookback of Panoramica and, only when the user has budgets, the longest carried leftover of Liquidità · Budget.
 */
export async function loadWidgetSpending(user: WidgetSpendingUser, options: { today: Date; now: Date }): Promise<WidgetSpending> {
  const { today } = options;
  const profile = resolveProfile(user);
  const [budgets, categories, budgetMonths] = await Promise.all([loadUserBudgets(user.id), loadUserCategories(user.id, profile), loadBudgetMonths(user.id)]);
  const paceFrom = toDateKey(addMonths(startOfMonth(today), -MONTH_PACE_LOOKBACK));
  const rolloverFrom = `${shiftMonth(monthKey(today), -ROLLOVER_MAX_MONTHS)}-01`;
  const from = budgets.length > 0 && rolloverFrom < paceFrom ? rolloverFrom : paceFrom;
  const transferIds = categories.filter((c) => c.type === "trasferimento").map((c) => c.id);

  const [rows, lastMovement] = await Promise.all([
    loadTransactionRows(user.id, { from, to: toDateKey(endOfMonth(today)), direction: "tutte" }),
    loadLastMovement(user.id, toDateKey(today), transferIds),
  ]);

  return buildWidgetSpending({
    today,
    now: options.now,
    currency: user.currency ?? "EUR",
    language: profile.language,
    hideAmounts: user.hideAmounts === true,
    transactions: rows,
    categories,
    budgets,
    budgetMonths,
    lastMovement,
  });
}

/**
 * The most recent expense or income up to `todayKey`, by date then creation: transfers between the user's accounts
 * (categories of type `trasferimento`) and zero amounts are left out. With the merchant logo Movimenti shows.
 */
async function loadLastMovement(userId: string, todayKey: string, transferIds: string[]): Promise<WidgetMovementRow | null> {
  const notTransfer = transferIds.length > 0 ? or(isNull(transactions.categoryId), notInArray(transactions.categoryId, transferIds)) : undefined;
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), lte(transactions.date, todayKey), ne(transactions.amount, "0"), notTransfer))
    .orderBy(desc(transactions.date), desc(transactions.createdAt), desc(transactions.id))
    .limit(1);
  if (!row) return null;
  const [withLogo] = await withTransactionLogos([row], userId);
  return withLogo;
}
