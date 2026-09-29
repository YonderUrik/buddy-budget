import "server-only";
import { and, count, countDistinct, eq, isNotNull, lte, ne, notExists } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authSession, authUser } from "@/lib/db/schema/auth";
import { bankConnections } from "@/lib/db/schema/bank-connections";
import { budgets } from "@/lib/db/schema/budgets";
import { categories } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import {
  instruments,
  investmentPlans,
  investmentPortfolios,
  investmentTransactions,
  userInstrumentBreakdowns,
  userInstrumentPrices,
} from "@/lib/db/schema/investments";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { transactions } from "@/lib/db/schema/transactions";
import { defaultCategoryRows } from "@/lib/categories/seed";
import { deleteRequisition } from "@/lib/gocardless/client";
import { redis } from "@/lib/redis/client";
import { redisSyncJobStore } from "@/lib/sync-jobs/redis-store";
import { toJobView } from "@/lib/sync-jobs/view";
import { DEFAULT_CURRENCY } from "@/lib/validation/currency";
import { hashUserId, logger } from "@/lib/observability";
import { DEACTIVATION_GRACE_DAYS } from "./constants";
import { DEFAULT_HOME_PAGE } from "./home-pages";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Quanti dati possiede l'utente, per il riepilogo in Impostazioni (solo conteggi). */
export interface UserDataSummary {
  accounts: number;
  bankConnections: number;
  transactions: number;
  categories: number;
  rules: number;
  budgets: number;
  investmentOperations: number;
  investmentPlans: number;
  netWorthDays: number;
}

/** Conta i dati dell'utente tabella per tabella. */
export async function countUserData(userId: string): Promise<UserDataSummary> {
  const countOf = async (query: Promise<{ value: number }[]>) => (await query)[0]?.value ?? 0;
  const [acc, conn, tx, cat, rules, bud, ops, plans, days] = await Promise.all([
    countOf(db.select({ value: count() }).from(accounts).where(eq(accounts.userId, userId))),
    countOf(db.select({ value: count() }).from(bankConnections).where(eq(bankConnections.userId, userId))),
    countOf(db.select({ value: count() }).from(transactions).where(eq(transactions.userId, userId))),
    countOf(db.select({ value: count() }).from(categories).where(eq(categories.userId, userId))),
    countOf(db.select({ value: count() }).from(categorizationRules).where(eq(categorizationRules.userId, userId))),
    countOf(db.select({ value: count() }).from(budgets).where(eq(budgets.userId, userId))),
    countOf(db.select({ value: count() }).from(investmentTransactions).where(eq(investmentTransactions.userId, userId))),
    countOf(db.select({ value: count() }).from(investmentPlans).where(eq(investmentPlans.userId, userId))),
    countOf(db.select({ value: countDistinct(netWorthSnapshots.date) }).from(netWorthSnapshots).where(eq(netWorthSnapshots.userId, userId))),
  ]);
  return {
    accounts: acc,
    bankConnections: conn,
    transactions: tx,
    categories: cat,
    rules,
    budgets: bud,
    investmentOperations: ops,
    investmentPlans: plans,
    netWorthDays: days,
  };
}

/** True se l'utente ha un import o un sync bancario in corso (non interrotto): reset ed eliminazione aspettano. */
export async function hasActiveSync(userId: string, now: Date = new Date()): Promise<boolean> {
  const jobs = await redisSyncJobStore.listJobs(userId);
  return jobs.some((job) => {
    const view = toJobView(job, now);
    return view.status === "running" && !view.interrupted;
  });
}

/**
 * Revoca su GoCardless i consensi delle connessioni bancarie dell'utente. Best effort: un errore non blocca
 * reset o eliminazione (il consenso scade comunque da solo entro 90 giorni) ma viene loggato.
 */
export async function revokeBankConsents(userId: string): Promise<{ revoked: number; failed: number }> {
  const rows = await db
    .select({ requisitionId: bankConnections.requisitionId })
    .from(bankConnections)
    .where(and(eq(bankConnections.userId, userId), isNotNull(bankConnections.requisitionId)));
  let revoked = 0;
  let failed = 0;
  for (const { requisitionId } of rows) {
    try {
      await deleteRequisition(requisitionId!);
      revoked += 1;
    } catch (error) {
      failed += 1;
      logger.warn("account.bank_consent.revoke_failed", { user: hashUserId(userId), error });
    }
  }
  return { revoked, failed };
}

/** Elimina da Redis lo stato legato all'utente (job di sync, impronta dello storico). Best effort. */
export async function clearUserRedisState(userId: string): Promise<void> {
  try {
    const keys: string[] = [`sync-jobs:${userId}`, `net-worth:investments:fingerprint:${userId}`];
    let cursor = "0";
    do {
      const [next, found] = await redis.scan(cursor, "MATCH", `sync-job:${userId}:*`, "COUNT", 200);
      keys.push(...found);
      cursor = next;
    } while (cursor !== "0");
    await redis.del(...keys);
  } catch (error) {
    logger.warn("account.redis_state.clear_failed", { user: hashUserId(userId), error });
  }
}

