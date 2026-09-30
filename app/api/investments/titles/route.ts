import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { loadTitleList } from "@/lib/investments/titles-list";
import { bindRequestUser, withRoute } from "@/lib/observability";

/** Elenco dei titoli dell'utente (watchlist e posseduti) con ultima chiusura, variazioni e avvisi. */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  return Response.json({ items: await loadTitleList(session.user.id) });
}

export const GET = withRoute("investments.titles", handleGet);
