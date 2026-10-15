import "server-only";
import { and, count, countDistinct, eq, gt, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
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
import type { BankProviderId } from "./provider";
import { providerForNewConnections } from "./providers";

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

/** Posti usati presso un fornitore: consensi vivi e consensi avviati nella finestra (i posti di un fornitore non valgono per l'altro). */
export async function loadCapacityUsage(executor: Executor = db, now = new Date(), provider: BankProviderId = providerForNewConnections()): Promise<CapacityUsage> {
  const [[live], [recent]] = await Promise.all([
    executor
      .select({ n: count() })
      .from(bankConnections)
      .where(and(isNotNull(bankConnections.requisitionId), eq(bankConnections.provider, provider))),
    executor
      .select({ n: count() })
      .from(bankConnectionAttempts)
      .where(and(gt(bankConnectionAttempts.createdAt, windowStart(now)), eq(bankConnectionAttempts.provider, provider))),
  ]);
  return { live: live.n, recent: recent.n };
}

/**
 * Banche collegate (con almeno un conto) presso il fornitore in uso e consensi recenti dell'utente (di ogni fornitore).
 * Una banca collegata con un altro fornitore non conta nel limite per utente: chi passa da GoCardless a Enable Banking
 * ricollega la sua banca senza essere bloccato dal limite di una banca a testa.
 */
export async function loadUserCapacity(
  userId: string,
  executor: Executor = db,
  now = new Date(),
  provider: BankProviderId = providerForNewConnections()
): Promise<UserCapacityState> {
  const [linked, [attempts]] = await Promise.all([
    executor
      .selectDistinct({ institutionId: bankConnections.institutionId })
      .from(bankConnections)
      .innerJoin(bankAccountLinks, eq(bankAccountLinks.connectionId, bankConnections.id))
      .where(and(eq(bankConnections.userId, userId), eq(bankConnections.provider, provider))),
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
}

/** Stato per l'interfaccia: il pulsante «Collega la tua banca» e il rinnovo. Nessun numero globale esce verso il client. */
export async function getCapacityStatus(userId: string, now = new Date()): Promise<CapacityStatus> {
  const limits = currentCapacityLimits();
  const provider = providerForNewConnections();
  const [user, usage] = await Promise.all([loadUserCapacity(userId, db, now, provider), loadCapacityUsage(db, now, provider)]);
  const decision = decideCapacity(user, usage, limits);
  return {
    canConnectNew: decision.allowed,
    reason: decision.allowed ? null : decision.reason,
    renewableInstitutionIds: [...new Set(user.linkedInstitutionIds)],
  };
}

export type ReserveResult =
  | { ok: true; connection: BankConnection; kind: ConnectionKind; used: number; limits: CapacityLimits; provider: BankProviderId }
  | { ok: false; reason: CapacityBlockReason; kind: ConnectionKind; used: number; limits: CapacityLimits; provider: BankProviderId };

/**
 * Prenota un posto e crea la connessione `pending` nella stessa transazione, sotto un lock globale: conteggio,
 * decisione e scrittura sono atomici, quindi N richieste simultanee non superano mai il tetto.
 * Il consenso registrato in `bank_connection_attempts` resta anche se la connessione verrà eliminata.
 */
export async function reserveConnectionSlot(input: {
  userId: string;
  institutionId: string;
  institutionName: string;
  provider?: BankProviderId;
  now?: Date;
}): Promise<ReserveResult> {
  const now = input.now ?? new Date();
  const limits = currentCapacityLimits();
  const provider = input.provider ?? providerForNewConnections();
  return db.transaction(async (tx) => {
    await tx.execute(CAPACITY_LOCK);
    const [user, usage] = await Promise.all([loadUserCapacity(input.userId, tx, now, provider), loadCapacityUsage(tx, now, provider)]);
    const used = usedSlots(usage);
    const decision = decideCapacity(user, usage, limits, input.institutionId);
    if (!decision.allowed) return { ok: false, reason: decision.reason, kind: decision.kind, used, limits, provider };

    const [connection] = await tx
      .insert(bankConnections)
      .values({ userId: input.userId, provider, institutionId: input.institutionId, institutionName: input.institutionName, status: "pending" })
      .returning();
    await tx.insert(bankConnectionAttempts).values({ userId: input.userId, provider, createdAt: now });
    return { ok: true, connection, kind: decision.kind, used: used + 1, limits, provider };
  });
}

export interface CapacitySnapshot extends CapacityUsage {
  /** Fornitore dei collegamenti nuovi, a cui si riferiscono i posti. */
  provider: BankProviderId;
  limits: CapacityLimits;
  /** Utenti con più banche collegate del limite per utente (collegate prima del limite: le tengono). */
  usersOverLimit: number;
}

/** Numeri per le metriche: posti usati, limiti e utenti oltre il limite per utente. */
export async function readCapacitySnapshot(now = new Date()): Promise<CapacitySnapshot> {
  const limits = currentCapacityLimits();
  const provider = providerForNewConnections();
  const usage = await loadCapacityUsage(db, now, provider);
  const perUser = db
    .select({ userId: bankConnections.userId, banks: countDistinct(bankConnections.institutionId).as("banks") })
    .from(bankConnections)
    .innerJoin(bankAccountLinks, eq(bankAccountLinks.connectionId, bankConnections.id))
    .groupBy(bankConnections.userId)
    .as("per_user");
  const [over] = await db.select({ n: count() }).from(perUser).where(gt(perUser.banks, limits.perUser));
  return { ...usage, provider, limits, usersOverLimit: over.n };
}

/** Registro dei consensi più vecchio del doppio della finestra: non serve più al conteggio e si elimina. */
export async function purgeOldAttempts(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 2 * ATTEMPT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const deleted = await db.delete(bankConnectionAttempts).where(lt(bankConnectionAttempts.createdAt, cutoff)).returning({ id: bankConnectionAttempts.id });
  return deleted.length;
}
