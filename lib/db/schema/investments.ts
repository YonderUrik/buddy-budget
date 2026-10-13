import { type PriceAlertStatus } from "@/lib/investments/constants";
import { type PriceAlertDirection } from "@/lib/investments/constants";
import { type InterestRateSeries } from "@/lib/investments/constants";
import { sql } from "drizzle-orm";
import { encryptedText } from "./encrypted-text";
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
import { accounts } from "./accounts";

import { type InstrumentType, type PriceMode, type PriceUnit, type ProviderId, type FxProviderId, type InvestmentTransactionType, type PlanFrequency, DEFAULT_TAX_RATE, type TaxRegime, type CouponFrequency } from "@/lib/investments/constants";
export * from "@/lib/investments/constants";

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
    /** Ultimo scaricamento dello storico dei dividendi per quota (null = mai). */
    dividendsFetchedAt: timestamp("dividends_fetched_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id").references(() => authUser.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("instruments_isin_unique").on(table.isin).where(sql`${table.isin} is not null and ${table.createdByUserId} is null`),
    uniqueIndex("instruments_private_isin_currency_unique").on(table.createdByUserId, table.isin, table.currency).where(sql`${table.isin} is not null and ${table.createdByUserId} is not null`),
  ]
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
    /** Dedicated statement cash account; retained when imported history is cleared. */
    statementCashAccountId: uuid("statement_cash_account_id").references(() => accounts.id, { onDelete: "set null" }),
    /** Strumento di confronto per il rendimento ("stessi versamenti in un indice"), scelto dall'utente. */
    benchmarkInstrumentId: uuid("benchmark_instrument_id").references(() => instruments.id, { onDelete: "set null" }),
    taxRegime: text("tax_regime").$type<TaxRegime>().notNull().default("amministrato"),
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
    /** Source of statement imports, independent of the combined portfolio. */
    statementAccountKey: text("statement_account_key"),
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
    note: encryptedText("note"),
    ...timestamps,
  },
  (table) => [
    index("investment_transactions_user_date_idx").on(table.userId, table.date),
    index("investment_transactions_instrument_idx").on(table.instrumentId),
  ]
);

/** @deprecated Piani di accumulo (PAC): funzione rimossa il 2026-10-04, tabella lasciata in attesa di una migration che la elimini. */
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

/**
 * Impostazioni fiscali e cedole di uno strumento, per utente (gli strumenti sono condivisi): null = automatico.
 * Le cedole servono solo alle obbligazioni: tasso annuo lordo (0,035 = 3,5%), cedole all'anno, scadenza.
 */
export const userInstrumentSettings = pgTable(
  "user_instrument_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    taxRate: numeric("tax_rate", { precision: 5, scale: 4 }),
    taxHarmonized: boolean("tax_harmonized"),
    couponRate: numeric("coupon_rate", { precision: 8, scale: 6 }),
    couponFrequency: integer("coupon_frequency").$type<CouponFrequency>(),
    maturityDate: date("maturity_date"),
    ...timestamps,
  },
  (table) => [unique("user_instrument_settings_unique").on(table.userId, table.instrumentId)]
);

/** Minusvalenze pregresse inserite a mano (lo zaino del broker da prima dell'app), nella valuta dell'utente. */
export const investmentTaxCarryforwards = pgTable(
  "investment_tax_carryforwards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => investmentPortfolios.id, { onDelete: "cascade" }),
    /** Anno in cui la minusvalenza è nata: si usa fino al 31/12 di anno + 4. */
    year: integer("year").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    note: encryptedText("note"),
    ...timestamps,
  },
  (table) => [index("investment_tax_carryforwards_user_idx").on(table.userId)]
);

/** Dividendi per quota dalle fonti (data di stacco, valuta dello strumento, corretti per gli split), comuni a tutti. */
export const instrumentDividends = pgTable(
  "instrument_dividends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    exDate: date("ex_date").notNull(),
    amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
    source: text("source").$type<ProviderId>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("instrument_dividends_instrument_date_unique").on(table.instrumentId, table.exDate)]
);

/** Proposte "dividendo da registrare" ignorate dall'utente (data di stacco o di cedola). */
export const userDismissedDividends = pgTable(
  "user_dismissed_dividends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("user_dismissed_dividends_unique").on(table.userId, table.instrumentId, table.date)]
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
export type UserInstrumentSetting = typeof userInstrumentSettings.$inferSelect;
export type InvestmentTaxCarryforward = typeof investmentTaxCarryforwards.$inferSelect;
export type InstrumentDividend = typeof instrumentDividends.$inferSelect;

/** Strumenti che l'utente segue senza possederli (watchlist). */
export const userWatchlistItems = pgTable(
  "user_watchlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("user_watchlist_items_user_instrument_unique").on(table.userId, table.instrumentId)]
);

/** `sopra`: scatta quando la chiusura arriva o supera il livello; `sotto`: quando arriva o scende sotto. */

/** `attivo`: da controllare ogni sera; `scattato`: già notificato, non si ripete (si può eliminare o ricreare). */

/** Avvisi di prezzo dell'utente, nella valuta dello strumento (la stessa del prezzo di chiusura). */
export const userPriceAlerts = pgTable(
  "user_price_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    direction: text("direction").$type<PriceAlertDirection>().notNull(),
    targetPrice: numeric("target_price", { precision: 20, scale: 8 }).notNull(),
    status: text("status").$type<PriceAlertStatus>().notNull().default("attivo"),
    triggeredAt: timestamp("triggered_at", { withTimezone: true }),
    triggeredPrice: numeric("triggered_price", { precision: 20, scale: 8 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("user_price_alerts_user_instrument_idx").on(table.userId, table.instrumentId),
    index("user_price_alerts_status_idx").on(table.status),
  ]
);

export type UserPriceAlert = typeof userPriceAlerts.$inferSelect;
