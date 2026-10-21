import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { startOfDay } from "@/lib/calc/expenses";
import { apiError } from "@/lib/http";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { parseTodayParam } from "@/lib/views";
import { loadLiquidityMonth } from "@/lib/views/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/liquidity/month?accountId=&today=YYYY-MM-DD — the month column of Liquidità · Movimenti computed on the
 * server (gaps.md G3): spent and income this month, pace against the last three months, spending per group, budget
 * totals and per-category budget progress, uncategorized count and the month sentence. `accountId` scopes the figures
 * to one account, as the account chips do on the web.
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const accountId = request.nextUrl.searchParams.get("accountId") || null;
  if (accountId && !UUID.test(accountId)) return apiError(400, "validation_failed", "accountId non valido", { field: "accountId" });
  const today = parseTodayParam(request);
  if (today === null) return apiError(400, "invalid_date", "today deve avere formato YYYY-MM-DD", { field: "today" });

  return Response.json(await loadLiquidityMonth(session.user, { today: today ?? startOfDay(new Date()), accountId }));
}

export const GET = withRoute("liquidity.month", handleGet);
