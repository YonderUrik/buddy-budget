import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { computeAttentionSummary } from "@/lib/attention/summary";
import { bindRequestUser, withRoute } from "@/lib/observability";

/**
 * GET /api/transactions/attention — conteggi di ciò che richiede attenzione (transazioni nuove dopo l'ultima
 * visita ai movimenti e transazioni da categorizzare). Solo query di conteggio: la legge la sidebar a ogni pagina.
 */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  return Response.json(await computeAttentionSummary(session.user.id));
}

export const GET = withRoute("transactions.attention", handleGet, { quietOnSuccess: true });
