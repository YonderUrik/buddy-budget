import { resolveProfile } from "@/lib/localization/config";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { GoCardlessError, createRequisition } from "@/lib/gocardless/client";
import { CAPACITY_BLOCK_MESSAGES } from "@/lib/gocardless/capacity";
import { reserveConnectionSlot } from "@/lib/gocardless/capacity-store";
import { consentExpiryFrom } from "@/lib/gocardless/connection-health";
import { gocardlessRedirectUrl } from "@/lib/gocardless/redirect";
import { createConnectionSchema } from "@/lib/validation/gocardless";
import { computeSyncEligibility } from "@/lib/gocardless/sync-eligibility";
import { rejectIfDemoActive } from "@/lib/start/demo";
import { bindRequestUser, recordGoCardlessConnect, requestLogger, withRoute } from "@/lib/observability";

async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const rows = await db
    .select({
      accountId: bankAccountLinks.accountId,
      connectionId: bankConnections.id,
      institutionName: bankConnections.institutionName,
      status: bankConnections.status,
      consentExpiresAt: bankConnections.consentExpiresAt,
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
        connectionId: row.connectionId,
        institutionName: row.institutionName,
        status: row.status,
        consentExpiresAt: row.consentExpiresAt,
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
  const demoBlock = await rejectIfDemoActive(session.user.id, resolveProfile(session.user).language);
  if (demoBlock) return demoBlock;

  const body = await request.json();
  const parsed = createConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Posto prenotato e connessione creata sotto lock: due richieste simultanee non superano mai il tetto.
  const reservation = await reserveConnectionSlot({
    userId: session.user.id,
    institutionId: parsed.data.institutionId,
    institutionName: parsed.data.institutionName,
  });
  const log = requestLogger();
  if (!reservation.ok) {
    recordGoCardlessConnect(reservation.kind, reservation.reason);
    log.info("gocardless.connection.blocked", { reason: reservation.reason, trigger: reservation.kind, count: reservation.used, total: reservation.limits.global });
    return Response.json({ error: CAPACITY_BLOCK_MESSAGES[reservation.reason], reason: reservation.reason }, { status: 409 });
  }
  const { connection } = reservation;

  const redirectUrl = gocardlessRedirectUrl();
  try {
    const requisition = await createRequisition({
      institutionId: parsed.data.institutionId,
      maxHistoricalDays: parsed.data.transactionTotalDays,
      redirectUrl,
      reference: connection.id,
      language: resolveProfile(session.user).language.toUpperCase() as "IT" | "EN" | "DE",
    });

    await db
      .update(bankConnections)
      .set({
        requisitionId: requisition.id,
        consentExpiresAt: consentExpiryFrom(new Date()),
      })
      .where(eq(bankConnections.id, connection.id));

    recordGoCardlessConnect(reservation.kind, "started");
    log.info("gocardless.connection.started", { connectionId: connection.id, trigger: reservation.kind, count: reservation.used, total: reservation.limits.global });
    return Response.json({ link: requisition.link });
  } catch (error) {
    await db.update(bankConnections).set({ status: "error" }).where(eq(bankConnections.id, connection.id));
    // 402 = GoCardless ha finito i posti del piano prima del nostro tetto: i conteggi vanno rivisti (alert).
    if (error instanceof GoCardlessError && error.status === 402) {
      recordGoCardlessConnect(reservation.kind, "provider_refused");
      log.error("gocardless.connection.provider_limit", { connectionId: connection.id, trigger: reservation.kind, count: reservation.used, error });
      return Response.json({ error: CAPACITY_BLOCK_MESSAGES.provider_limit, reason: "provider_limit" }, { status: 409 });
    }
    recordGoCardlessConnect(reservation.kind, "failed");
    log.warn("gocardless.connection.start_failed", { connectionId: connection.id, trigger: reservation.kind, error });
    return Response.json({ error: "Impossibile avviare il collegamento con la banca" }, { status: 502 });
  }
}

export const GET = withRoute("gocardless.connections.list", handleGet);
export const POST = withRoute("gocardless.connections.create", handlePost);
