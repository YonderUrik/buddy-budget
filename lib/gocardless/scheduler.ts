import cron from "node-cron";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { redisRateLimitStore } from "./redis-rate-limit-store";
import { syncAccountLink, type SyncableLink } from "./sync";

/** Conti collegati con sync scaduto e connessione ancora valida (non expired/error). */
export async function findDueLinks(): Promise<SyncableLink[]> {
  return db
    .select({
      linkId: bankAccountLinks.id,
      connectionId: bankAccountLinks.connectionId,
      accountId: bankAccountLinks.accountId,
      externalAccountId: bankAccountLinks.externalAccountId,
      userId: bankConnections.userId,
    })
    .from(bankAccountLinks)
    .innerJoin(bankConnections, eq(bankAccountLinks.connectionId, bankConnections.id))
    .where(and(lte(bankAccountLinks.nextSyncEligibleAt, new Date()), eq(bankConnections.status, "linked")));
}

/**
 * Sincronizza tutti i conti dovuti. Un errore su un conto (rete, 5xx GoCardless)
 * viene loggato e non deve bloccare il sync degli altri conti nello stesso tick.
 */
export async function runDueSyncs(): Promise<void> {
  const due = await findDueLinks();
  for (const link of due) {
    try {
      await syncAccountLink(link, redisRateLimitStore);
    } catch (error) {
      console.error(`Sync fallito per il conto ${link.accountId}`, error);
    }
  }
}

let started = false;

/** Avvia lo scheduler cron (ogni 12h); no-op se già avviato nel processo corrente. */
export function startGoCardlessScheduler(): void {
  if (started) return;
  started = true;
  cron.schedule("0 */12 * * *", () => {
    runDueSyncs().catch((error) => console.error("Sync GoCardless fallito", error));
  });
}
