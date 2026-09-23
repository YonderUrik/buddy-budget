import { NextRequest, after } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { redisRateLimitStore } from "@/lib/gocardless/redis-rate-limit-store";
import { computeSyncEligibility } from "@/lib/gocardless/sync-eligibility";
import { redisSyncJobStore } from "@/lib/sync-jobs/redis-store";
import { runSyncJob } from "@/lib/sync-jobs/run";
import { queuedAccount, type SyncJob } from "@/lib/sync-jobs/types";

// Il sync gira in after(): su Vercel la funzione resta viva al massimo per questo tempo (secondi).
export const maxDuration = 300;

/**
 * Avvia un sync manuale di un conto collegato come job in background.
 * Ownership, eleggibilità (budget condiviso 4/giorno + gap 4h) e lock per conto restano sincroni,
 * così gli errori prevedibili arrivano come risposta HTTP: 404, 429 not-eligible, 409 already-running,
 * 503 se lo store dei job non risponde. Altrimenti crea il job e risponde subito 202 { jobId }.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });

  const { accountId } = await params;

  const [link] = await db
    .select({
      linkId: bankAccountLinks.id,
      connectionId: bankAccountLinks.connectionId,
      accountId: bankAccountLinks.accountId,
      externalAccountId: bankAccountLinks.externalAccountId,
      syncTimestamps: bankAccountLinks.syncTimestamps,
      userId: bankConnections.userId,
      accountName: accounts.name,
    })
    .from(bankAccountLinks)
    .innerJoin(bankConnections, eq(bankAccountLinks.connectionId, bankConnections.id))
    .innerJoin(accounts, eq(bankAccountLinks.accountId, accounts.id))
    .where(
      and(
        eq(bankAccountLinks.accountId, accountId),
        eq(bankConnections.userId, session.user.id),
        eq(bankConnections.status, "linked")
      )
    );

  if (!link) return Response.json({ error: "Conto non trovato o non collegato" }, { status: 404 });

  const eligibility = computeSyncEligibility(
    link.syncTimestamps.map((t) => new Date(t)),
    new Date()
  );
  if (!eligibility.eligible) {
    return Response.json(
      {
        status: "not-eligible",
        nextEligibleAt: eligibility.nextEligibleAt,
        syncsRemainingToday: eligibility.syncsRemainingToday,
      },
      { status: 429 }
    );
  }

  const store = redisSyncJobStore;
  let locked: boolean;
  try {
    locked = await store.acquireAccountLock(link.accountId);
  } catch (error) {
    console.error("Store dei job di sync non raggiungibile", error);
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
  if (!locked) return Response.json({ status: "already-running" }, { status: 409 });

  let job: SyncJob;
  try {
    job = await store.createJob({
      userId: session.user.id,
      kind: "manual-sync",
      accounts: [queuedAccount(link.accountId, link.accountName)],
    });
  } catch (error) {
    console.error("Creazione del job di sync fallita", error);
    await store.releaseAccountLock(link.accountId).catch(() => {});
    return Response.json({ status: "unavailable" }, { status: 503 });
  }

  const syncableLink = {
    linkId: link.linkId,
    connectionId: link.connectionId,
    accountId: link.accountId,
    externalAccountId: link.externalAccountId,
    userId: link.userId,
  };
  after(() => runSyncJob(job, [syncableLink], { store, rateLimitStore: redisRateLimitStore }));

  return Response.json({ jobId: job.id }, { status: 202 });
}
