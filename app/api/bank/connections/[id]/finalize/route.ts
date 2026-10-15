import { NextRequest, after } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { getBankProvider } from "@/lib/bank-data/providers";
import { releaseConnectionIfUnused } from "@/lib/bank-data/release";
import { redisRateLimitStore } from "@/lib/bank-data/redis-rate-limit-store";
import type { SyncableLink } from "@/lib/bank-data/sync";
import { redisSyncJobStore } from "@/lib/sync-jobs/redis-store";
import { runSyncJob } from "@/lib/sync-jobs/run";
import { queuedAccount, type SyncJob, type SyncJobAccount } from "@/lib/sync-jobs/types";
import { finalizeSelectionSchema } from "@/lib/validation/bank";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";
import { redisOpsStore } from "@/lib/observability/redis-ops-store";

// L'import iniziale gira in after(): su Vercel la funzione resta viva al massimo per questo tempo (secondi).
export const maxDuration = 300;

const STORE_UNAVAILABLE_MESSAGE = "Servizio temporaneamente non disponibile. Riprova tra poco.";

/**
 * Finalizza la selezione dei "Conti trovati": crea o ricollega i conti e avvia l'import iniziale
 * come job in background (tutti i conti in parallelo). Risponde subito 201 { jobId }.
 * Validazione e ownership avvengono prima di creare il job; se lo store dei job non risponde,
 * 503 prima di creare qualunque conto.
 */
