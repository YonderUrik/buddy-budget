import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { parseInvestmentsQuery } from "@/lib/views/investments-query";
import { loadInvestmentsPerformance } from "@/lib/views/server";

export const maxDuration = 60;

/**
 * GET /api/investments/performance?period=3mesi&from&to&selFrom&selTo&excludeBrokers&today — the Performance tab
 * computed on the server (gaps.md G7b): returns with the chart series and per-day returns, the card's figures at each
 * chart point («inspect», so the chart only indexes into it), risk with its reading and the four heatmaps.
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const query = parseInvestmentsQuery(request);
  if (query instanceof Response) return query;
  return Response.json(await loadInvestmentsPerformance(session.user, query));
}

export const GET = withRoute("investments.performance", handleGet);
