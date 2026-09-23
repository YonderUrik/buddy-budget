import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { transactions, type NewTransaction } from "@/lib/db/schema/transactions";
import { GoCardlessError, getAccountBalances, getAccountTransactions } from "./client";
import { isRateLimited, recordRateLimit, type RateLimitStore } from "./rate-limit";
import { getFallbackCategoryId } from "@/lib/categorization/fallback";
import { buildRuleResolver, flushRuleHits } from "@/lib/categorization/resolve";
import { MIN_SYNC_GAP_MS } from "./sync-eligibility";

const MAX_STORED_SYNC_TIMESTAMPS = 4;

/** Righe per singolo INSERT: abbastanza grande da evitare una query per movimento, abbastanza piccolo da dare un avanzamento granulare. */
export const SYNC_INSERT_CHUNK_SIZE = 50;

/** Avanzamento di un sync, notificato a ogni fase e dopo ogni blocco salvato. */
export interface SyncProgress {
  phase: "balance" | "fetching" | "saving";
  total?: number;
  processed?: number;
  inserted?: number;
  categorized?: number;
  uncategorized?: number;
}

export type SyncProgressCallback = (progress: SyncProgress) => Promise<void> | void;

/** L'avanzamento è informativo: un suo errore (es. Redis giù) non deve mai interrompere il sync. */
async function reportProgress(onProgress: SyncProgressCallback | undefined, progress: SyncProgress): Promise<void> {
  if (!onProgress) return;
  try {
    await onProgress(progress);
  } catch (error) {
    console.error("Aggiornamento dell'avanzamento del sync fallito", error);
  }
}

export interface SyncableLink {
  linkId: string;
  connectionId: string;
  accountId: string;
  externalAccountId: string;
  userId: string;
}

export type SyncResult =
  | {
      status: "synced";
      newTransactionsCount: number;
      categorizedCount: number;
      uncategorizedCount: number;
      balanceUpdated: true;
    }
  | { status: "gocardless-limited" }
  | { status: "expired" };

/**
 * Sincronizza saldo e transazioni di un conto collegato; aggiorna i timestamp o marca la connessione scaduta.
 * `onProgress` (opzionale) riceve le fasi e, durante il salvataggio, i contatori dopo ogni blocco.
 */
