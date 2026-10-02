import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { loadUserPension } from "@/lib/pension/data";
import { bindRequestUser, withRoute } from "@/lib/observability";

/** Fondi di previdenza dell'utente con le loro fotografie: la usano tutte le schede di Pensione. */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  return Response.json(await loadUserPension(session.user.id));
}

export const GET = withRoute("pension.list", handleGet);
