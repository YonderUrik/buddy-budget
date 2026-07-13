import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bankConnections } from "@/lib/db/schema/bank-connections";
import { getRequisition } from "@/lib/gocardless/client";

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const ref = request.nextUrl.searchParams.get("ref");
  if (!ref) {
    return Response.redirect(`${appUrl}/conti?bankError=missing_ref`, 302);
  }

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
}
