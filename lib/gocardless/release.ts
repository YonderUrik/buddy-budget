import "server-only";
import { and, eq, notExists } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { logger as appLogger, recordGoCardlessRelease, type GoCardlessReleaseTrigger, type Logger } from "@/lib/observability";
import { deleteRequisition } from "./client";

export type ReleaseTrigger = GoCardlessReleaseTrigger;

/**
 * Libera subito il posto di una connessione rimasta senza conti (conto scollegato o consenso rinnovato su una
 * nuova connessione): elimina la requisition su GoCardless (revoca il consenso, 404 = già fatto) e poi la riga.
 * Non lancia mai: se GoCardless non risponde la riga resta e la pulizia giornaliera la riprende come orfana.
 * Restituisce true se la connessione è stata eliminata.
 */
export async function releaseConnectionIfUnused(
  connectionId: string,
  trigger: ReleaseTrigger,
  log: Logger = appLogger
): Promise<boolean> {
  try {
    const [connection] = await db
      .select({ requisitionId: bankConnections.requisitionId })
      .from(bankConnections)
      .where(
        and(
          eq(bankConnections.id, connectionId),
          notExists(db.select({ id: bankAccountLinks.id }).from(bankAccountLinks).where(eq(bankAccountLinks.connectionId, connectionId)))
        )
      );
    if (!connection) return false;

    if (connection.requisitionId) await deleteRequisition(connection.requisitionId);
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
    recordGoCardlessRelease(trigger, "released");
    log.info("gocardless.connection.released", { connectionId, reason: trigger, deleted: deleted.length });
    return deleted.length > 0;
  } catch (error) {
    recordGoCardlessRelease(trigger, "failed");
    log.warn("gocardless.connection.release_failed", { connectionId, reason: trigger, error });
    return false;
  }
}
