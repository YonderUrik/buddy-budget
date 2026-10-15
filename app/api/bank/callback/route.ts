import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { bankConnections } from "@/lib/db/schema/bank-connections";
import { getAppUrl } from "@/lib/env";
import { getBankProvider } from "@/lib/bank-data/providers";
import { requestLogger, withRoute } from "@/lib/observability";

/**
 * Ritorno dalla banca dopo il consenso. La connessione arriva come `ref` (GoCardless, sull'URL che le abbiamo dato)
 * o come `state` (Enable Banking, insieme a `code` o `error`); il resto lo decide il fornitore della connessione.
 */
async function handleGet(request: NextRequest) {
  const appUrl = getAppUrl();
  const query = request.nextUrl.searchParams;
  const ref = query.get("ref") ?? query.get("state");
  if (!ref) {
    return Response.redirect(`${appUrl}/liquidita/conti?bankError=missing_ref`, 302);
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.redirect(`${appUrl}/login`, 302);

  const log = requestLogger();
  try {
    // Solo le connessioni dell'utente che torna dalla banca: un ref altrui non deve poterne cambiare lo stato.
    const [connection] = await db
      .select()
      .from(bankConnections)
      .where(and(eq(bankConnections.id, ref), eq(bankConnections.userId, session.user.id)));
    if (!connection) {
      return Response.redirect(`${appUrl}/liquidita/conti?bankError=not_found`, 302);
    }

    const now = new Date();
    const result = await getBankProvider(connection.provider).completeConsent({ consentId: connection.requisitionId, query, now });
    if (!result.ok) {
      await db.update(bankConnections).set({ status: "error" }).where(eq(bankConnections.id, connection.id));
      log.info("bank.callback.consent_failed", { provider: connection.provider, connectionId: connection.id, reason: result.reason });
      return Response.redirect(`${appUrl}/liquidita/conti?bankError=consent_failed`, 302);
    }

    // Il consenso dura da quando l'utente lo dà: la scadenza la dà il fornitore.
    await db
      .update(bankConnections)
      .set({ status: "linked", requisitionId: result.consentId, consentExpiresAt: result.consentExpiresAt, updatedAt: now })
      .where(eq(bankConnections.id, connection.id));
    log.info("bank.callback.linked", { provider: connection.provider, connectionId: connection.id });
    return Response.redirect(`${appUrl}/conti/collega/${connection.id}`, 302);
  } catch (error) {
    // Copre sia un ref malformato (uuid non valido → Postgres lancia) sia un fallimento del fornitore: l'utente
    // torna qui dal browser della banca, quindi deve sempre atterrare su un redirect leggibile, mai su una pagina di
    // errore grezza. Il ref arriva dal browser (non fidato): non lo si logga, basta il requestId.
    log.error("bank.callback.failed", { error });
    return Response.redirect(`${appUrl}/liquidita/conti?bankError=bank_unavailable`, 302);
  }
}

export const GET = withRoute("bank.callback", handleGet);
