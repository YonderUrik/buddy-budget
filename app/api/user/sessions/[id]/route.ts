import { NextRequest } from "next/server";
import { revokeUserSession } from "@/lib/account/sessions";
import { sessionOrUnauthorized } from "@/lib/account/route-session";
import { withRoute } from "@/lib/observability";

/** Chiude una singola sessione dell'utente su un altro dispositivo. La corrente si chiude con "Esci". */
async function handleDelete(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const { id } = await params;
  if (id === session.session.id) {
    return Response.json({ error: "Per chiudere questa sessione usa Esci." }, { status: 400 });
  }
  const revoked = await revokeUserSession(session.user.id, id);
  return revoked ? new Response(null, { status: 204 }) : Response.json({ error: "Sessione non trovata" }, { status: 404 });
}

export const DELETE = withRoute("user.sessions.revoke", handleDelete);
