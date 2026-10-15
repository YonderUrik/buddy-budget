import { resolveProfile } from "@/lib/localization/config";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { CAPACITY_BLOCK_MESSAGES } from "@/lib/bank-data/capacity";
import { reserveConnectionSlot } from "@/lib/bank-data/capacity-store";
import { BankProviderError } from "@/lib/bank-data/provider";
import { getBankProvider } from "@/lib/bank-data/providers";
import { createConnectionSchema } from "@/lib/validation/bank";
import { computeSyncEligibility } from "@/lib/bank-data/sync-eligibility";
import { rejectIfDemoActive } from "@/lib/start/demo";
import { bindRequestUser, recordBankConnect, requestLogger, withRoute } from "@/lib/observability";

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
  const demoBlock = await rejectIfDemoActive(session.user.id);
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
  const { provider } = reservation;
  if (!reservation.ok) {
    recordBankConnect(provider, reservation.kind, reservation.reason);
    log.info("bank.connection.blocked", { provider, reason: reservation.reason, trigger: reservation.kind, count: reservation.used, total: reservation.limits.global });
    return Response.json({ error: CAPACITY_BLOCK_MESSAGES[reservation.reason], reason: reservation.reason }, { status: 409 });
  }
  const { connection } = reservation;

  try {
    const consent = await getBankProvider(provider).startConsent({
      connectionId: connection.id,
      institutionId: parsed.data.institutionId,
      historyDays: parsed.data.transactionTotalDays,
      language: resolveProfile(session.user).language.toUpperCase() as "IT" | "EN" | "DE",
    });

    await db
      .update(bankConnections)
      .set({ requisitionId: consent.consentId, consentExpiresAt: consent.consentExpiresAt })
      .where(eq(bankConnections.id, connection.id));

    recordBankConnect(provider, reservation.kind, "started");
    log.info("bank.connection.started", { provider, connectionId: connection.id, trigger: reservation.kind, count: reservation.used, total: reservation.limits.global });
    return Response.json({ link: consent.link });
  } catch (error) {
    await db.update(bankConnections).set({ status: "error" }).where(eq(bankConnections.id, connection.id));
    // Il fornitore ha finito i posti del piano prima del nostro tetto (GoCardless 402): i conteggi vanno rivisti (alert).
    if (error instanceof BankProviderError && error.reason === "provider_limit") {
      recordBankConnect(provider, reservation.kind, "provider_refused");
      log.error("bank.connection.provider_limit", { provider, connectionId: connection.id, trigger: reservation.kind, count: reservation.used, error });
      return Response.json({ error: CAPACITY_BLOCK_MESSAGES.provider_limit, reason: "provider_limit" }, { status: 409 });
    }
    recordBankConnect(provider, reservation.kind, "failed");
    log.warn("bank.connection.start_failed", { provider, connectionId: connection.id, trigger: reservation.kind, error });
    return Response.json({ error: "Impossibile avviare il collegamento con la banca" }, { status: 502 });
  }
}

export const GET = withRoute("bank.connections.list", handleGet);
export const POST = withRoute("bank.connections.create", handlePost);
