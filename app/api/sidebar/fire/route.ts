import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { loadSidebarFire } from "@/lib/sidebar/fire";

export const maxDuration = 30;

/** Avanzamento verso il numero FIRE per la sidebar, con gli stessi dati e le stesse ipotesi di Analitiche. */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  return Response.json(await loadSidebarFire(session.user.id));
}

export const GET = withRoute("sidebar.fire", handleGet, { quietOnSuccess: true });
