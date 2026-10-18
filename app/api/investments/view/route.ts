import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { parseInvestmentsQuery } from "@/lib/views/investments-query";
import { loadInvestmentsView } from "@/lib/views/server";

/** Runs the whole investments engine on the full price history, like /api/investments/overview?period=max. */
export const maxDuration = 60;

/**
 * GET /api/investments/view?period=3mesi&from&to&excludeBrokers&today — Portafoglio, Diversificazione and Operazioni
 * computed on the server (gaps.md G7): `buildInvestmentsView` plus what the cards derive (value breakdown,
 * concentration, cost scenarios, price notes, exposure and correlation reading, operation totals).
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const query = parseInvestmentsQuery(request);
  if (query instanceof Response) return query;
  return Response.json(await loadInvestmentsView(session.user, query));
}

export const GET = withRoute("investments.view", handleGet);
