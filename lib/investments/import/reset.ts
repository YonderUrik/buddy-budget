import { transactions } from "@/lib/db/schema/transactions";
import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { brokerStatements } from "@/lib/db/schema/broker-statements";
import { brokerImportAccounts } from "@/lib/db/schema/broker-import-accounts";
import { investmentPortfolios, investmentTransactions, userInstrumentPrices } from "@/lib/db/schema/investments";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function readResetState(tx: Tx, userId: string) {
  const operations = await tx.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId)).orderBy(investmentTransactions.id);
  const statements = await tx.select({ id: brokerStatements.id, accountKey: brokerStatements.accountKey, portfolioId: brokerStatements.portfolioId, cashAccountId: brokerStatements.cashAccountId, fingerprint: brokerStatements.fingerprint, statement: brokerStatements.statement }).from(brokerStatements).where(eq(brokerStatements.userId, userId)).orderBy(brokerStatements.id);
  const sources = await tx.select().from(brokerImportAccounts).where(eq(brokerImportAccounts.userId, userId)).orderBy(brokerImportAccounts.id);
  const portfolios = await tx.select().from(investmentPortfolios).where(eq(investmentPortfolios.userId, userId)).orderBy(investmentPortfolios.id);
  const prices = await tx.select().from(userInstrumentPrices).where(eq(userInstrumentPrices.userId, userId)).orderBy(userInstrumentPrices.id);
  const ids = [...new Set([...statements.map((s) => s.cashAccountId), ...sources.map((s) => s.cashAccountId), ...portfolios.map((p) => p.statementCashAccountId)].filter((id): id is string => !!id))];
  const cash = ids.length ? await tx.select().from(accounts).where(and(eq(accounts.userId, userId), inArray(accounts.id, ids))).orderBy(accounts.id) : [];
  const cashTransactions = ids.length ? await tx.select().from(transactions).where(and(eq(transactions.userId, userId), inArray(transactions.accountId, ids), sql`${transactions.externalId} like 'trade-republic:%'`)).orderBy(transactions.id) : [];
  const revision = createHash("sha256").update(JSON.stringify({ userId, operations, statements, sources, portfolios, prices, cash, cashTransactions })).digest("hex");
  return { operations, statements, sources, portfolios, prices, cash, cashTransactions, revision };
}

/** Review the full investment-history reset, including legacy imports with no provenance. */
export async function previewInvestmentReset(userId: string) {
  return db.transaction(async (tx) => {
    const state = await readResetState(tx, userId);
    return { revision: state.revision, operations: state.operations.length, untrackedOperations: state.operations.filter((o) => !o.statementAccountKey).length, statements: state.statements.length, prices: state.prices.length, cashAccounts: state.cash.length };
  }, { isolationLevel: "repeatable read" });
}

/** Clear reviewed investment history atomically, retaining account identities for a clean reimport. */
export async function resetInvestmentHistory(userId: string, revision: string, today: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), 91473)`);
    const state = await readResetState(tx, userId);
    if (state.revision !== revision) return { status: 409, error: "I dati sono cambiati. Riapri il riepilogo e conferma di nuovo il ripristino." };
    // Legacy documents may predate the persistent source/cash association.
    for (const s of state.statements) await tx.insert(brokerImportAccounts).values({ userId, accountKey: s.accountKey, provider: s.statement.provider ?? "interactive-brokers", portfolioId: s.portfolioId, cashAccountId: s.cashAccountId }).onConflictDoNothing();
    await tx.delete(investmentTransactions).where(eq(investmentTransactions.userId, userId));
    if (state.cashTransactions.length) await tx.delete(transactions).where(and(eq(transactions.userId, userId), inArray(transactions.id, state.cashTransactions.map((t) => t.id))));
    await tx.delete(brokerStatements).where(eq(brokerStatements.userId, userId));
    await tx.delete(userInstrumentPrices).where(eq(userInstrumentPrices.userId, userId));
    await tx.delete(netWorthSnapshots).where(and(eq(netWorthSnapshots.userId, userId), eq(netWorthSnapshots.assetClass, "investimenti")));
    if (state.cash.length) {
      await tx.update(accounts).set({ balance: "0", updatedAt: new Date() }).where(and(eq(accounts.userId, userId), inArray(accounts.id, state.cash.map((a) => a.id))));
      const [total] = await tx.select({ amount: sql<string>`coalesce(sum(${accounts.balance}), 0)` }).from(accounts).where(eq(accounts.userId, userId));
      await tx.insert(netWorthSnapshots).values({ userId, date: today, assetClass: "liquidita", amount: total.amount, source: "snapshot" }).onConflictDoUpdate({ target: [netWorthSnapshots.userId, netWorthSnapshots.date, netWorthSnapshots.assetClass], set: { amount: total.amount, source: "snapshot", updatedAt: new Date() } });
    }
    return { status: 200, deletedOperations: state.operations.length, deletedStatements: state.statements.length, deletedPrices: state.prices.length, resetCashAccounts: state.cash.length };
  }, { isolationLevel: "serializable" });
}
