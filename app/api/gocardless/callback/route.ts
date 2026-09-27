import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bankConnections } from "@/lib/db/schema/bank-connections";
import { getAppUrl } from "@/lib/env";
import { getRequisition } from "@/lib/gocardless/client";
import { requestLogger, withRoute } from "@/lib/observability";

async function handleGet(request: NextRequest) {
  const appUrl = getAppUrl();
  const ref = request.nextUrl.searchParams.get("ref");
  if (!ref) {
    return Response.redirect(`${appUrl}/conti?bankError=missing_ref`, 302);
  }

  try {
    const [connection] = await db.select().from(bankConnections).where(eq(bankConnections.id, ref));
    if (!connection || !connection.requisitionId) {
      return Response.redirect(`${appUrl}/conti?bankError=not_found`, 302);
    }

    const requisition = await getRequisition(connection.requisitionId);
    if (requisition.status !== "LN") {
      await db.update(bankConnections).set({ status: "error" }).where(eq(bankConnections.id, connection.id));
      return Response.redirect(`${appUrl}/conti?bankError=consent_failed`, 302);
    }

    await db.update(bankConnections).set({ status: "linked" }).where(eq(bankConnections.id, connection.id));
    return Response.redirect(`${appUrl}/conti/collega/${connection.id}`, 302);
  } catch (error) {
    // Copre sia un ref malformato (uuid non valido → Postgres lancia) sia un fallimento
    // di GoCardless (getRequisition): l'utente torna qui dal browser della banca, quindi
    // deve sempre atterrare su un redirect leggibile, mai su una pagina di errore grezza.
    // Il ref arriva dal browser (non fidato): non lo si logga, basta il requestId.
    requestLogger().error("gocardless.callback.failed", { error });
    return Response.redirect(`${appUrl}/conti?bankError=gocardless_unavailable`, 302);
  }
}

export const GET = withRoute("gocardless.callback", handleGet);
