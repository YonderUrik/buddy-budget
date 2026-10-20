import "server-only";
import { and, count, countDistinct, eq, gt, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { countPendingBankInterest, hasBankInterest } from "./interest";
import { bankAccountLinks, bankConnectionAttempts, bankConnections, type BankConnection } from "@/lib/db/schema/bank-connections";
import {
  ATTEMPT_WINDOW_DAYS,
  decideCapacity,
  parseCapacityLimits,
  usedSlots,
  type CapacityBlockReason,
  type CapacityLimits,
  type CapacityUsage,
  type ConnectionKind,
  type UserCapacityState,
} from "./capacity";

type Executor = Pick<typeof db, "select" | "selectDistinct">;

/** Chiave del lock che serializza le prenotazioni di un posto: due collegamenti simultanei non superano il tetto. */
const CAPACITY_LOCK = sql`select pg_advisory_xact_lock(73519, 1)`;

/** Limiti in vigore, letti dall'ambiente a ogni chiamata (cambiano col Secret, senza nuovo deploy dell'immagine). */
export function currentCapacityLimits(): CapacityLimits {
  return parseCapacityLimits(process.env);
}

function windowStart(now: Date): Date {
  return new Date(now.getTime() - ATTEMPT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/** Posti usati in tutta l'app: requisition vive e consensi avviati nella finestra. */
export async function loadCapacityUsage(executor: Executor = db, now = new Date()): Promise<CapacityUsage> {
  const [[live], [recent]] = await Promise.all([
    executor.select({ n: count() }).from(bankConnections).where(isNotNull(bankConnections.requisitionId)),
    executor.select({ n: count() }).from(bankConnectionAttempts).where(gt(bankConnectionAttempts.createdAt, windowStart(now))),
  ]);
  return { live: live.n, recent: recent.n };
}

/** Banche collegate (con almeno un conto) e consensi recenti dell'utente. */
export async function loadUserCapacity(userId: string, executor: Executor = db, now = new Date()): Promise<UserCapacityState> {
  const [linked, [attempts]] = await Promise.all([
    executor
      .selectDistinct({ institutionId: bankConnections.institutionId })
      .from(bankConnections)
      .innerJoin(bankAccountLinks, eq(bankAccountLinks.connectionId, bankConnections.id))
      .where(eq(bankConnections.userId, userId)),
    executor
      .select({ n: count() })
      .from(bankConnectionAttempts)
      .where(and(eq(bankConnectionAttempts.userId, userId), gt(bankConnectionAttempts.createdAt, windowStart(now)))),
  ]);
  return { linkedInstitutionIds: linked.map((row) => row.institutionId), recentAttempts: attempts.n };
}

export interface CapacityStatus {
  /** Se l'utente può collegare una banca nuova adesso. */
  canConnectNew: boolean;
  reason: CapacityBlockReason | null;
  /** Banche già collegate: per queste il rinnovo resta possibile anche a posti finiti (fino al limite del piano). */
  renewableInstitutionIds: string[];
  /** Whether the person already asked to be told when new connections open («Tienimi aggiornato»). */
  interested: boolean;
}

/** Stato per l'interfaccia: il pulsante «Collega la tua banca» e il rinnovo. Nessun numero globale esce verso il client. */
export async function getCapacityStatus(userId: string, now = new Date()): Promise<CapacityStatus> {
  const limits = currentCapacityLimits();
  const [user, usage, interested] = await Promise.all([loadUserCapacity(userId, db, now), loadCapacityUsage(db, now), hasBankInterest(userId)]);
  const decision = decideCapacity(user, usage, limits);
  return {
    canConnectNew: decision.allowed,
    reason: decision.allowed ? null : decision.reason,
    renewableInstitutionIds: [...new Set(user.linkedInstitutionIds)],
    interested,
  };
}

export type ReserveResult =
  | { ok: true; connection: BankConnection; kind: ConnectionKind; used: number; limits: CapacityLimits }
  | { ok: false; reason: CapacityBlockReason; kind: ConnectionKind; used: number; limits: CapacityLimits };

/**
 * Prenota un posto e crea la connessione `pending` nella stessa transazione, sotto un lock globale: conteggio,
 * decisione e scrittura sono atomici, quindi N richieste simultanee non superano mai il tetto.
 * Il consenso registrato in `bank_connection_attempts` resta anche se la connessione verrà eliminata.
 */
export async function reserveConnectionSlot(input: {
  userId: string;
  institutionId: string;
  institutionName: string;
  now?: Date;
}): Promise<ReserveResult> {
  const now = input.now ?? new Date();
  const limits = currentCapacityLimits();
  return db.transaction(async (tx) => {
    await tx.execute(CAPACITY_LOCK);
    const [user, usage] = await Promise.all([loadUserCapacity(input.userId, tx, now), loadCapacityUsage(tx, now)]);
    const used = usedSlots(usage);
    const decision = decideCapacity(user, usage, limits, input.institutionId);
    if (!decision.allowed) return { ok: false, reason: decision.reason, kind: decision.kind, used, limits };

    const [connection] = await tx
      .insert(bankConnections)
      .values({ userId: input.userId, institutionId: input.institutionId, institutionName: input.institutionName, status: "pending" })
      .returning();
    await tx.insert(bankConnectionAttempts).values({ userId: input.userId, createdAt: now });
    return { ok: true, connection, kind: decision.kind, used: used + 1, limits };
  });
}

export interface CapacitySnapshot extends CapacityUsage {
  limits: CapacityLimits;
  /** Utenti con più banche collegate del limite per utente (collegate prima del limite: le tengono). */
  usersOverLimit: number;
  /** People waiting for new connections to open. */
  interested: number;
}

/** Numeri per le metriche: posti usati, limiti e utenti oltre il limite per utente. */
export async function readCapacitySnapshot(now = new Date()): Promise<CapacitySnapshot> {
  const limits = currentCapacityLimits();
  const usage = await loadCapacityUsage(db, now);
  const perUser = db
    .select({ userId: bankConnections.userId, banks: countDistinct(bankConnections.institutionId).as("banks") })
    .from(bankConnections)
    .innerJoin(bankAccountLinks, eq(bankAccountLinks.connectionId, bankConnections.id))
    .groupBy(bankConnections.userId)
    .as("per_user");
  const [[over], interested] = await Promise.all([db.select({ n: count() }).from(perUser).where(gt(perUser.banks, limits.perUser)), countPendingBankInterest()]);
  return { ...usage, limits, usersOverLimit: over.n, interested };
}

/** Registro dei consensi più vecchio del doppio della finestra: non serve più al conteggio e si elimina. */
export async function purgeOldAttempts(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 2 * ATTEMPT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const deleted = await db.delete(bankConnectionAttempts).where(lt(bankConnectionAttempts.createdAt, cutoff)).returning({ id: bankConnectionAttempts.id });
  return deleted.length;
}
