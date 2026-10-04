import { and, eq, isNull, or, sql } from "drizzle-orm";
import { investmentTransactions } from "@/lib/db/schema/investments";

/** Include legacy IBKR rows only in their original dedicated portfolio; never cross broker boundaries. */
export function statementSourceScope(accountKey: string, portfolioBroker: string | null) {
  return or(eq(investmentTransactions.statementAccountKey, accountKey), and(isNull(investmentTransactions.statementAccountKey), sql`${portfolioBroker} = ${`ibkr:${accountKey}`}`))!;
}