/** Cancella tutti i dati finanziari dell'utente, nell'ordine imposto dalle chiavi esterne. */
async function deleteFinancialData(tx: Tx, userId: string): Promise<void> {
  await tx.delete(investmentPlans).where(eq(investmentPlans.userId, userId));
  await tx.delete(investmentTransactions).where(eq(investmentTransactions.userId, userId));
  await tx.delete(investmentPortfolios).where(eq(investmentPortfolios.userId, userId));
  await tx.delete(userInstrumentPrices).where(eq(userInstrumentPrices.userId, userId));
  await tx.delete(userInstrumentBreakdowns).where(eq(userInstrumentBreakdowns.userId, userId));
  // Gli strumenti manuali sono privati di chi li crea: con la FK `set null` diventerebbero visibili a tutti.
  // Si eliminano se nessun altro li usa (prezzi e simboli vanno via in cascata).
  await tx
    .delete(instruments)
    .where(
      and(
        eq(instruments.createdByUserId, userId),
        notExists(tx.select({ id: investmentTransactions.id }).from(investmentTransactions).where(eq(investmentTransactions.instrumentId, instruments.id))),
        notExists(tx.select({ id: investmentPlans.id }).from(investmentPlans).where(eq(investmentPlans.instrumentId, instruments.id)))
      )
    );
  await tx.delete(netWorthSnapshots).where(eq(netWorthSnapshots.userId, userId));
  await tx.delete(transactions).where(eq(transactions.userId, userId));
  await tx.delete(budgets).where(eq(budgets.userId, userId));
  await tx.delete(categorizationRules).where(eq(categorizationRules.userId, userId));
  // I link conto↔banca spariscono in cascata con la connessione e con il conto.
  await tx.delete(bankConnections).where(eq(bankConnections.userId, userId));
  await tx.delete(accounts).where(eq(accounts.userId, userId));
  await tx.delete(categories).where(eq(categories.userId, userId));
}

/**
 * Reset completo: l'utente torna allo stato di chi si è appena registrato. Restano solo account, nome, email,
 * metodi di accesso e sessioni; tutti i dati e le preferenze tornano ai default e si ripassa dall'onboarding.
 */
export async function resetUserAccount(userId: string): Promise<void> {
  await revokeBankConsents(userId);
  await db.transaction(async (tx) => {
    await deleteFinancialData(tx, userId);
    await tx.insert(categories).values(defaultCategoryRows(userId));
    await tx
      .update(authUser)
      .set({ onboardingCompleted: false, currency: DEFAULT_CURRENCY, homePage: DEFAULT_HOME_PAGE, updatedAt: new Date() })
      .where(eq(authUser.id, userId));
  });
  await clearUserRedisState(userId);
}

/**
 * Eliminazione definitiva: revoca i consensi bancari, poi cancella l'utente (tutte le tabelle sono in cascata,
 * sessioni comprese) e lo stato su Redis. Gli strumenti di mercato comuni restano; quelli manuali dell'utente no.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  await revokeBankConsents(userId);
  // Transazione esplicita: stesso esito della cascata, ma le righe con FK senza cascata (transazioni→categorie)
  // vanno via prima, così l'ordine non dipende da come Postgres risolve la cascata.
  await db.transaction(async (tx) => {
    await deleteFinancialData(tx, userId);
    await tx.delete(authUser).where(eq(authUser.id, userId));
  });
  await clearUserRedisState(userId);
}

/** Data di eliminazione definitiva per una disattivazione fatta ora. */
export function deletionDateFrom(now: Date): Date {
  return new Date(now.getTime() + DEACTIVATION_GRACE_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Disattiva l'account: fissa la data di eliminazione e chiude tutte le altre sessioni. La sessione corrente resta,
 * ma il proxy la manda sulla pagina "account disattivato" finché non si riattiva o si esce.
 */
export async function scheduleAccountDeletion(userId: string, currentSessionId: string, now: Date = new Date()): Promise<Date> {
  const deletionAt = deletionDateFrom(now);
  await db.transaction(async (tx) => {
    await tx.update(authUser).set({ deletionScheduledAt: deletionAt, updatedAt: now }).where(eq(authUser.id, userId));
    await tx.delete(authSession).where(and(eq(authSession.userId, userId), ne(authSession.id, currentSessionId)));
  });
  return deletionAt;
}

/** Annulla la disattivazione (riattivazione entro il periodo di ripensamento). */
export async function cancelAccountDeletion(userId: string): Promise<void> {
  await db.update(authUser).set({ deletionScheduledAt: null, updatedAt: new Date() }).where(eq(authUser.id, userId));
}


/** Elimina definitivamente gli account con data di eliminazione passata. Un errore su un utente non blocca gli altri. */
export async function purgeDueAccountDeletions(now: Date = new Date()): Promise<{ deleted: number; failed: number }> {
  const due = await db
    .select({ id: authUser.id })
    .from(authUser)
    .where(and(isNotNull(authUser.deletionScheduledAt), lte(authUser.deletionScheduledAt, now)));
  let deleted = 0;
  let failed = 0;
  for (const { id } of due) {
    try {
      await deleteUserAccount(id);
      deleted += 1;
      logger.info("account.deletion.completed", { user: hashUserId(id), trigger: "cron" });
    } catch (error) {
      failed += 1;
      logger.error("account.deletion.failed", { user: hashUserId(id), trigger: "cron", error });
    }
  }
  return { deleted, failed };
}
