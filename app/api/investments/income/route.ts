import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withCountryGuard } from "@/lib/localization/guard";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { parseInvestmentsQuery } from "@/lib/views/investments-query";
import { loadInvestmentsIncome } from "@/lib/views/server";

export const maxDuration = 60;

/**
 * GET /api/investments/income?excludeBrokers&today — Proventi (Italy) computed on the server (gaps.md G8):
 * `buildIncomeView` (history, income to record, 12-month forecast, by month, by instrument). Germany: 403
 * `country_feature_unavailable` (its income section is the financial plan, `GET /api/financial-planning`).
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const query = parseInvestmentsQuery(request);
  if (query instanceof Response) return query;
  return Response.json(await loadInvestmentsIncome(session.user.id, query));
}

export const GET = withRoute("investments.income", withCountryGuard(handleGet));
