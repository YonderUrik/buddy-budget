import { NextRequest, after } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { redisRateLimitStore } from "@/lib/gocardless/redis-rate-limit-store";
import type { SyncableLink } from "@/lib/gocardless/sync";
import { redisSyncJobStore } from "@/lib/sync-jobs/redis-store";
import { runSyncJob } from "@/lib/sync-jobs/run";
import { queuedAccount, type SyncJob, type SyncJobAccount } from "@/lib/sync-jobs/types";
import { finalizeSelectionSchema } from "@/lib/validation/gocardless";

// L'import iniziale gira in after(): su Vercel la funzione resta viva al massimo per questo tempo (secondi).
export const maxDuration = 300;

const STORE_UNAVAILABLE_MESSAGE = "Servizio temporaneamente non disponibile. Riprova tra poco.";

/**
 * Finalizza la selezione dei "Conti trovati": crea o ricollega i conti e avvia l'import iniziale
 * come job in background (tutti i conti in parallelo). Risponde subito 201 { jobId }.
 * Validazione e ownership avvengono prima di creare il job; se lo store dei job non risponde,
 * 503 prima di creare qualunque conto.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
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
    console.error("Creazione del job di import fallita", error);
    return Response.json({ error: STORE_UNAVAILABLE_MESSAGE }, { status: 503 });
  }

  // Seconda passata: scritture.
  const created: { link: SyncableLink; name: string }[] = [];
  for (const selection of parsed.data.selections) {
    if (selection.mode === "existing" && selection.existingAccountId) {
      const [updatedLink] = await db
        .update(bankAccountLinks)
        .set({ connectionId: connection.id, externalAccountId: selection.externalAccountId })
        .where(eq(bankAccountLinks.accountId, selection.existingAccountId))
        .returning();
      if (!updatedLink) {
        return Response.json({ error: "Conto non trovato" }, { status: 404 });
      }
      created.push({
        name: existingNames.get(selection.existingAccountId) ?? selection.name,
        link: {
          linkId: updatedLink.id,
          connectionId: connection.id,
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
          accountId: account.id,
          externalAccountId: selection.externalAccountId,
          userId,
        },
      });
    }
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
    console.error(`Registrazione dei conti nel job ${job.id} fallita`, error);
  }

  // Best-effort: gli account/link sono già creati. Un fallimento del sync iniziale finisce nel job
  // come errore del conto, non fa fallire la richiesta (un retry duplicherebbe i conti "new").
  after(() => runSyncJob(job, linksToSync, { store, rateLimitStore: redisRateLimitStore }));

  return Response.json({ jobId: job.id }, { status: 201 });
}
