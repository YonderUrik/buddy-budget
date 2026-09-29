import { NextRequest } from "next/server";
import { RESET_CONFIRMATION_WORD } from "@/lib/account/constants";
import { hasActiveSync, resetUserAccount } from "@/lib/account/lifecycle";
import { readJson, recentLoginRequired, sessionOrUnauthorized } from "@/lib/account/route-session";
import { requestLogger, withRoute } from "@/lib/observability";

export const maxDuration = 60;

/**
 * Reset completo dei dati: si riparte dall'onboarding. Serve un accesso recente, la parola di conferma e che
 * non ci sia un sync bancario in corso (scriverebbe su conti appena cancellati).
 */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const denied = recentLoginRequired(session);
  if (denied) return denied;

  const body = (await readJson(request)) as { confirmation?: unknown } | null;
  if (body?.confirmation !== RESET_CONFIRMATION_WORD) {
    return Response.json({ error: `Scrivi ${RESET_CONFIRMATION_WORD} per confermare.` }, { status: 400 });
  }
  if (await hasActiveSync(session.user.id)) {
    return Response.json({ error: "C'è una sincronizzazione bancaria in corso: riprova quando è finita." }, { status: 409 });
  }

  await resetUserAccount(session.user.id);
  requestLogger().info("account.reset.completed");
  return new Response(null, { status: 204 });
}

export const POST = withRoute("user.reset", handlePost);
