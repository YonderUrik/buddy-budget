import "server-only";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { brokerImportAccounts } from "@/lib/db/schema/broker-import-accounts";
import { brokerStatements } from "@/lib/db/schema/broker-statements";
import { fxRates, investmentPortfolios } from "@/lib/db/schema/investments";
import { buildFxTable, fxSourceCurrencies } from "@/lib/calc/fx";
import { buildCashSeries, eachDay, type LeverageSource } from "@/lib/calc/leverage";
import type { StatementCashAccount } from "@/lib/calc/cash-history";
import { resolveBrokerCash } from "@/lib/investments/broker-cash";
import { buildLeverageSources, leverageCurrencies, type LeverageStatementRow } from "@/lib/investments/leverage-source";

/** Reads run in the rebuild's transaction when there is one. */
type Reader = Pick<typeof db, "select">;

/** Days of rates loaded before the first statement day, for weekends and holidays. */
const FX_LOOKBACK_DAYS = 10;

/** One broker cash account rebuilt from its statements: daily balances in the user's currency, oldest first. */
export interface StatementCashHistory extends StatementCashAccount {
  name: string;
  /** End-of-day balance of every day from `from` to `toKey`, in the user's currency. */
  days: { date: string; value: number }[];
  /** True when a currency had no rate on some day (its balance then counted as zero). */
  missingFx: boolean;
}

/**
 * The user's broker cash accounts whose statements carry the whole cash ledger (Interactive Brokers, the same sources
 * as the leverage card), each with its end-of-day balance from its first statement day to `toKey`, converted at each
 * day's rate. Accounts without statements are left out: they stay manual accounts.
 */
export async function loadStatementCashHistories(userId: string, toKey: string, reader: Reader = db): Promise<StatementCashHistory[]> {
  const [user, sources, portfolios, cashAccounts, statementDates] = await Promise.all([
    reader.select({ currency: authUser.currency }).from(authUser).where(eq(authUser.id, userId)),
    reader.select({ provider: brokerImportAccounts.provider, cashAccountId: brokerImportAccounts.cashAccountId }).from(brokerImportAccounts).where(eq(brokerImportAccounts.userId, userId)),
    reader.select({ broker: investmentPortfolios.broker, statementCashAccountId: investmentPortfolios.statementCashAccountId }).from(investmentPortfolios).where(eq(investmentPortfolios.userId, userId)),
    reader.select({ id: accounts.id, name: accounts.name, balance: accounts.balance, createdAt: accounts.createdAt }).from(accounts).where(eq(accounts.userId, userId)),
    reader.select({ cashAccountId: brokerStatements.cashAccountId, to: brokerStatements.to }).from(brokerStatements).where(eq(brokerStatements.userId, userId)),
  ]);
  const brokerCash = resolveBrokerCash(sources, portfolios, cashAccounts, statementDates);
  if (brokerCash.length === 0) return [];
  const rows = await reader
    .select({
      cashAccountId: brokerStatements.cashAccountId,
      accountKey: brokerStatements.accountKey,
      statement: sql<LeverageStatementRow["statement"]>`jsonb_build_object('provider', ${brokerStatements.statement}->'provider', 'from', ${brokerStatements.from}, 'to', ${brokerStatements.to}, 'cash', ${brokerStatements.statement}->'cash', 'ledger', ${brokerStatements.statement}->'ledger')`,
    })
    .from(brokerStatements)
    .where(and(eq(brokerStatements.userId, userId), inArray(brokerStatements.cashAccountId, brokerCash.map((c) => c.accountId))));
  const statementSources = buildLeverageSources(brokerCash, rows).filter((s) => s.statements[0].from <= toKey);
  if (statementSources.length === 0) return [];

  const userCurrency = user[0]?.currency ?? "EUR";
  const firstDay = statementSources.map((s) => s.statements[0].from).sort()[0];
  const wanted = fxSourceCurrencies([...leverageCurrencies(statementSources), userCurrency]).filter((c) => c !== "EUR");
  const rates = wanted.length === 0 ? [] : await reader
    .select({ date: fxRates.date, currency: fxRates.currency, perEur: fxRates.perEur })
    .from(fxRates)
    .where(and(inArray(fxRates.currency, wanted), gte(fxRates.date, shiftDays(firstDay, -FX_LOOKBACK_DAYS)), lte(fxRates.date, toKey)))
    .orderBy(asc(fxRates.date));
  const fx = buildFxTable(rates);
  const createdAt = new Map(cashAccounts.map((a) => [a.id, a.createdAt]));
  return statementSources.map((source) => history(source, createdAt.get(source.accountId)!, fx, userCurrency, toKey));
}

function history(source: LeverageSource, createdAt: Date, fx: ReturnType<typeof buildFxTable>, userCurrency: string, toKey: string): StatementCashHistory {
  const from = source.statements[0].from;
  const dates = eachDay(from, toKey);
  const series = buildCashSeries([source], fx, userCurrency, dates);
  const cents = new Map(dates.map((d, i) => [d, Math.round(series.cash[i] * 100)]));
  const last = dates.length ? cents.get(dates[dates.length - 1])! : 0;
  return {
    id: source.accountId,
    name: source.name,
    createdAt,
    from,
    // Days after `toKey` (only today, which the planner never asks for) keep the last rebuilt balance.
    centsOn: (day) => (day < from ? 0 : cents.get(day) ?? last),
    days: dates.map((date) => ({ date, value: cents.get(date)! / 100 })),
    missingFx: series.missingFx,
  };
}

function shiftDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