export async function syncAccountLink(
  link: SyncableLink,
  rateLimitStore: RateLimitStore,
  onProgress?: SyncProgressCallback
): Promise<SyncResult> {
  if (await isRateLimited(rateLimitStore, link.externalAccountId, "balances")) {
    return { status: "gocardless-limited" };
  }
  if (await isRateLimited(rateLimitStore, link.externalAccountId, "transactions")) {
    return { status: "gocardless-limited" };
  }

  try {
    await reportProgress(onProgress, { phase: "balance" });
    const { balance, rateLimit: balanceRateLimit } = await getAccountBalances(link.externalAccountId);
    if (balanceRateLimit) {
      await recordRateLimit(
        rateLimitStore,
        link.externalAccountId,
        "balances",
        balanceRateLimit.remaining,
        balanceRateLimit.resetSeconds
      );
    }
    await db
      .update(accounts)
      .set({ balance: balance.balanceAmount.amount, updatedAt: new Date() })
      .where(eq(accounts.id, link.accountId));

    await reportProgress(onProgress, { phase: "fetching" });
    const { transactions: bankTransactions, rateLimit: txRateLimit } = await getAccountTransactions(
      link.externalAccountId
    );
    if (txRateLimit) {
      await recordRateLimit(
        rateLimitStore,
        link.externalAccountId,
        "transactions",
        txRateLimit.remaining,
        txRateLimit.resetSeconds
      );
    }

    const fallbackCategoryId = await getFallbackCategoryId(link.userId);
    const ruleResolver = await buildRuleResolver(link.userId);

    const rows: NewTransaction[] = [];
    const ruleIdByExternalId = new Map<string, string>();
    for (const bankTransaction of bankTransactions) {
      const externalId = bankTransaction.internalTransactionId ?? bankTransaction.transactionId;
      if (!externalId) continue;

      const rawDescription = bankTransaction.remittanceInformationUnstructured ?? null;
      const isExpense = Number(bankTransaction.transactionAmount.amount) < 0;
      const merchantName = (isExpense ? bankTransaction.creditorName : bankTransaction.debtorName)?.trim();
      const description = merchantName || rawDescription || "Movimento bancario";
      const amount = Number(bankTransaction.transactionAmount.amount);
      const resolved = ruleResolver.resolve({ description, amount });
      if (resolved) ruleIdByExternalId.set(externalId, resolved.ruleId);

      rows.push({
        userId: link.userId,
        accountId: link.accountId,
        categoryId: resolved?.categoryId ?? fallbackCategoryId,
        description,
        rawDescription,
        amount: bankTransaction.transactionAmount.amount,
        excludedAmount: (resolved?.excludedAmount ?? 0).toFixed(2),
        date: bankTransaction.bookingDate,
        source: "auto",
        externalId,
      });
    }

    let newTransactionsCount = 0;
    let categorizedCount = 0;
    let uncategorizedCount = 0;
    await reportProgress(onProgress, {
      phase: "saving",
      total: rows.length,
      processed: 0,
      inserted: 0,
      categorized: 0,
      uncategorized: 0,
    });

    for (let start = 0; start < rows.length; start += SYNC_INSERT_CHUNK_SIZE) {
      const chunk = rows.slice(start, start + SYNC_INSERT_CHUNK_SIZE);
      const insertedRows = await db
        .insert(transactions)
        .values(chunk)
        .onConflictDoNothing({ target: [transactions.accountId, transactions.externalId] })
        .returning({ externalId: transactions.externalId, categoryId: transactions.categoryId });

      for (const inserted of insertedRows) {
        newTransactionsCount += 1;
        // hitCount va incrementato solo per righe davvero scritte: GoCardless restituisce una finestra
        // rolling di storico, quindi la stessa transazione (scartata qui da onConflictDoNothing nei sync
        // successivi) non deve gonfiare artificialmente l'utilizzo della regola che l'ha categorizzata.
        const ruleId = inserted.externalId ? ruleIdByExternalId.get(inserted.externalId) : undefined;
        if (ruleId) ruleResolver.recordHit(ruleId);
        if (inserted.categoryId === fallbackCategoryId) {
          uncategorizedCount += 1;
        } else {
          categorizedCount += 1;
        }
      }

      await reportProgress(onProgress, {
        phase: "saving",
        total: rows.length,
        processed: start + chunk.length,
        inserted: newTransactionsCount,
        categorized: categorizedCount,
        uncategorized: uncategorizedCount,
      });
    }

    await flushRuleHits(ruleResolver.appliedRuleIds());

    const [currentLink] = await db
      .select({ syncTimestamps: bankAccountLinks.syncTimestamps })
      .from(bankAccountLinks)
      .where(eq(bankAccountLinks.id, link.linkId));
    const now = new Date();
    const updatedTimestamps = [now.toISOString(), ...(currentLink?.syncTimestamps ?? [])].slice(
      0,
      MAX_STORED_SYNC_TIMESTAMPS
    );

    await db
      .update(bankAccountLinks)
      .set({
        lastSyncedAt: now,
        syncTimestamps: updatedTimestamps,
        nextSyncEligibleAt: new Date(now.getTime() + MIN_SYNC_GAP_MS),
      })
      .where(eq(bankAccountLinks.id, link.linkId));

    return { status: "synced", newTransactionsCount, categorizedCount, uncategorizedCount, balanceUpdated: true };
  } catch (error) {
    if (error instanceof GoCardlessError && error.status === 401) {
      await db
        .update(bankConnections)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(bankConnections.id, link.connectionId));
      return { status: "expired" };
    }
    throw error;
  }
}
