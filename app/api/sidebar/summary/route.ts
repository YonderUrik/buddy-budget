import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { loadSidebarSummary } from "@/lib/sidebar/summary";

/** Riepilogo per la sidebar: patrimonio, portafoglio con posizioni, watchlist e avvisi scattati. */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  return Response.json(await loadSidebarSummary(session.user.id));
}

export const GET = withRoute("sidebar.summary", handleGet, { quietOnSuccess: true });
