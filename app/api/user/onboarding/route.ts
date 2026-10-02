import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { isSupportedCurrency } from "@/lib/validation/currency";
import { isValidLegalAcceptance } from "@/lib/legal";
import { recordLegalAcceptance } from "@/lib/legal/acceptance";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";

/** Completa l'onboarding: salva la valuta principale (solo tra quelle supportate), registra l'accettazione di Termini e Privacy e marca l'utente come onboarded. */
async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }
  bindRequestUser(session.user.id);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const currency = (body as { currency?: unknown } | null)?.currency;
  // Una valuta non ISO valida farebbe lanciare Intl.NumberFormat in ogni pagina che mostra importi.
  if (!isSupportedCurrency(currency)) {
    return Response.json({ error: "Valuta non supportata" }, { status: 400 });
  }

  const legal = (body as { legal?: unknown } | null)?.legal;
  if (!isValidLegalAcceptance(legal)) {
    return Response.json({ error: "Per continuare accetta Termini e Privacy", code: "legal_acceptance_required" }, { status: 400 });
  }

  await db
    .update(authUser)
    .set({ currency, onboardingCompleted: true })
    .where(eq(authUser.id, session.user.id));
  await recordLegalAcceptance(session.user.id);
  requestLogger().info("legal.terms.accepted", { legalVersion: legal.version, trigger: "onboarding" });

  return new Response(null, { status: 200 });
}

export const POST = withRoute("user.onboarding", handlePost);
