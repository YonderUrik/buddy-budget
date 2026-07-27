import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { transactions } from "@/lib/db/schema/transactions";
import { GoCardlessError, getAccountBalances, getAccountTransactions } from "./client";
import { isRateLimited, recordRateLimit, type RateLimitStore } from "./rate-limit";
import { getFallbackCategoryId, resolveCategoryId } from "./categorize";
import { MIN_SYNC_GAP_MS } from "./sync-eligibility";

const MAX_STORED_SYNC_TIMESTAMPS = 4;

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

/** Sincronizza saldo e transazioni di un conto collegato; aggiorna i timestamp o marca la connessione scaduta. */
export async function syncAccountLink(link: SyncableLink, rateLimitStore: RateLimitStore): Promise<SyncResult> {
  if (await isRateLimited(rateLimitStore, link.externalAccountId, "balances")) {
    return { status: "gocardless-limited" };
  }
  if (await isRateLimited(rateLimitStore, link.externalAccountId, "transactions")) {
    return { status: "gocardless-limited" };
  }

  try {
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
    let newTransactionsCount = 0;
    let categorizedCount = 0;
    let uncategorizedCount = 0;

    for (const bankTransaction of bankTransactions) {
      const externalId = bankTransaction.internalTransactionId ?? bankTransaction.transactionId;
      if (!externalId) continue;

      const rawDescription = bankTransaction.remittanceInformationUnstructured ?? null;
      const isExpense = Number(bankTransaction.transactionAmount.amount) < 0;
      const merchantName = (isExpense ? bankTransaction.creditorName : bankTransaction.debtorName)?.trim();
      const description = merchantName || rawDescription || "Movimento bancario";
      const categoryId = await resolveCategoryId(link.userId, description);

      const [inserted] = await db
        .insert(transactions)
        .values({
          userId: link.userId,
          accountId: link.accountId,
          categoryId,
          description,
          rawDescription,
          amount: bankTransaction.transactionAmount.amount,
          date: bankTransaction.bookingDate,
          source: "auto",
          externalId,
        })
        .onConflictDoNothing({ target: [transactions.accountId, transactions.externalId] })
        .returning({ categoryId: transactions.categoryId });

      if (inserted) {
        newTransactionsCount += 1;
        if (inserted.categoryId === fallbackCategoryId) {
          uncategorizedCount += 1;
        } else {
          categorizedCount += 1;
        }
      }
    }

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
