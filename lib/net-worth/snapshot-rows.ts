import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { loadUserDebts } from "@/lib/debts/data";
import { todayIso } from "@/lib/debts/dates";
import { buildDebtsView } from "@/lib/debts/view";
import { loadUserPension } from "@/lib/pension/data";
import { compactSnapshotRows } from "./compact";
import { buildDebtHistoryRows } from "./debt-history";
import { refreshDerivedInvestmentHistory } from "./investments";
import { buildPensionHistoryRows } from "./pension-history";
import { backfillDerivedHistory } from "./snapshots";

/**
 * Net-worth history rows of a user between `from` and `to` (YYYY-MM-DD), as `GET /api/net-worth/snapshots` serves them:
 * stored snapshots (after rebuilding missing or stale derived history) plus the debt and pension history recomputed
 * from plans and fund snapshots. `compact` keeps only the last row of each month beyond the last year.
 */
export async function loadNetWorthSnapshotRows(userId: string, from: string, to: string, options: { compact?: boolean } = {}) {
  await backfillDerivedHistory(userId);
  await refreshDerivedInvestmentHistory(userId);
  const rows = await db
    .select()
    .from(netWorthSnapshots)
    .where(and(eq(netWorthSnapshots.userId, userId), gte(netWorthSnapshots.date, from), lte(netWorthSnapshots.date, to)))
    .orderBy(asc(netWorthSnapshots.date));
  // Debts are not stored: their history is recomputed from plans and events, so it follows every change.
  const today = todayIso();
  const { debts: debtRows, events } = await loadUserDebts(userId);
  const debtHistory = buildDebtHistoryRows(buildDebtsView(debtRows, events, today), today, from).filter((r) => r.date <= to);
  // Pension too is recomputed from the funds' snapshots, without storing anything.
  const pensionHistory = buildPensionHistoryRows((await loadUserPension(userId)).funds, today, from).filter((r) => r.date <= to);
  const all = [...rows, ...debtHistory, ...pensionHistory];
  return options.compact ? compactSnapshotRows(all, today) : all;
}
