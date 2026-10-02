import { NextRequest } from "next/server";
import { sessionOrUnauthorized, readJson } from "@/lib/account/route-session";
import { isValidLegalAcceptance } from "@/lib/legal";
import { recordLegalAcceptance } from "@/lib/legal/acceptance";
import { requestLogger, withRoute } from "@/lib/observability";

/** Registra l'accettazione della versione in vigore di Termini e Privacy (richiesta di nuovo quando i documenti cambiano). */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;

  const body = await readJson(request);
  if (!isValidLegalAcceptance(body)) {
    return Response.json({ error: "Per continuare accetta Termini e Privacy", code: "legal_acceptance_required" }, { status: 400 });
  }

  await recordLegalAcceptance(session.user.id);
  requestLogger().info("legal.terms.accepted", { legalVersion: body.version, trigger: "update" });
  return new Response(null, { status: 204 });
}

export const POST = withRoute("user.legal_acceptance", handlePost);
