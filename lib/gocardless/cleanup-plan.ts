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
  /** Da quando la connessione risulta senza conti (serve se GoCardless dà il tentativo già collegato). */
  orphanedAt?: Date | null;
}

export interface ConnectionCleanupPlan {
  actions: ConnectionCleanupAction[];
  /** Connessioni senza conti viste per la prima volta: si segna l'inizio del periodo di grazia. */
  markOrphaned: string[];
  /** Connessioni segnate come orfane che hanno di nuovo dei conti: si azzera il segno. */
  clearOrphaned: string[];
}

export function olderThan(date: Date, days: number, now: Date): boolean {
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
          orphanedAt: connection.orphanedAt,
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
  requisitions: { id: string; created: string; status: string; agreement?: string; reference?: string; redirect?: string }[];
  agreements: { id: string; created: string }[];
  /** Id delle requisition che l'app conosce (colonna `requisition_id`). */
  knownRequisitionIds: Set<string>;
  /** Id delle connessioni a DB: la `reference` di ogni requisition creata dall'app è l'id della sua connessione. */
  knownConnectionIds?: Set<string>;
  /** The app's web return URL (`<APP_URL>/api/gocardless/callback`); the native one below it counts too: tells ours from other environments'. */
  ownRedirect?: string;
}

/** Di chi è una requisition che a DB non risulta. */
export type UnknownRequisitionOrigin =
  /** Creata da questa app, la connessione esiste ancora ma punta a un'altra requisition (salvataggio fallito, sostituita). */
  | "own_superseded"
  /** Creata da questa app, la connessione non c'è più (utente eliminato o azzerato con revoca fallita, tentativo ripulito). */
  | "own_row_gone"
  /** Né la reference né l'URL di ritorno sono nostri: un altro ambiente sullo stesso account, o creata a mano. */
  | "foreign";

export interface LinkedUnknownRequisition {
  id: string;
  origin: UnknownRequisitionOrigin;
  ageDays: number;
  /** Host dell'URL di ritorno (es. `localhost` per lo sviluppo): aiuta a capire da dove viene. */
  redirectHost: string | null;
}

export interface RemoteSweepPlan {
  /** Requisition nostre (reference o URL di ritorno), mai collegate e senza riga a DB: si eliminano dopo `abandonedGraceDays`. */
  staleRequisitionIds: string[];
  /** Requisition altrui senza riga a DB, mai collegate (stato diverso da LN) e vecchie: solo con `deleteUnknown`. */
  requisitionIds: string[];
  /** Agreement non referenziati da nessuna requisition (rimasti dopo una creazione fallita a metà). */
  agreementIds: string[];
  /** Requisition sconosciute ma in stato LN (consenso dato): mai eliminate da sole, elencate per decidere a mano. */
  linkedUnknown: LinkedUnknownRequisition[];
}

function redirectHost(redirect: string | undefined): string | null {
  if (!redirect) return null;
  try {
    return new URL(redirect).hostname;
  } catch {
    return null;
  }
}

/**
 * True when a requisition's return URL is one of ours: same origin, and the web callback path or a path below it
 * (the native return `/api/gocardless/callback/native`); query and fragment are ignored. An exact string match would
 * miss native requisitions and treat them as another environment's.
 */
export function isOwnRedirect(redirect: string | undefined, ownRedirect: string | undefined): boolean {
  if (!redirect || !ownRedirect) return false;
  try {
    const candidate = new URL(redirect);
    const own = new URL(ownRedirect);
    const ownPath = own.pathname.replace(/\/+$/, "");
    const path = candidate.pathname.replace(/\/+$/, "");
    return candidate.origin === own.origin && (path === ownPath || path.startsWith(`${ownPath}/`));
  } catch {
    return false;
  }
}

/** Origin of an unknown requisition: ours if the reference is one of our connections or the return URL is ours. */
export function unknownRequisitionOrigin(
  requisition: { reference?: string; redirect?: string },
  knownConnectionIds: Set<string>,
  ownRedirect: string | undefined
): UnknownRequisitionOrigin {
  if (requisition.reference && knownConnectionIds.has(requisition.reference)) return "own_superseded";
  if (isOwnRedirect(requisition.redirect, ownRedirect)) return "own_row_gone";
  return "foreign";
}

/**
 * Cosa c'è su GoCardless che l'app non conosce. Se l'app non conosce NESSUNA requisition (DB vuoto,
 * ripristino sbagliato) non si propone nulla: meglio non fare niente.
 * Le requisition mai collegate create da questa app sono tentativi abbandonati (grazia breve); quelle di
 * altri ambienti restano dietro `deleteUnknown` con la grazia lunga; quelle LN non si eliminano mai da sole.
 */
export function planRemoteSweep(input: RemoteSweepInput, now: Date, policy: CleanupPolicy = DEFAULT_CLEANUP_POLICY): RemoteSweepPlan {
  const plan: RemoteSweepPlan = { staleRequisitionIds: [], requisitionIds: [], agreementIds: [], linkedUnknown: [] };
  if (input.knownRequisitionIds.size === 0) return plan;
  const knownConnectionIds = input.knownConnectionIds ?? new Set<string>();

  for (const requisition of input.requisitions) {
    if (input.knownRequisitionIds.has(requisition.id)) continue;
    const created = new Date(requisition.created);
    const origin = unknownRequisitionOrigin(requisition, knownConnectionIds, input.ownRedirect);
    if (requisition.status === "LN") {
      if (olderThan(created, policy.abandonedGraceDays, now)) {
        plan.linkedUnknown.push({
          id: requisition.id,
          origin,
          ageDays: Math.floor((now.getTime() - created.getTime()) / DAY_MS),
          redirectHost: redirectHost(requisition.redirect),
        });
      }
    } else if (origin !== "foreign") {
      if (olderThan(created, policy.abandonedGraceDays, now)) plan.staleRequisitionIds.push(requisition.id);
    } else if (olderThan(created, policy.unknownGraceDays, now)) {
      plan.requisitionIds.push(requisition.id);
    }
  }

  // Un agreement è "in uso" se qualunque requisition (anche sconosciuta) lo cita: eliminare la requisition porta via il suo.
  const referenced = new Set(input.requisitions.map((requisition) => requisition.agreement).filter(Boolean));
  plan.agreementIds = input.agreements
    .filter((agreement) => !referenced.has(agreement.id) && olderThan(new Date(agreement.created), policy.unknownGraceDays, now))
    .map((agreement) => agreement.id);

  return plan;
}
