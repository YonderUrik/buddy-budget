import { NextRequest } from "next/server";
import { listUserSessions, revokeOtherSessions } from "@/lib/account/sessions";
import { sessionOrUnauthorized } from "@/lib/account/route-session";
import { withRoute } from "@/lib/observability";

/** Sessioni attive (non scadute) dell'utente, senza token né IP. */
async function handleGet(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  return Response.json(await listUserSessions(session.user.id, session.session.id));
}

/** Esce da tutti gli altri dispositivi: chiude ogni sessione tranne quella corrente. */
async function handleDelete(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const revoked = await revokeOtherSessions(session.user.id, session.session.id);
  return Response.json({ revoked });
}

export const GET = withRoute("user.sessions.list", handleGet);
export const DELETE = withRoute("user.sessions.revoke_others", handleDelete);
