import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { startOfDay } from "@/lib/calc/expenses";
import { apiError } from "@/lib/http";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { parseDateParam, parseExpensePeriod, parseTodayParam } from "@/lib/views";
import { loadLiquidityAnalysis } from "@/lib/views/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/liquidity/analysis?period=mese&ref=YYYY-MM-DD&accountId=&today=YYYY-MM-DD — Liquidità · Analisi computed on
 * the server (gaps.md G6): period spend against the period before, cumulative curve and typical month, spend by group
 * and category with budgets scaled to the period, income sources, accumulated savings and the sentence. `ref` is any
 * day inside the period on screen (default: today).
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const params = request.nextUrl.searchParams;
  const period = parseExpensePeriod(params.get("period"), "mese");
  if (!period) return apiError(400, "invalid_period", "period deve essere uno tra settimana, mese, 3mesi, anno", { field: "period" });
  const accountId = params.get("accountId") || null;
  if (accountId && !UUID.test(accountId)) return apiError(400, "validation_failed", "accountId non valido", { field: "accountId" });
  const today = parseTodayParam(request);
  if (today === null) return apiError(400, "invalid_date", "today deve avere formato YYYY-MM-DD", { field: "today" });
  const ref = parseDateParam(request, "ref");
  if (ref === null) return apiError(400, "invalid_date", "ref deve avere formato YYYY-MM-DD", { field: "ref" });
  const day = today ?? startOfDay(new Date());

  return Response.json(await loadLiquidityAnalysis(session.user, { today: day, period, referenceDate: ref ?? day, accountId }));
}

export const GET = withRoute("liquidity.analysis", handleGet);
