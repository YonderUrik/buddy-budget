import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUser } from "./auth";

/** Tipi di strumento: text + costante invece di enum Postgres, per aggiungerne senza migrazioni. */
export const INSTRUMENT_TYPES = ["etf", "azione", "obbligazione", "fondo", "crypto", "etc"] as const;
export type InstrumentType = (typeof INSTRUMENT_TYPES)[number];

/** `auto`: prezzi dalla catena di fonti; `manuale`: solo prezzi inseriti dall'utente. */
export const PRICE_MODES = ["auto", "manuale"] as const;
export type PriceMode = (typeof PRICE_MODES)[number];

/** `percentuale_nominale`: obbligazioni, dove valore = quantità (nominale) × prezzo / 100. */
export const PRICE_UNITS = ["unita", "percentuale_nominale"] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

/** Fonti di prezzi di mercato (vedi `lib/market-data`). */
export const PROVIDER_IDS = [
  "yahoo",
  "borsaitaliana",
  "stooq",
  "alphavantage",
  "twelvedata",
  "coingecko",
  "kraken",
] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

/** Fonti dei cambi. */
export const FX_PROVIDER_IDS = ["ecb", "frankfurter"] as const;
export type FxProviderId = (typeof FX_PROVIDER_IDS)[number];

/** `split`: il rapporto (quote nuove per quota vecchia) sta in `quantity`. */
export const INVESTMENT_TRANSACTION_TYPES = ["acquisto", "vendita", "dividendo", "cedola", "rimborso", "split"] as const;
export type InvestmentTransactionType = (typeof INVESTMENT_TRANSACTION_TYPES)[number];

export const PLAN_FREQUENCIES = ["mensile", "bimestrale", "trimestrale"] as const;
export type PlanFrequency = (typeof PLAN_FREQUENCIES)[number];

/** Aliquota italiana di default sui redditi finanziari (12,5% per titoli di Stato, si imposta per strumento). */
export const DEFAULT_TAX_RATE = "0.2600";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/** Strumenti finanziari, comuni a tutti gli utenti (tranne quelli manuali, visibili solo a chi li ha creati). */
export const instruments = pgTable(
  "instruments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    isin: text("isin"),
    name: text("name").notNull(),
    type: text("type").$type<InstrumentType>().notNull(),
    currency: text("currency").notNull(),
    priceMode: text("price_mode").$type<PriceMode>().notNull().default("auto"),
    priceUnit: text("price_unit").$type<PriceUnit>().notNull().default("unita"),
    exchange: text("exchange"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 4 }).notNull().default(DEFAULT_TAX_RATE),
    taxHarmonized: boolean("tax_harmonized"),
    createdByUserId: text("created_by_user_id").references(() => authUser.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [uniqueIndex("instruments_isin_unique").on(table.isin).where(sql`${table.isin} is not null`)]
);

/** Simbolo dello strumento su ciascuna fonte (ogni fonte usa il suo). */
export const instrumentSymbols = pgTable(
  "instrument_symbols",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    provider: text("provider").$type<ProviderId>().notNull(),
    symbol: text("symbol").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("instrument_symbols_instrument_provider_unique").on(table.instrumentId, table.provider)]
);

/** Chiusure giornaliere dalle fonti automatiche, con la fonte che le ha fornite. */
export const instrumentPrices = pgTable(
  "instrument_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    close: numeric("close", { precision: 20, scale: 8 }).notNull(),
    source: text("source").$type<ProviderId>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("instrument_prices_instrument_date_unique").on(table.instrumentId, table.date),
    index("instrument_prices_instrument_date_idx").on(table.instrumentId, table.date.desc()),
  ]
);

/** Prezzi inseriti a mano da un utente: valgono solo per il suo portafoglio. */
export const userInstrumentPrices = pgTable(
  "user_instrument_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    close: numeric("close", { precision: 20, scale: 8 }).notNull(),
    ...timestamps,
  },
  (table) => [unique("user_instrument_prices_unique").on(table.userId, table.instrumentId, table.date)]
);

/** Cambi giornalieri con base EUR: 1 EUR = `perEur` unità di `currency`. */
export const fxRates = pgTable(
  "fx_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date").notNull(),
    currency: text("currency").notNull(),
    perEur: numeric("per_eur", { precision: 20, scale: 8 }).notNull(),
    source: text("source").$type<FxProviderId>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("fx_rates_date_currency_unique").on(table.date, table.currency)]
);

