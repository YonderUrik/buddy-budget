import "server-only";
import { and, eq, notExists } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { logger as appLogger, recordBankRelease, type BankReleaseTrigger, type Logger } from "@/lib/observability";
import type { BankProviderId } from "./provider";
import { getBankProvider } from "./providers";

export type ReleaseTrigger = BankReleaseTrigger;

/**
 * Libera subito il posto di una connessione rimasta senza conti (conto scollegato o consenso rinnovato su una
 * nuova connessione): revoca il consenso presso il suo fornitore (già sparito = già fatto) e poi elimina la riga.
 * Non lancia mai: se il fornitore non risponde la riga resta e la pulizia giornaliera la riprende come orfana.
 * Restituisce true se la connessione è stata eliminata.
 */
export async function releaseConnectionIfUnused(
  connectionId: string,
  trigger: ReleaseTrigger,
  log: Logger = appLogger
): Promise<boolean> {
  let provider: BankProviderId = "gocardless";
  try {
    const [connection] = await db
      .select({ requisitionId: bankConnections.requisitionId, provider: bankConnections.provider })
      .from(bankConnections)
      .where(
        and(
          eq(bankConnections.id, connectionId),
          notExists(db.select({ id: bankAccountLinks.id }).from(bankAccountLinks).where(eq(bankAccountLinks.connectionId, connectionId)))
        )
      );
    if (!connection) return false;
    provider = connection.provider;

    if (connection.requisitionId) await getBankProvider(connection.provider).revokeConsent(connection.requisitionId);
    // Si elimina solo se nel frattempo non è tornato un conto (un rinnovo concorrente): altrimenti resta alla pulizia.
    const deleted = await db
      .delete(bankConnections)
      .where(
        and(
          eq(bankConnections.id, connectionId),
          notExists(db.select({ id: bankAccountLinks.id }).from(bankAccountLinks).where(eq(bankAccountLinks.connectionId, connectionId)))
        )
      )
      .returning({ id: bankConnections.id });
    recordBankRelease(provider, trigger, "released");
    log.info("bank.connection.released", { provider, connectionId, reason: trigger, deleted: deleted.length });
    return deleted.length > 0;
  } catch (error) {
    recordBankRelease(provider, trigger, "failed");
    log.warn("bank.connection.release_failed", { provider, connectionId, reason: trigger, error });
    return false;
  }
}
