import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { bankConnections } from "@/lib/db/schema/bank-connections";
import { getAppUrl } from "@/lib/env";
import { getRequisition } from "@/lib/gocardless/client";
import { findUserConnection, markConsentGranted } from "@/lib/gocardless/complete";
import { requestLogger, withRoute } from "@/lib/observability";

/**
 * Web return after bank consent: needs the session cookie of the browser coming back from the bank. Native apps use
 * `/api/gocardless/callback/native` + `POST /api/gocardless/connections/{id}/complete` instead.
 */
async function handleGet(request: NextRequest) {
  const appUrl = getAppUrl();
  const ref = request.nextUrl.searchParams.get("ref");
  if (!ref) {
    return Response.redirect(`${appUrl}/liquidita/conti?bankError=missing_ref`, 302);
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.redirect(`${appUrl}/login`, 302);

  try {
    // Only the returning user's connections: someone else's ref must not change its state.
    const connection = await findUserConnection(session.user.id, ref);
    if (!connection || !connection.requisitionId) {
      return Response.redirect(`${appUrl}/liquidita/conti?bankError=not_found`, 302);
    }

    const requisition = await getRequisition(connection.requisitionId);
    if (requisition.status !== "LN") {
      await db.update(bankConnections).set({ status: "error" }).where(eq(bankConnections.id, connection.id));
      return Response.redirect(`${appUrl}/liquidita/conti?bankError=consent_failed`, 302);
    }

    await markConsentGranted(connection.id);
    return Response.redirect(`${appUrl}/conti/collega/${connection.id}`, 302);
  } catch (error) {
    // A GoCardless failure (getRequisition): the user comes back here from the bank's browser, so they must always
    // land on a readable redirect, never on a raw error page. The ref comes from the browser (untrusted): not logged.
    requestLogger().error("gocardless.callback.failed", { error });
    return Response.redirect(`${appUrl}/liquidita/conti?bankError=gocardless_unavailable`, 302);
  }
}

export const GET = withRoute("gocardless.callback", handleGet);
