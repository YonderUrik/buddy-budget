import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { investmentPortfolios, investmentTransactions } from "@/lib/db/schema/investments";
import type { InvestmentTransactionType } from "./constants";
import { loadUserTransactions } from "./data";
import { recordExclusion } from "./import/exclusions.server";
import { oversoldMessage, toCalcInput } from "./operations";

export type DeleteOperationOutcome =
  | { status: 404 }
  | { status: 400; message: string }
  | { status: 204; type: InvestmentTransactionType; imported: boolean };

/** Imported operations keep the key of their broker source; legacy IBKR rows only the portfolio's `ibkr:` tag. */
export function operationSourceKey(operation: { statementAccountKey: string | null }, portfolioBroker: string | null | undefined): string | null {
  if (operation.statementAccountKey) return operation.statementAccountKey;
  return portfolioBroker?.startsWith("ibkr:") ? portfolioBroker.slice("ibkr:".length) : null;
}

/**
 * Deletes one operation, if no later sale then exceeds the shares held. An operation imported from a broker statement
 * or connection is remembered as deleted, so the next import of the same source leaves it out and still reconciles.
 */
export async function deleteInvestmentOperation(userId: string, id: string): Promise<DeleteOperationOutcome> {
  return db.transaction(async (tx) => {
    // Same lock as statement imports: a deletion and an import of the same source cannot interleave.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), 91473)`);
    const [current] = await tx.select().from(investmentTransactions).where(and(eq(investmentTransactions.id, id), eq(investmentTransactions.userId, userId)));
    if (!current) return { status: 404 as const };
    const [portfolio] = await tx.select({ broker: investmentPortfolios.broker }).from(investmentPortfolios).where(and(eq(investmentPortfolios.id, current.portfolioId), eq(investmentPortfolios.userId, userId)));
    const remaining = (await loadUserTransactions(userId, current.instrumentId)).filter((t) => t.id !== id).map(toCalcInput);
    const message = oversoldMessage(remaining);
    if (message) return { status: 400 as const, message };
    const sourceKey = operationSourceKey(current, portfolio?.broker);
    await tx.delete(investmentTransactions).where(and(eq(investmentTransactions.id, id), eq(investmentTransactions.userId, userId)));
    if (sourceKey) await recordExclusion(tx, userId, sourceKey, current);
    return { status: 204 as const, type: current.type, imported: sourceKey !== null };
  });
}
