import { NextRequest } from "next/server";
import { getAppUrl } from "@/lib/env";
import { applyUnsubscribe, verifyUnsubscribeToken } from "@/lib/notifications/server";
import { requestLogger, withRoute, recordNotificationUnsubscribe } from "@/lib/observability";

/** Provenienza dichiarata dal chiamante: la pagina di disiscrizione manda `?source=page`, i client di posta (RFC 8058) no. */
function sourceOf(request: NextRequest) {
  return request.nextUrl.searchParams.get("source") === "page" ? ("page" as const) : ("one_click" as const);
}

/**
 * Disiscrizione con un clic, senza login: il token firmato nell'email dice chi e da che cosa. Serve sia al POST
 * automatico dei client di posta (`List-Unsubscribe-Post`, RFC 8058) sia al pulsante della pagina `/disiscrizione`.
 * Idempotente. Non risponde in modo diverso per utenti inesistenti: un token valido non rivela nulla.
 */
async function handlePost(request: NextRequest) {
  const payload = verifyUnsubscribeToken(request.nextUrl.searchParams.get("t"));
  if (!payload) return Response.json({ error: "Link non valido" }, { status: 400 });
  const log = requestLogger();
  try {
    await applyUnsubscribe(payload.userId, payload.scope);
  } catch (error) {
    // Utente eliminato nel frattempo: non c'è più nulla da disattivare.
    log.warn("notifications.unsubscribe.skipped", { kind: payload.scope, error });
    return Response.json({ ok: true });
  }
  recordNotificationUnsubscribe(payload.scope, sourceOf(request));
  log.info("notifications.unsubscribe.applied", { kind: payload.scope, trigger: sourceOf(request) });
  return Response.json({ ok: true });
}

/** Un GET (anteprima del link, antivirus) non disiscrive mai: porta alla pagina, dove serve un clic. */
async function handleGet(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  return Response.redirect(`${getAppUrl()}/disiscrizione?t=${encodeURIComponent(token)}`, 303);
}

export const POST = withRoute("email.unsubscribe", handlePost);
export const GET = withRoute("email.unsubscribe_redirect", handleGet);
