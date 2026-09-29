import "server-only";
import { auth, type Session } from "@/lib/auth";
import { bindRequestUser } from "@/lib/observability";
import { REAUTH_REQUIRED_CODE } from "./constants";
import { isRecentLogin } from "./recent-login";

/** Sessione della richiesta (con utente legato ai log), oppure la risposta 401 da restituire. */
export async function sessionOrUnauthorized(request: Request): Promise<Session | Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  return session;
}

/** Risposta 403 per le azioni sensibili se l'accesso non è recente, altrimenti null. */
export function recentLoginRequired(session: Session, now: Date = new Date()): Response | null {
  if (isRecentLogin(new Date(session.session.createdAt), now)) return null;
  return Response.json(
    { error: "Per sicurezza accedi di nuovo prima di continuare.", code: REAUTH_REQUIRED_CODE },
    { status: 403 }
  );
}

/** Corpo JSON della richiesta, o null se non è JSON valido. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
