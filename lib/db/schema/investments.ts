import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
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

export const INVESTMENT_TRANSACTION_TYPES = ["acquisto", "vendita", "dividendo", "cedola", "rimborso"] as const;
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