export const investmentPortfolios = pgTable(
  "investment_portfolios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    broker: text("broker"),
    /** Strumento di confronto per il rendimento ("stessi versamenti in un indice"), scelto dall'utente. */
    benchmarkInstrumentId: uuid("benchmark_instrument_id").references(() => instruments.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [index("investment_portfolios_user_idx").on(table.userId)]
);

/** Operazioni di investimento: le posizioni si calcolano da qui, non si salvano. */
export const investmentTransactions = pgTable(
  "investment_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => investmentPortfolios.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "restrict" }),
    type: text("type").$type<InvestmentTransactionType>().notNull(),
    date: date("date").notNull(),
    /** Quote (nominale per le obbligazioni); 0 per dividendi e cedole. */
    quantity: numeric("quantity", { precision: 24, scale: 10 }).notNull().default("0"),
    /** Prezzo unitario nella valuta dello strumento; 0 per dividendi e cedole. */
    price: numeric("price", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Cambio valuta strumento → valuta utente alla data dell'operazione. */
    fxRate: numeric("fx_rate", { precision: 20, scale: 8 }).notNull().default("1"),
    /** Commissioni, nella valuta dell'utente. */
    fees: numeric("fees", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Imposte trattenute, nella valuta dell'utente. */
    taxes: numeric("taxes", { precision: 14, scale: 2 }).notNull().default("0"),
    /** Importo lordo di dividendi e cedole, nella valuta dello strumento. */
    grossAmount: numeric("gross_amount", { precision: 14, scale: 2 }),
    note: text("note"),
    ...timestamps,
  },
  (table) => [
    index("investment_transactions_user_date_idx").on(table.userId, table.date),
    index("investment_transactions_instrument_idx").on(table.instrumentId),
  ]
);

/** Piani di accumulo: precompilano le operazioni, non le generano. */
export const investmentPlans = pgTable(
  "investment_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => investmentPortfolios.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    frequency: text("frequency").$type<PlanFrequency>().notNull().default("mensile"),
    dayOfMonth: integer("day_of_month").notNull(),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [index("investment_plans_user_idx").on(table.userId)]
);

/** Indice mensile dei prezzi al consumo (HICP Eurostat, base 2015=100), comune a tutti gli utenti. */
export const inflationIndex = pgTable(
  "inflation_index",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Area geografica Eurostat (es. `IT`). */
    area: text("area").notNull(),
    /** `YYYY-MM`. */
    month: text("month").notNull(),
    value: numeric("value", { precision: 12, scale: 4 }).notNull(),
    source: text("source").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("inflation_index_area_month_unique").on(table.area, table.month)]
);

/** Titolo tra i primi di un ETF/fondo (da Yahoo `topHoldings`). */
export interface ProfileHolding {
  symbol: string | null;
  name: string;
  /** Peso sul fondo (0-1). */
  weight: number;
}

/** Ripartizione del fondo per tipo di attività (0-1): azioni, obbligazioni, liquidità, altro. */
export interface ProfileAssetMix {
  stock: number | null;
  bond: number | null;
  cash: number | null;
  other: number | null;
}

/**
 * Profilo di uno strumento dalle fonti (oggi Yahoo `quoteSummary`), comune a tutti gli utenti: settori e primi
 * titoli degli ETF/fondi, settore e paese delle azioni. Una risposta vuota salva comunque la riga (con i campi
 * null), così non si richiede ogni giorno.
 */
export const instrumentProfiles = pgTable("instrument_profiles", {
  instrumentId: uuid("instrument_id")
    .primaryKey()
    .references(() => instruments.id, { onDelete: "cascade" }),
  source: text("source").$type<ProviderId>().notNull(),
  /** Simbolo usato sulla fonte (per riconoscere un'azione posseduta tra i titoli di un ETF). */
  symbol: text("symbol"),
  /** Pesi per settore della parte azionaria (chiavi di `SECTOR_KEYS`, somma ≈ 1). */
  sectors: jsonb("sectors").$type<Record<string, number>>(),
  assetMix: jsonb("asset_mix").$type<ProfileAssetMix>(),
  holdings: jsonb("holdings").$type<ProfileHolding[]>(),
  /** Settore dell'azienda (chiave di `SECTOR_KEYS`), solo azioni. */
  sector: text("sector"),
  /** Paese dell'azienda (ISO 3166 alpha-2), solo azioni. */
  country: text("country"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Correzione manuale di settore e area di uno strumento, per utente: null = si usa l'automatico. */
export const userInstrumentBreakdowns = pgTable(
  "user_instrument_breakdowns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    sectors: jsonb("sectors").$type<Record<string, number>>(),
    areas: jsonb("areas").$type<Record<string, number>>(),
    ...timestamps,
  },
  (table) => [unique("user_instrument_breakdowns_unique").on(table.userId, table.instrumentId)]
);

/** Allocazione obiettivo del portafoglio, per strumento: i pesi sommano a 1. */
export const investmentTargets = pgTable(
  "investment_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => investmentPortfolios.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    weight: numeric("weight", { precision: 7, scale: 6 }).notNull(),
    ...timestamps,
  },
  (table) => [unique("investment_targets_portfolio_instrument_unique").on(table.portfolioId, table.instrumentId)]
);

/** Serie di tassi d'interesse di riferimento (oggi solo €STR), comuni a tutti gli utenti. */
export const INTEREST_RATE_SERIES = ["estr"] as const;
export type InterestRateSeries = (typeof INTEREST_RATE_SERIES)[number];

/** Tassi giornalieri: `rate` come frazione annua (0,0192 = 1,92%). */
export const interestRates = pgTable(
  "interest_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    series: text("series").$type<InterestRateSeries>().notNull(),
    date: date("date").notNull(),
    rate: numeric("rate", { precision: 10, scale: 8 }).notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("interest_rates_series_date_unique").on(table.series, table.date)]
);

export type Instrument = typeof instruments.$inferSelect;
export type NewInstrument = typeof instruments.$inferInsert;
export type InstrumentSymbol = typeof instrumentSymbols.$inferSelect;
export type InstrumentPrice = typeof instrumentPrices.$inferSelect;
export type UserInstrumentPrice = typeof userInstrumentPrices.$inferSelect;
export type FxRate = typeof fxRates.$inferSelect;
export type InvestmentPortfolio = typeof investmentPortfolios.$inferSelect;
export type InvestmentTransaction = typeof investmentTransactions.$inferSelect;
export type NewInvestmentTransaction = typeof investmentTransactions.$inferInsert;
export type InvestmentPlan = typeof investmentPlans.$inferSelect;
export type InflationIndexRow = typeof inflationIndex.$inferSelect;
export type InstrumentProfile = typeof instrumentProfiles.$inferSelect;
export type UserInstrumentBreakdown = typeof userInstrumentBreakdowns.$inferSelect;
export type InvestmentTarget = typeof investmentTargets.$inferSelect;
