import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { redisBackfillStore } from "@/lib/market-data/redis-stores";
import { bindRequestUser, withRoute } from "@/lib/observability";

/** Numero massimo di strumenti per richiesta di stato. */
const MAX_IDS = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Stato del recupero storico degli strumenti richiesti (`?ids=a,b`), per il polling della pagina Investimenti.
 * Gli strumenti sono comuni: lo stato non contiene dati di nessun utente.
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const ids = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .filter((id) => UUID.test(id))
    .slice(0, MAX_IDS);
  if (ids.length === 0) return Response.json([]);
  try {
    return Response.json(await redisBackfillStore.views(ids));
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}

export const GET = withRoute("instruments.backfill_status", handleGet, { quietOnSuccess: true });
