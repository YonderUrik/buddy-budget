import { computeConnectionHealth } from "./connection-health";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Criteri della pulizia: tutti i periodi di grazia in giorni, volutamente larghi (eliminare su GoCardless è irreversibile). */
export interface CleanupPolicy {
  /** Tentativo di collegamento (pending/error) mai completato: da quanti giorni dalla creazione. */
  abandonedGraceDays: number;
  /** Connessione senza più conti collegati: da quanti giorni dalla prima volta che la pulizia l'ha vista così. */
  orphanGraceDays: number;
  /** Connessione scaduta con conti ancora in app: da quanti giorni dalla scadenza. */
  expiredGraceDays: number;
  /** Requisition/agreement su GoCardless che non risultano a DB: da quanti giorni dalla creazione. */
  unknownGraceDays: number;
}

export const DEFAULT_CLEANUP_POLICY: CleanupPolicy = {
  abandonedGraceDays: 3,
  orphanGraceDays: 7,
  expiredGraceDays: 30,
  unknownGraceDays: 30,
};

/** Tetto di eliminazioni su GoCardless per esecuzione: un errore di criterio non svuota l'account in un colpo. */
export const MAX_DELETIONS_PER_RUN = 25;

export interface CleanupConnection {
  id: string;
  status: "pending" | "linked" | "expired" | "error";
  requisitionId: string | null;
  consentExpiresAt: Date | null;
  createdAt: Date;
  orphanedAt: Date | null;
  linkCount: number;
  /** Utente con eliminazione programmata: la disattivazione è reversibile, quindi non si tocca nulla. */
  userDeactivated: boolean;
}

export type ConnectionCleanupKind = "abandoned_attempt" | "orphan_connection" | "expired_connection";

export interface ConnectionCleanupAction {
  connectionId: string;
  kind: ConnectionCleanupKind;
  /** Requisition da eliminare su GoCardless (null: tentativo fallito prima ancora di crearla). */
  requisitionId: string | null;
  /** Se eliminare anche la riga a DB (non ha più conti) oppure tenerla e azzerare solo la requisition. */
  deleteRow: boolean;
}

export interface ConnectionCleanupPlan {
  actions: ConnectionCleanupAction[];
  /** Connessioni senza conti viste per la prima volta: si segna l'inizio del periodo di grazia. */
  markOrphaned: string[];
  /** Connessioni segnate come orfane che hanno di nuovo dei conti: si azzera il segno. */
  clearOrphaned: string[];
}

function olderThan(date: Date, days: number, now: Date): boolean {
  return now.getTime() - date.getTime() > days * DAY_MS;
}

/**
 * Decide cosa fare di ogni connessione. Pura: nessuna chiamata di rete né di DB.
 * Tre casi, tutti con periodo di grazia: tentativi mai completati, connessioni senza conti
 * (rinnovate o con conto eliminato), connessioni scadute da tempo. Tutto il resto resta com'è.
 */
export function planConnectionCleanup(
  connections: CleanupConnection[],
  now: Date,
  policy: CleanupPolicy = DEFAULT_CLEANUP_POLICY
): ConnectionCleanupPlan {
  const plan: ConnectionCleanupPlan = { actions: [], markOrphaned: [], clearOrphaned: [] };

  for (const connection of connections) {
    if (connection.userDeactivated) continue;

    if (connection.linkCount > 0 && connection.orphanedAt) plan.clearOrphaned.push(connection.id);

    if (connection.status === "pending" || connection.status === "error") {
      if (connection.linkCount === 0 && olderThan(connection.createdAt, policy.abandonedGraceDays, now)) {
        plan.actions.push({
          connectionId: connection.id,
          kind: "abandoned_attempt",
          requisitionId: connection.requisitionId,
          deleteRow: true,
        });
      }
      continue;
    }

    if (connection.linkCount === 0) {
      if (!connection.orphanedAt) {
        plan.markOrphaned.push(connection.id);
      } else if (olderThan(connection.orphanedAt, policy.orphanGraceDays, now)) {
        plan.actions.push({
          connectionId: connection.id,
          kind: "orphan_connection",
          requisitionId: connection.requisitionId,
          deleteRow: true,
        });
      }
      continue;
    }

    const health = computeConnectionHealth(connection, now);
    if (health.state === "expired" && connection.requisitionId) {
      // Senza data di scadenza si parte dalla creazione + durata massima del consenso (90 giorni).
      const expiredSince = connection.consentExpiresAt ?? new Date(connection.createdAt.getTime() + 90 * DAY_MS);
      if (olderThan(expiredSince, policy.expiredGraceDays, now)) {
        plan.actions.push({
          connectionId: connection.id,
          kind: "expired_connection",
          requisitionId: connection.requisitionId,
          deleteRow: false,
        });
      }
    }
  }
  return plan;
}

export interface RemoteSweepInput {
  requisitions: { id: string; created: string; status: string; agreement?: string }[];
  agreements: { id: string; created: string }[];
  /** Id delle requisition che l'app conosce (colonna `requisition_id`). */
  knownRequisitionIds: Set<string>;
}

export interface RemoteSweepPlan {
  /** Requisition su GoCardless senza riga a DB, mai collegate (stato diverso da LN) e vecchie. */
  requisitionIds: string[];
  /** Agreement non referenziati da nessuna requisition (rimasti dopo una creazione fallita a metà). */
  agreementIds: string[];
  /** Requisition sconosciute ma in stato LN (consenso dato): solo segnalate, mai eliminate. */
  linkedUnknown: number;
}

/**
 * Cosa c'è su GoCardless che l'app non conosce. Se l'app non conosce NESSUNA requisition (DB vuoto,
 * ripristino sbagliato, ambiente che condivide l'account) non si propone nulla: meglio non fare niente.
 */
export function planRemoteSweep(input: RemoteSweepInput, now: Date, policy: CleanupPolicy = DEFAULT_CLEANUP_POLICY): RemoteSweepPlan {
  const empty: RemoteSweepPlan = { requisitionIds: [], agreementIds: [], linkedUnknown: 0 };
  if (input.knownRequisitionIds.size === 0) return empty;

  const requisitionIds: string[] = [];
  let linkedUnknown = 0;
  for (const requisition of input.requisitions) {
    if (input.knownRequisitionIds.has(requisition.id)) continue;
    if (!olderThan(new Date(requisition.created), policy.unknownGraceDays, now)) continue;
    if (requisition.status === "LN") linkedUnknown += 1;
    else requisitionIds.push(requisition.id);
  }

  // Un agreement è "in uso" se qualunque requisition (anche sconosciuta) lo cita: eliminare la requisition porta via il suo.
  const referenced = new Set(input.requisitions.map((requisition) => requisition.agreement).filter(Boolean));
  const agreementIds = input.agreements
    .filter((agreement) => !referenced.has(agreement.id) && olderThan(new Date(agreement.created), policy.unknownGraceDays, now))
    .map((agreement) => agreement.id);

  return { requisitionIds, agreementIds, linkedUnknown };
}
