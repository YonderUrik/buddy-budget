import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import {
  fxRates,
  instrumentPrices,
  instruments,
  investmentPlans,
  investmentPortfolios,
  investmentTransactions,
  userInstrumentPrices,
  type Instrument,
  type InvestmentPlan,
  type InvestmentPortfolio,
  type InvestmentTransaction,
} from "@/lib/db/schema/investments";
import type { FxRateInput } from "@/lib/calc/fx";
import type { ManualPriceInput, PriceInput } from "@/lib/calc/investments";

/** Nome del portafoglio creato al primo utilizzo. */
export const DEFAULT_PORTFOLIO_NAME = "Portafoglio";
/** Margine prima dell'inizio del periodo, per avere un prezzo valido anche dopo weekend e festivi. */
export const PRICE_LOOKBACK_DAYS = 10;

/** Portafoglio di default dell'utente, creato se non ne ha ancora uno. */
export async function getOrCreateDefaultPortfolio(userId: string): Promise<InvestmentPortfolio> {
  const [existing] = await db
    .select()
    .from(investmentPortfolios)
    .where(eq(investmentPortfolios.userId, userId))
    .orderBy(asc(investmentPortfolios.createdAt))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(investmentPortfolios).values({ userId, name: DEFAULT_PORTFOLIO_NAME }).returning();
  return created;
}

/** Portafoglio dell'utente per id (null se non suo). */
export async function findOwnPortfolio(userId: string, portfolioId: string): Promise<InvestmentPortfolio | null> {
  const [row] = await db
    .select()
    .from(investmentPortfolios)
    .where(and(eq(investmentPortfolios.id, portfolioId), eq(investmentPortfolios.userId, userId)));
  return row ?? null;
}

/** Operazioni dell'utente, eventualmente solo di uno strumento. */
export async function loadUserTransactions(userId: string, instrumentId?: string): Promise<InvestmentTransaction[]> {
  return db
    .select()
    .from(investmentTransactions)
    .where(
      instrumentId
        ? and(eq(investmentTransactions.userId, userId), eq(investmentTransactions.instrumentId, instrumentId))
        : eq(investmentTransactions.userId, userId)
    )
    .orderBy(asc(investmentTransactions.date), asc(investmentTransactions.createdAt));
}

/** Tutto quello che serve a calcolare il portafoglio di un utente lato client. */
export interface InvestmentData {
  currency: string;
  portfolios: InvestmentPortfolio[];
  instruments: Instrument[];
  transactions: InvestmentTransaction[];
  plans: InvestmentPlan[];
  prices: PriceInput[];
  manualPrices: ManualPriceInput[];
  fxRates: FxRateInput[];
}

function shiftDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Operazioni, strumenti, PAC, prezzi e cambi dell'utente. I prezzi partono da `pricesFrom` (meno un margine) o
 * dalla prima operazione: il grafico di un periodo corto non scarica anni di storico.
 */
export async function loadInvestmentData(userId: string, pricesFrom: string | null): Promise<InvestmentData> {
  const [user] = await db.select({ currency: authUser.currency }).from(authUser).where(eq(authUser.id, userId));
  const currency = user?.currency ?? "EUR";
  const [portfolios, transactions, plans] = await Promise.all([
    db.select().from(investmentPortfolios).where(eq(investmentPortfolios.userId, userId)).orderBy(asc(investmentPortfolios.createdAt)),
    loadUserTransactions(userId),
    db.select().from(investmentPlans).where(eq(investmentPlans.userId, userId)).orderBy(asc(investmentPlans.createdAt)),
  ]);

  const instrumentIds = [...new Set([...transactions.map((t) => t.instrumentId), ...plans.map((p) => p.instrumentId)])];
  if (instrumentIds.length === 0) {
    return { currency, portfolios, instruments: [], transactions, plans, prices: [], manualPrices: [], fxRates: [] };
  }

  const firstTransaction = transactions[0]?.date ?? null;
  const start = [pricesFrom, firstTransaction].filter((d): d is string => d !== null).sort().at(-1) ?? null;
  const from = start ? shiftDays(start, -PRICE_LOOKBACK_DAYS) : shiftDays(new Date().toISOString().slice(0, 10), -PRICE_LOOKBACK_DAYS);

  const userInstruments = await db.select().from(instruments).where(inArray(instruments.id, instrumentIds));
  const currencies = [...new Set([...userInstruments.map((i) => i.currency), currency])].filter((c) => c !== "EUR");

  const [prices, manualPrices, rates] = await Promise.all([
    db
      .select({
        instrumentId: instrumentPrices.instrumentId,
        date: instrumentPrices.date,
        close: instrumentPrices.close,
        source: instrumentPrices.source,
      })
      .from(instrumentPrices)
      .where(and(inArray(instrumentPrices.instrumentId, instrumentIds), gte(instrumentPrices.date, from)))
      .orderBy(asc(instrumentPrices.date)),
    db
      .select({ instrumentId: userInstrumentPrices.instrumentId, date: userInstrumentPrices.date, close: userInstrumentPrices.close })
      .from(userInstrumentPrices)
      .where(and(eq(userInstrumentPrices.userId, userId), inArray(userInstrumentPrices.instrumentId, instrumentIds))),
    currencies.length === 0
      ? Promise.resolve([])
      : db
          .select({ date: fxRates.date, currency: fxRates.currency, perEur: fxRates.perEur })
          .from(fxRates)
          .where(and(inArray(fxRates.currency, currencies), gte(fxRates.date, from)))
          .orderBy(asc(fxRates.date)),
  ]);

  return { currency, portfolios, instruments: userInstruments, transactions, plans, prices, manualPrices, fxRates: rates };
}

/** Cambi delle valute richieste fino alla data (per precompilare il cambio di un'operazione). */
export async function loadRatesUpTo(currencies: string[], dateKey: string): Promise<FxRateInput[]> {
  const wanted = currencies.filter((c) => c !== "EUR");
  if (wanted.length === 0) return [];
  return db
    .select({ date: fxRates.date, currency: fxRates.currency, perEur: fxRates.perEur })
    .from(fxRates)
    .where(and(inArray(fxRates.currency, wanted), lte(fxRates.date, dateKey), gte(fxRates.date, shiftDays(dateKey, -PRICE_LOOKBACK_DAYS))));
}
