import { resolveProfile } from "@/lib/localization/config";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { bankConnections } from "@/lib/db/schema/bank-connections";
import { GoCardlessError, createRequisition } from "@/lib/gocardless/client";
import { CAPACITY_BLOCK_MESSAGES } from "@/lib/gocardless/capacity";
import { reserveConnectionSlot } from "@/lib/gocardless/capacity-store";
import { consentExpiryFrom } from "@/lib/gocardless/connection-health";
import { gocardlessRedirectUrl } from "@/lib/gocardless/redirect";
import { createConnectionSchema } from "@/lib/validation/gocardless";
import { apiError, validationError } from "@/lib/http";
import { loadGoCardlessStatuses } from "@/lib/views/server";
import { rejectIfDemoActive } from "@/lib/start/demo";
import { bindRequestUser, recordGoCardlessConnect, requestLogger, withRoute } from "@/lib/observability";

async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  return Response.json(await loadGoCardlessStatuses(session.user.id, new Date()));
}

async function handlePost(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const demoBlock = await rejectIfDemoActive(session.user.id, resolveProfile(session.user).language);
  if (demoBlock) return demoBlock;

  const body: unknown = await request.json().catch(() => null);
  const parsed = createConnectionSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

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
    return apiError(409, "bank_capacity_reached", CAPACITY_BLOCK_MESSAGES[reservation.reason], { reason: reservation.reason });
  }
  const { connection } = reservation;

  // Native apps get the public return that hands the browser back to the app; the requisition's `reference` is the
  // connection id, owned by this user, so completing it later (`…/complete`) needs the same user's session.
  const client = parsed.data.client;
  const redirectUrl = gocardlessRedirectUrl(client);
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
    log.info("gocardless.connection.started", { connectionId: connection.id, trigger: reservation.kind, count: reservation.used, total: reservation.limits.global, kind: client });
    return Response.json({ link: requisition.link, connectionId: connection.id, client });
  } catch (error) {
    await db.update(bankConnections).set({ status: "error" }).where(eq(bankConnections.id, connection.id));
    // 402 = GoCardless ha finito i posti del piano prima del nostro tetto: i conteggi vanno rivisti (alert).
    if (error instanceof GoCardlessError && error.status === 402) {
      recordGoCardlessConnect(reservation.kind, "provider_refused");
      log.error("gocardless.connection.provider_limit", { connectionId: connection.id, trigger: reservation.kind, count: reservation.used, error });
      return apiError(409, "bank_capacity_reached", CAPACITY_BLOCK_MESSAGES.provider_limit, { reason: "provider_limit" });
    }
    recordGoCardlessConnect(reservation.kind, "failed");
    log.warn("gocardless.connection.start_failed", { connectionId: connection.id, trigger: reservation.kind, error });
    return apiError(502, "bank_unavailable", "Impossibile avviare il collegamento con la banca");
  }
}

export const GET = withRoute("gocardless.connections.list", handleGet);
export const POST = withRoute("gocardless.connections.create", handlePost);
