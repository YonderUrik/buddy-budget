import "server-only";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brokerImportAccounts } from "@/lib/db/schema/broker-import-accounts";
import { investmentPortfolios, investmentTransactions, type Instrument } from "@/lib/db/schema/investments";
import { findOversoldTransaction } from "@/lib/calc/investments";
import { ensureHistorySafely } from "@/lib/investments/history";
import { resolveIdentity } from "@/lib/investments/import/resolve";
import { createOrReuseInstrument } from "@/lib/investments/instruments";
import { autoLinkQuotation } from "@/lib/investments/link-quotation";
import { toRowValues } from "@/lib/investments/operations";
import { listingsOnOpenFigi, quoteMetaOnProviders, searchByIsinOnProviders, searchCryptoOnProviders, searchInstrumentsOnProviders } from "@/lib/market-data/runtime";
import { TradeRepublicError } from "./client";
import { tradeRepublicDebug } from "./debug";
import { positionMismatches, tradeSequence, type TradeRepublicInvestments, type TradeRepublicTrade } from "./investments";

/** Source of the direct connection's operations; the file import keeps provider `trade-republic`, so both never mix. */
export const TRADE_REPUBLIC_API_PROVIDER = "trade-republic-api";
const PORTFOLIO_NAME = "Trade Republic";

/** One source per verified Trade Republic account: reconnecting the same account replaces, never duplicates. */
export function tradeRepublicSourceKey(externalAccountHash: string): string {
  return createHash("sha256").update(`${TRADE_REPUBLIC_API_PROVIDER}:${externalAccountHash}`).digest("hex");
}

const resolveDeps = { searchMarket: searchInstrumentsOnProviders, searchCrypto: searchCryptoOnProviders, searchByIsin: searchByIsinOnProviders };
const instrumentDeps = { quoteMeta: quoteMetaOnProviders, listings: listingsOnOpenFigi };

/** Find or create the EUR instrument for an ISIN, as the statement import proposes it (verified Yahoo listing, else manual). */
async function instrumentFor(userId: string, trade: TradeRepublicTrade): Promise<{ instrument: Instrument; created: boolean }> {
  const identity = { key: `isin:${trade.isin}:EUR`, symbol: null, isin: trade.isin, name: trade.name ?? trade.isin, currency: "EUR", symbolIsYahoo: false };
  const match = await resolveIdentity(userId, identity, resolveDeps);
  if (match.kind === "known") return { instrument: match.instrument, created: false };
  if (match.kind === "none") { tradeRepublicDebug("rejected", { check: "instrument-unresolved", isin: trade.isin, reason: match.reason }); throw new TradeRepublicError("unavailable"); }
  const outcome = await createOrReuseInstrument(userId, match.input, instrumentDeps);
  if (!outcome.ok) { tradeRepublicDebug("rejected", { check: "instrument-create-failed", isin: trade.isin, status: outcome.status }); throw new TradeRepublicError("unavailable"); }
  return { instrument: outcome.instrument, created: outcome.created };
}

/**
 * Replace the direct source's operations with the full history just read, atomically and under the import lock shared
 * with broker statements. Nothing is written when positions disagree with Trade Republic or a sale would oversell.
 */
export async function saveTradeRepublicInvestments(userId: string, externalAccountHash: string, data: TradeRepublicInvestments): Promise<{ operations: number; instrumentsCreated: number; positionsChecked: boolean }> {
  if (data.positions && positionMismatches(data.trades, data.positions) > 0) throw new TradeRepublicError("invalid-response");
  const accountKey = tradeRepublicSourceKey(externalAccountHash);
  const byIsin = new Map<string, Instrument>();
  let instrumentsCreated = 0;
  for (const trade of data.trades) {
    if (byIsin.has(trade.isin)) continue;
    const { instrument, created } = await instrumentFor(userId, trade);
    if (instrument.currency !== "EUR") { tradeRepublicDebug("rejected", { check: "instrument-currency", isin: trade.isin, currency: instrument.currency }); throw new TradeRepublicError("invalid-response"); }
    byIsin.set(trade.isin, instrument);
    if (created) instrumentsCreated++;
  }
  const operations = data.trades.map((trade) => ({
    instrumentId: byIsin.get(trade.isin)!.id,
    ...toRowValues({ type: trade.side, date: trade.date, quantity: trade.quantity, price: trade.price, grossAmount: trade.grossAmount, fees: trade.fees, taxes: trade.taxes, note: null }, 1),
  }));
  const oversold = findOversoldTransaction(operations.map((operation, index) => ({ ...operation, id: data.trades[index].eventId })));
  if (oversold) {
    const isin = data.trades.find((trade) => trade.eventId === oversold.id)!.isin;
    tradeRepublicDebug("rejected", { check: "oversold", date: oversold.date, sequence: tradeSequence(data.trades, isin) });
    throw new TradeRepublicError("invalid-response");
  }

  await db.transaction(async (tx) => {
    // Same lock as broker statements: a file import and a sync cannot interleave for one user.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), 91473)`);
    const broker = `${TRADE_REPUBLIC_API_PROVIDER}:${accountKey}`;
    const [source] = await tx.select().from(brokerImportAccounts).where(and(eq(brokerImportAccounts.userId, userId), eq(brokerImportAccounts.accountKey, accountKey)));
    const portfolios = await tx.select().from(investmentPortfolios).where(eq(investmentPortfolios.userId, userId));
    let portfolio = portfolios.find((p) => p.id === source?.portfolioId) ?? portfolios.find((p) => p.broker === broker);
    if (!portfolio) {
      if (!operations.length) return;
      [portfolio] = await tx.insert(investmentPortfolios).values({ userId, name: PORTFOLIO_NAME, broker, taxRegime: "dichiarativo" }).returning();
    }
    await tx.delete(investmentTransactions).where(and(eq(investmentTransactions.userId, userId), eq(investmentTransactions.portfolioId, portfolio.id), eq(investmentTransactions.statementAccountKey, accountKey)));
    for (let start = 0; start < operations.length; start += 500) {
      await tx.insert(investmentTransactions).values(operations.slice(start, start + 500).map((operation) => ({ userId, portfolioId: portfolio!.id, statementAccountKey: accountKey, ...operation })));
    }
    // The connection's cash account is a current account for spending, not broker cash: it is not linked here.
    await tx.insert(brokerImportAccounts).values({ userId, accountKey, provider: TRADE_REPUBLIC_API_PROVIDER, portfolioId: portfolio.id, cashAccountId: null }).onConflictDoUpdate({ target: [brokerImportAccounts.userId, brokerImportAccounts.accountKey], set: { portfolioId: portfolio.id } });
  });

  // Prices from the first operation of each instrument, in the background, as after a statement import.
  const schedule = (task: () => Promise<void>) => { void task().catch(() => {}); };
  for (const [isin, instrument] of byIsin) {
    const first = data.trades.filter((trade) => trade.isin === isin).map((trade) => trade.date).sort()[0];
    const linked = await autoLinkQuotation(instrument, userId, instrumentDeps);
    await ensureHistorySafely(linked?.instrument ?? instrument, first, schedule);
  }
  return { operations: operations.length, instrumentsCreated, positionsChecked: data.positions !== null };
}
