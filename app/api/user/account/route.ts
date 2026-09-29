import { NextRequest } from "next/server";
import { sendAccountEmail } from "@/lib/account/emails";
import { deleteUserAccount, hasActiveSync } from "@/lib/account/lifecycle";
import { readJson, recentLoginRequired, sessionOrUnauthorized } from "@/lib/account/route-session";
import { requestLogger, withRoute } from "@/lib/observability";

export const maxDuration = 60;

/**
 * Elimina subito e per sempre l'account e tutti i dati. Serve un accesso recente e l'email dell'account scritta
 * per conferma; i consensi bancari vengono revocati. Le sessioni spariscono con l'utente.
 */
async function handleDelete(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const denied = recentLoginRequired(session);
  if (denied) return denied;

  const body = (await readJson(request)) as { email?: unknown } | null;
  const typed = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (typed !== session.user.email.toLowerCase()) {
    return Response.json({ error: "L'email scritta non corrisponde a quella dell'account." }, { status: 400 });
  }
  if (await hasActiveSync(session.user.id)) {
    return Response.json({ error: "C'è una sincronizzazione bancaria in corso: riprova quando è finita." }, { status: 409 });
  }

  const { email } = session.user;
  await deleteUserAccount(session.user.id);
  requestLogger().info("account.deletion.completed", { trigger: "manual" });
  await sendAccountEmail(email, "deleted", { userId: session.user.id });
  return new Response(null, { status: 204 });
}

export const DELETE = withRoute("user.account.delete", handleDelete);
