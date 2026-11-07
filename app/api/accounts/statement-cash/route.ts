import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { toDateKey, addDays } from "@/lib/calc/net-worth";
import { startOfDay } from "@/lib/calc/expenses";
import { loadStatementCashHistories } from "@/lib/net-worth/statement-cash";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";

/** Response of `GET /api/accounts/statement-cash`: each broker cash account rebuilt from its statements. */
export interface StatementCashResponseItem {
  accountId: string;
  /** End-of-day balance of every day from the first statement to yesterday, in the user's currency. */
  points: { date: string; value: number }[];
  missingFx: boolean;
}

/**
 * Day-by-day balance of the broker cash accounts rebuilt from their statements (Interactive Brokers), for the single
 * account line in Liquidità: those accounts have no transactions to rebuild it from in the browser.
 */
export const GET = withRoute("accounts.statement_cash.list", async (request: NextRequest) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const yesterday = toDateKey(addDays(startOfDay(new Date()), -1));
  const histories = await loadStatementCashHistories(session.user.id, yesterday);
  if (histories.some((h) => h.missingFx)) requestLogger().warn("accounts.statement_cash.missing_fx", { count: histories.length });
  const body: StatementCashResponseItem[] = histories.map((h) => ({ accountId: h.id, points: h.days, missingFx: h.missingFx }));
  return Response.json(body, { headers: { "Cache-Control": "private, no-store" } });
});
