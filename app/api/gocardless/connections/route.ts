import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { getAppUrl } from "@/lib/env";
import { createRequisition } from "@/lib/gocardless/client";
import { createConnectionSchema } from "@/lib/validation/gocardless";
import { computeSyncEligibility } from "@/lib/gocardless/sync-eligibility";
import { bindRequestUser, withRoute } from "@/lib/observability";

async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const rows = await db
    .select({
      accountId: bankAccountLinks.accountId,
      status: bankConnections.status,
      lastSyncedAt: bankAccountLinks.lastSyncedAt,
      syncTimestamps: bankAccountLinks.syncTimestamps,
    })
    .from(bankAccountLinks)
    .innerJoin(bankConnections, eq(bankAccountLinks.connectionId, bankConnections.id))
    .where(eq(bankConnections.userId, session.user.id));

  const now = new Date();
  return Response.json(
    rows.map((row) => {
      const eligibility = computeSyncEligibility(
        row.syncTimestamps.map((t) => new Date(t)),
        now
      );
      return {
        accountId: row.accountId,
        status: row.status,
        lastSyncedAt: row.lastSyncedAt,
        eligible: eligibility.eligible,
        nextEligibleAt: eligibility.nextEligibleAt,
        syncsRemainingToday: eligibility.syncsRemainingToday,
      };
    })
  );
}

async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const body = await request.json();
  const parsed = createConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const [connection] = await db
    .insert(bankConnections)
    .values({
      userId: session.user.id,
      institutionId: parsed.data.institutionId,
      institutionName: parsed.data.institutionName,
      status: "pending",
    })
    .returning();

  const redirectUrl = `${getAppUrl()}/api/gocardless/callback`;
  try {
    const requisition = await createRequisition({
      institutionId: parsed.data.institutionId,
      maxHistoricalDays: parsed.data.transactionTotalDays,
      redirectUrl,
      reference: connection.id,
    });

    await db
      .update(bankConnections)
      .set({
        requisitionId: requisition.id,
        consentExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      })
      .where(eq(bankConnections.id, connection.id));

    return Response.json({ link: requisition.link });
  } catch {
    await db.update(bankConnections).set({ status: "error" }).where(eq(bankConnections.id, connection.id));
    return Response.json({ error: "Impossibile avviare il collegamento con la banca" }, { status: 502 });
  }
}

export const GET = withRoute("gocardless.connections.list", handleGet);
export const POST = withRoute("gocardless.connections.create", handlePost);
