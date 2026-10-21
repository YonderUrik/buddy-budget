import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { startOfDay } from "@/lib/calc/expenses";
import { apiError } from "@/lib/http";
import { withCountryGuard } from "@/lib/localization/guard";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { parseTodayParam } from "@/lib/views";
import { loadAnalyticsView } from "@/lib/views/server";

/** Runs the investments engine on the full history, like /api/investments/overview?period=max. */
export const maxDuration = 60;

/**
 * GET /api/analytics/base?today=YYYY-MM-DD — Analitiche (Italy) in one call instead of eight (gaps.md G9): data base,
 * assumptions in use and as saved, expected-return source, FIRE plan, growth split and timeline of the saved plan.
 * Germany: 403 `country_feature_unavailable`, like every `/api/analytics` route.
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const today = parseTodayParam(request);
  if (today === null) return apiError(400, "invalid_date", "today deve avere formato YYYY-MM-DD", { field: "today" });
  return Response.json(await loadAnalyticsView(session.user, { today: today ?? startOfDay(new Date()) }));
}

export const GET = withRoute("analytics.base", withCountryGuard(handleGet));