async function handlePost(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const { id } = await params;
  const [connection] = await db
    .select()
    .from(bankConnections)
    .where(and(eq(bankConnections.id, id), eq(bankConnections.userId, userId)));
  if (!connection) return new Response(null, { status: 404 });

  const body = await request.json();
  const parsed = finalizeSelectionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // I conti scelti devono appartenere al consenso di questa connessione: l'id arriva dal client e il sync
  // usa le credenziali dell'applicazione, quindi senza questo controllo si potrebbe collegare un conto altrui.
  let requisitionAccounts: string[];
  try {
    if (!connection.requisitionId) return Response.json({ error: "Connessione non completata" }, { status: 400 });
    requisitionAccounts = await getBankProvider(connection.provider).listConsentAccounts(connection.requisitionId);
  } catch (error) {
    requestLogger().warn("bank.finalize.consent_failed", { provider: connection.provider, error });
    return Response.json({ error: "Banca non raggiungibile, riprova tra poco" }, { status: 502 });
  }
  if (parsed.data.selections.some((selection) => !requisitionAccounts.includes(selection.externalAccountId))) {
    return Response.json({ error: "Conto non appartenente a questa connessione" }, { status: 400 });
  }

  // Prima passata: solo verifiche, nessuna scrittura.
  const existingNames = new Map<string, string>();
  for (const selection of parsed.data.selections) {
    if (selection.mode !== "existing") continue;
    if (!selection.existingAccountId) {
      return Response.json({ error: "existingAccountId richiesto per mode 'existing'" }, { status: 400 });
    }
    // L'account selezionato deve appartenere all'utente della sessione, altrimenti un utente
    // potrebbe ricollegare (e quindi dirottare il sync) il conto "auto" di un altro utente.
    const [ownedAccount] = await db
      .select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(
        and(eq(accounts.id, selection.existingAccountId), eq(accounts.userId, userId), eq(accounts.source, "auto"))
      );
    if (!ownedAccount) {
      return Response.json({ error: "Conto non trovato" }, { status: 404 });
    }
    existingNames.set(ownedAccount.id, ownedAccount.name);
  }

  const store = redisSyncJobStore;
  let job: SyncJob;
  try {
    job = await store.createJob({ userId, kind: "initial-import" });
  } catch (error) {
    requestLogger().error("sync_job.create.failed", { error });
    return Response.json({ error: STORE_UNAVAILABLE_MESSAGE }, { status: 503 });
  }

  // Se la scrittura dei conti fallisce, il job non deve restare orfano senza conti (apparirebbe
  // come "interrotto" nel pannello dopo l'heartbeat stale) — lo si chiude subito, best-effort.
  async function abandonJob(reason: string, error?: unknown) {
    requestLogger().error("sync_job.abandoned", { jobId: job.id, reason, error });
    await store.dismissJob(userId, job.id).catch((dismissError) => {
      requestLogger().warn("sync_job.dismiss.failed", { jobId: job.id, error: dismissError });
    });
  }

  // Seconda passata: scritture.
  const created: { link: SyncableLink; name: string }[] = [];
  // Connessioni da cui i conti "existing" vengono spostati (rinnovo): se restano vuote si liberano subito.
  const previousConnectionIds = new Set<string>();
  try {
    for (const selection of parsed.data.selections) {
      if (selection.mode === "existing" && selection.existingAccountId) {
        const [previous] = await db
          .select({ connectionId: bankAccountLinks.connectionId })
          .from(bankAccountLinks)
          .where(eq(bankAccountLinks.accountId, selection.existingAccountId));
        if (previous && previous.connectionId !== connection.id) previousConnectionIds.add(previous.connectionId);
        const [updatedLink] = await db
          .update(bankAccountLinks)
          .set({ connectionId: connection.id, externalAccountId: selection.externalAccountId })
          .where(eq(bankAccountLinks.accountId, selection.existingAccountId))
          .returning();
        if (!updatedLink) {
          await abandonJob("existing_account_missing");
          return Response.json({ error: "Conto non trovato" }, { status: 404 });
        }
        created.push({
          name: existingNames.get(selection.existingAccountId) ?? selection.name,
          link: {
            linkId: updatedLink.id,
            connectionId: connection.id,
            provider: connection.provider,
            fullHistory: true,
            accountId: selection.existingAccountId,
            externalAccountId: selection.externalAccountId,
            userId,
          },
        });
      } else {
        const [account] = await db
          .insert(accounts)
          .values({ userId, name: selection.name, type: selection.type, source: "auto" })
          .returning();
        const [link] = await db
          .insert(bankAccountLinks)
          .values({ connectionId: connection.id, accountId: account.id, externalAccountId: selection.externalAccountId })
          .returning();
        created.push({
          name: account.name,
          link: {
            linkId: link.id,
            connectionId: connection.id,
            provider: connection.provider,
            fullHistory: true,
            accountId: account.id,
            externalAccountId: selection.externalAccountId,
            userId,
          },
        });
      }
    }
  } catch (error) {
    await abandonJob("accounts_write_failed", error);
    throw error;
  }

  // Un conto "existing" può avere già un sync in corso: non lo si duplica, lo si segnala nel job.
  const linksToSync: SyncableLink[] = [];
  const jobAccounts: SyncJobAccount[] = [];
  for (const { link, name } of created) {
    // Se il lock non si può leggere si procede comunque: l'import è idempotente.
    const locked = await store.acquireAccountLock(link.accountId).catch(() => true);
    if (locked) {
      linksToSync.push(link);
      jobAccounts.push(queuedAccount(link.accountId, name));
    } else {
      jobAccounts.push({ ...queuedAccount(link.accountId, name), phase: "error", errorReason: "already-running" });
    }
  }

  try {
    await store.setAccounts(userId, job.id, jobAccounts);
  } catch (error) {
    // I dati restano corretti: il sync parte comunque, il job verrà mostrato come interrotto.
    requestLogger().warn("sync_job.set_accounts.failed", { jobId: job.id, error });
  }

  // Best-effort: gli account/link sono già creati. Un fallimento del sync iniziale finisce nel job
  // come errore del conto, non fa fallire la richiesta (un retry duplicherebbe i conti "new").
  const jobLog = requestLogger();
  after(() =>
    runSyncJob(job, linksToSync, { store, rateLimitStore: redisRateLimitStore, ops: redisOpsStore, log: jobLog })
  );
  if (previousConnectionIds.size > 0) {
    after(async () => {
      for (const previousId of previousConnectionIds) await releaseConnectionIfUnused(previousId, "renewed", jobLog);
    });
  }

  return Response.json({ jobId: job.id }, { status: 201 });
}

export const POST = withRoute("bank.connections.finalize", handlePost);
