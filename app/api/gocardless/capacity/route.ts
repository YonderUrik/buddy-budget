import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getCapacityStatus } from "@/lib/gocardless/capacity-store";
import { bindRequestUser, withRoute } from "@/lib/observability";

/** Se l'utente può collegare una banca nuova (limite per utente e posti globali) e quali banche può solo rinnovare. */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  return Response.json(await getCapacityStatus(session.user.id));
}

export const GET = withRoute("gocardless.capacity.get", handleGet);
