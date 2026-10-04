import "server-only";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { brokerImportAccounts } from "@/lib/db/schema/broker-import-accounts";
import { statementSourceScope } from "./source-scope";
import { brokerStatements } from "@/lib/db/schema/broker-statements";
import { investmentPortfolios, investmentTransactions } from "@/lib/db/schema/investments";
import { statementCashComponents } from "./broker-statement";
import { resolveFxRates, type ImportDeps } from "./execute";

/** Remove the explicitly reviewed suffix of one broker's history and restore its preceding cash balance atomically. */
export async function deleteStatementImports(userId: string, id: string, confirmedIds: string[], deps: ImportDeps) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), 91473)`);
    const [selected] = await tx.select().from(brokerStatements).where(and(eq(brokerStatements.id, id), eq(brokerStatements.userId, userId)));
    if (!selected) return { error: "Importazione non trovata", status: 404 };
    const docs = await tx.select().from(brokerStatements).where(and(eq(brokerStatements.userId, userId), eq(brokerStatements.accountKey, selected.accountKey)));
    const affected = docs.filter((d) => d.from >= selected.from);
    if (confirmedIds.length !== affected.length || new Set(confirmedIds).size !== affected.length || affected.some((d) => !confirmedIds.includes(d.id))) return { error: "Le importazioni sono cambiate: aggiorna la pagina e controlla di nuovo l'elenco da eliminare", status: 409 };
    const previous = docs.filter((d) => d.to < selected.from).sort((a, b) => b.to.localeCompare(a.to))[0];
    let balance = 0;
    if (previous) {
      const cash = statementCashComponents(previous.statement);
      const rates = await resolveFxRates(cash.map((c, i) => ({ line: i, date: previous.to, currency: c.currency })), deps);
      if ([...rates.values()].some((rate) => rate == null)) return { error: "Cambio storico non disponibile: nessun dato eliminato", status: 422 };
      balance = cash.reduce((sum, c, i) => sum + c.amount * rates.get(i)!, 0);
    }
    const [portfolio] = await tx.select().from(investmentPortfolios).where(and(eq(investmentPortfolios.userId, userId), eq(investmentPortfolios.id, selected.portfolioId)));
    const provider = selected.statement.provider ?? "interactive-brokers";
    await tx.insert(brokerImportAccounts).values({ userId, accountKey: selected.accountKey, provider, portfolioId: selected.portfolioId, cashAccountId: selected.cashAccountId }).onConflictDoNothing();
    // Preserve the link for portfolios imported before the persistent cash-account field existed.
    if (selected.cashAccountId && provider === "interactive-brokers") await tx.update(investmentPortfolios).set({ statementCashAccountId: selected.cashAccountId }).where(and(eq(investmentPortfolios.id, selected.portfolioId), eq(investmentPortfolios.userId, userId)));
    const removed = await tx.delete(investmentTransactions).where(and(eq(investmentTransactions.userId, userId), eq(investmentTransactions.portfolioId, selected.portfolioId), statementSourceScope(selected.accountKey, portfolio?.broker ?? null), gte(investmentTransactions.date, selected.from))).returning({ id: investmentTransactions.id });
    await tx.delete(brokerStatements).where(and(eq(brokerStatements.userId, userId), inArray(brokerStatements.id, affected.map((d) => d.id))));
    if (selected.cashAccountId) await tx.update(accounts).set({ balance: balance.toFixed(2), updatedAt: new Date() }).where(and(eq(accounts.userId, userId), eq(accounts.id, selected.cashAccountId)));
    // Catalogue instruments and historical prices remain useful independently of owning a position.
    return { deletedStatements: affected.length, deletedOperations: removed.length, status: 200 };
  });
}
