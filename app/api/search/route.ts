import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { searchEverything } from "@/lib/search/server";

/** Below this the static part (pages, settings) answers alone: one letter would match half the movements. */
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 80;

/** App-wide search over the user's own data (movements, accounts, securities, categories, subscriptions, debts, goals). */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  if (query.length < MIN_QUERY_LENGTH) return Response.json({ hits: [], moreMovements: 0, tookMs: 0 });
  const result = await searchEverything(session.user.id, query);
  requestLogger().info("search.query.completed", { count: result.hits.length, durationMs: result.tookMs });
  return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
}

export const GET = withRoute("search.query", handleGet);
