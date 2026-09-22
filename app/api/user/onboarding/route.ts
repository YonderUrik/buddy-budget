import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { isSupportedCurrency } from "@/lib/validation/currency";

/** Completa l'onboarding: salva la valuta principale (solo tra quelle supportate) e marca l'utente come onboarded. */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

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

  await db
    .update(authUser)
    .set({ currency, onboardingCompleted: true })
    .where(eq(authUser.id, session.user.id));

  return new Response(null, { status: 200 });
}
