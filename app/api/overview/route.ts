import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { startOfDay } from "@/lib/calc/expenses";
import { apiError } from "@/lib/http";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { OVERVIEW_DEFAULT_PERIOD, parseNetWorthPeriod, parseTodayParam } from "@/lib/views";
import { loadOverviewView } from "@/lib/views/server";

/** The investments engine runs on every call (as on the web page): same budget as /api/investments/overview. */
export const maxDuration = 60;

/**
 * GET /api/overview?period=3mesi&includePension=1&today=YYYY-MM-DD — the Overview (Panoramica) computed on the server
 * with the web's own functions (gaps.md G2): net-worth series and change, today's value by class, composition, month
 * pace, voice sentences, investments/pension/debts summaries and bank renewal alerts. Goals, «Primi passi» and
 * what's new stay separate calls (`/api/goals`, `/api/start`).
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const params = request.nextUrl.searchParams;
  const period = parseNetWorthPeriod(params.get("period"), OVERVIEW_DEFAULT_PERIOD);
  if (!period) return apiError(400, "invalid_period", "period deve essere uno tra 1mese, 3mesi, 1anno, max", { field: "period" });
  const today = parseTodayParam(request);
  if (today === null) return apiError(400, "invalid_date", "today deve avere formato YYYY-MM-DD", { field: "today" });
  const includePension = params.get("includePension") !== "0";

  return Response.json(await loadOverviewView(session.user, { today: today ?? startOfDay(new Date()), period, includePension }));
}

export const GET = withRoute("overview.view", handleGet);
