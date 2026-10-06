import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brokerImportAccounts } from "@/lib/db/schema/broker-import-accounts";
import { accounts } from "@/lib/db/schema/accounts";
import { brokerStatements } from "@/lib/db/schema/broker-statements";
import { resolveBrokerCash, type BrokerCash } from "./broker-cash";
import { authUser } from "@/lib/db/schema/auth";
import {
  fxRates,
  instrumentPrices,
  instruments,
  investmentPortfolios,
  investmentTargets,
  investmentTaxCarryforwards,
  investmentTransactions,
  userDismissedDividends,
  userInstrumentBreakdowns,
  userInstrumentPrices,
  userInstrumentSettings,
  type Instrument,
  type InvestmentPortfolio,
  type InvestmentTransaction,
} from "@/lib/db/schema/investments";
import type { FxRateInput } from "@/lib/calc/fx";
import type { ManualPriceInput, PriceInput } from "@/lib/calc/investments";
import type { InflationPoint } from "@/lib/calc/returns";
import type { RateInput } from "@/lib/calc/risk";
import { loadInflationIndex } from "@/lib/market-data/inflation";
import { loadProfiles } from "@/lib/market-data/profiles";
import { loadDividends, type DividendRow } from "@/lib/market-data/dividends";
import { loadRiskFreeRates } from "@/lib/market-data/rates";
import type { ExposureProfile, ManualBreakdown } from "./exposure";
import type { InstrumentSettingInput } from "./tax-settings";

/** Valuta per cui esiste l'indice d'inflazione (Eurostat, area Italia): per le altre il rendimento reale non si mostra. */
export const INFLATION_CURRENCY = "EUR";
/** Valuta del tasso privo di rischio €STR: per le altre lo Sharpe usa zero. */
export const RISK_FREE_CURRENCY = "EUR";

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
  brokerCash?: BrokerCash[];
  brokerSources?: { accountKey: string; provider: string }[];
  portfolios: InvestmentPortfolio[];
  instruments: Instrument[];
  transactions: InvestmentTransaction[];
  prices: PriceInput[];
  manualPrices: ManualPriceInput[];
  fxRates: FxRateInput[];
  /** Strumento di confronto scelto sul portafoglio (i suoi prezzi sono in `prices`), o null. */
  benchmark: Instrument | null;
  /** Indice mensile dei prezzi al consumo; vuoto se la valuta dell'utente non è EUR. */
  inflation: InflationPoint[];
  /** Allocazione obiettivo per strumento (pesi come stringhe numeric). */
  targets: { instrumentId: string; weight: string }[];
  /** Profili dalle fonti (settori, primi titoli, paese) degli strumenti. */
  profiles: ExposureProfile[];
  /** Correzioni manuali dell'utente di settore e area. */
  manualBreakdowns: ManualBreakdown[];
  /** €STR giornaliero dal periodo richiesto; vuoto se la valuta dell'utente non è EUR. */
  riskFreeRates: RateInput[];
  /** Impostazioni fiscali e cedole dell'utente per strumento (Fase 4). */
  instrumentSettings: InstrumentSettingInput[];
  /** Minusvalenze pregresse inserite a mano. */
  taxCarryforwards: { id: string; year: number; amount: string; note: string | null }[];
  /** Stacchi dei dividendi per quota degli strumenti posseduti. */
  dividends: DividendRow[];
  /** Proposte "da registrare" ignorate. */
  dismissedDividends: { instrumentId: string; date: string }[];
}

function shiftDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Operazioni, strumenti, prezzi e cambi dell'utente. I prezzi partono da `pricesFrom` (meno un margine) o
 * dalla prima operazione: il grafico di un periodo corto non scarica anni di storico.
 */
