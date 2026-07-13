import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { transactions } from "@/lib/db/schema/transactions";
import { GoCardlessError, getAccountBalances, getAccountTransactions } from "./client";
import { isRateLimited, recordRateLimit, type RateLimitStore } from "./rate-limit";
import { resolveCategoryId } from "./categorize";

const SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;

export interface SyncableLink {
  linkId: string;
  connectionId: string;
  accountId: string;
  externalAccountId: string;
  userId: string;
}

/** Sincronizza saldo e transazioni di un conto collegato; aggiorna i timestamp o marca la connessione scaduta. */
export async function syncAccountLink(link: SyncableLink, rateLimitStore: RateLimitStore): Promise<void> {
  if (await isRateLimited(rateLimitStore, link.externalAccountId, "balances")) return;
  if (await isRateLimited(rateLimitStore, link.externalAccountId, "transactions")) return;

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

    for (const bankTransaction of bankTransactions) {
      const externalId = bankTransaction.internalTransactionId ?? bankTransaction.transactionId;
      if (!externalId) continue;

      const description = bankTransaction.remittanceInformationUnstructured ?? "Movimento bancario";
      const categoryId = await resolveCategoryId(link.userId, description);

      await db
        .insert(transactions)
        .values({
          userId: link.userId,
          accountId: link.accountId,
          categoryId,
          description,
          amount: bankTransaction.transactionAmount.amount,
          date: bankTransaction.bookingDate,
          source: "auto",
          externalId,
        })
        .onConflictDoNothing({ target: [transactions.accountId, transactions.externalId] });
    }

    await db
      .update(bankAccountLinks)
      .set({ lastSyncedAt: new Date(), nextSyncEligibleAt: new Date(Date.now() + SYNC_INTERVAL_MS) })
      .where(eq(bankAccountLinks.id, link.linkId));
  } catch (error) {
    if (error instanceof GoCardlessError && error.status === 401) {
      await db
        .update(bankConnections)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(bankConnections.id, link.connectionId));
      return;
    }
    throw error;
  }
}