export async function loadInvestmentData(userId: string, pricesFrom: string | null): Promise<InvestmentData> {
  const [user] = await db.select({ currency: authUser.currency }).from(authUser).where(eq(authUser.id, userId));
  const currency = user?.currency ?? "EUR";
  const [portfolios, transactions, brokerSources, cashAccounts, cashStatements] = await Promise.all([
    db.select().from(investmentPortfolios).where(eq(investmentPortfolios.userId, userId)).orderBy(asc(investmentPortfolios.createdAt)),
    loadUserTransactions(userId),
    db.select({ accountKey: brokerImportAccounts.accountKey, provider: brokerImportAccounts.provider, cashAccountId: brokerImportAccounts.cashAccountId }).from(brokerImportAccounts).where(eq(brokerImportAccounts.userId, userId)),
    db.select({ id: accounts.id, name: accounts.name, balance: accounts.balance }).from(accounts).where(eq(accounts.userId, userId)),
    db.select({ cashAccountId: brokerStatements.cashAccountId, to: brokerStatements.to }).from(brokerStatements).where(eq(brokerStatements.userId, userId)),
  ]);

  const brokerCash = resolveBrokerCash(brokerSources, portfolios, cashAccounts, cashStatements);

  const [instrumentSettings, taxCarryforwards, dismissedDividends] = await Promise.all([
    db
      .select({
        instrumentId: userInstrumentSettings.instrumentId,
        taxRate: userInstrumentSettings.taxRate,
        taxHarmonized: userInstrumentSettings.taxHarmonized,
        couponRate: userInstrumentSettings.couponRate,
        couponFrequency: userInstrumentSettings.couponFrequency,
        maturityDate: userInstrumentSettings.maturityDate,
      })
      .from(userInstrumentSettings)
      .where(eq(userInstrumentSettings.userId, userId)),
    db
      .select({
        id: investmentTaxCarryforwards.id,
        year: investmentTaxCarryforwards.year,
        amount: investmentTaxCarryforwards.amount,
        note: investmentTaxCarryforwards.note,
      })
      .from(investmentTaxCarryforwards)
      .where(eq(investmentTaxCarryforwards.userId, userId))
      .orderBy(asc(investmentTaxCarryforwards.year), asc(investmentTaxCarryforwards.createdAt)),
    db
      .select({ instrumentId: userDismissedDividends.instrumentId, date: userDismissedDividends.date })
      .from(userDismissedDividends)
      .where(eq(userDismissedDividends.userId, userId)),
  ]);
  const fase4 = { instrumentSettings, taxCarryforwards, dismissedDividends };

  const targets = portfolios[0]
    ? await db
        .select({ instrumentId: investmentTargets.instrumentId, weight: investmentTargets.weight })
        .from(investmentTargets)
        .where(eq(investmentTargets.portfolioId, portfolios[0].id))
    : [];
  // Gli strumenti in obiettivo ma non ancora posseduti servono per nome e prezzo (suggerimento del prossimo acquisto).
  const ownedIds = [...new Set([...transactions.map((t) => t.instrumentId), ...targets.map((t) => t.instrumentId)])];
  if (ownedIds.length === 0) {
    return {
      currency,
      brokerSources,
      brokerCash,
      portfolios,
      instruments: [],
      transactions,
      prices: [],
      manualPrices: [],
      fxRates: [],
      benchmark: null,
      inflation: [],
      targets,
      profiles: [],
      manualBreakdowns: [],
      riskFreeRates: [],
      ...fase4,
      dividends: [],
    };
  }
  const benchmarkId = portfolios[0]?.benchmarkInstrumentId ?? null;
  const instrumentIds = benchmarkId && !ownedIds.includes(benchmarkId) ? [...ownedIds, benchmarkId] : ownedIds;

  const firstTransaction = transactions[0]?.date ?? null;
  const start = [pricesFrom, firstTransaction].filter((d): d is string => d !== null).sort().at(-1) ?? null;
  const from = start ? shiftDays(start, -PRICE_LOOKBACK_DAYS) : shiftDays(new Date().toISOString().slice(0, 10), -PRICE_LOOKBACK_DAYS);

  const loaded = await db.select().from(instruments).where(inArray(instruments.id, instrumentIds));
  const userInstruments = loaded.filter((i) => ownedIds.includes(i.id));
  const benchmark = loaded.find((i) => i.id === benchmarkId) ?? null;
  const currencies = [...new Set([...loaded.map((i) => i.currency), currency])].filter((c) => c !== "EUR");

  const [prices, manualPrices, rates, inflation, profiles, manualBreakdowns, riskFreeRates, dividends] = await Promise.all([
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
    currency === INFLATION_CURRENCY ? loadInflationIndex() : Promise.resolve([]),
    loadProfiles(ownedIds),
    db
      .select({ instrumentId: userInstrumentBreakdowns.instrumentId, sectors: userInstrumentBreakdowns.sectors, areas: userInstrumentBreakdowns.areas })
      .from(userInstrumentBreakdowns)
      .where(and(eq(userInstrumentBreakdowns.userId, userId), inArray(userInstrumentBreakdowns.instrumentId, ownedIds))),
    currency === RISK_FREE_CURRENCY ? loadRiskFreeRates(from) : Promise.resolve([]),
    loadDividends(ownedIds),
  ]);

  return {
    currency,
    brokerSources,
    brokerCash,
    portfolios,
    instruments: userInstruments,
    transactions,
    prices,
    manualPrices,
    fxRates: rates,
    benchmark,
    inflation,
    targets,
    profiles,
    manualBreakdowns,
    riskFreeRates,
    ...fase4,
    dividends,
  };
}

/** Cambi salvati tra due date (con margine prima di `fromKey` per weekend e festivi). */
export async function loadRatesBetween(currencies: string[], fromKey: string, toKey: string): Promise<FxRateInput[]> {
  const wanted = currencies.filter((c) => c !== "EUR");
  if (wanted.length === 0) return [];
  return db
    .select({ date: fxRates.date, currency: fxRates.currency, perEur: fxRates.perEur })
    .from(fxRates)
    .where(and(inArray(fxRates.currency, wanted), lte(fxRates.date, toKey), gte(fxRates.date, shiftDays(fromKey, -PRICE_LOOKBACK_DAYS))));
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
