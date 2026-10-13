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
export const INVESTMENT_TRANSACTION_TYPES = ["acquisto", "vendita", "dividendo", "cedola", "rimborso", "split", "rettifica"] as const;
export type InvestmentTransactionType = (typeof INVESTMENT_TRANSACTION_TYPES)[number];

export const PLAN_FREQUENCIES = ["mensile", "bimestrale", "trimestrale"] as const;
export type PlanFrequency = (typeof PLAN_FREQUENCIES)[number];

/** Aliquota italiana di default sui redditi finanziari (12,5% per titoli di Stato, si imposta per strumento). */
export const DEFAULT_TAX_RATE = "0.2600";

/** Regime fiscale del portafoglio: il broker fa da sostituto d'imposta (amministrato) o si paga in dichiarazione. */
export const TAX_REGIMES = ["amministrato", "dichiarativo"] as const;
export type TaxRegime = (typeof TAX_REGIMES)[number];

/** Cedole all'anno di un'obbligazione: annuale, semestrale, trimestrale. */
export const COUPON_FREQUENCIES = [1, 2, 4] as const;
export type CouponFrequency = (typeof COUPON_FREQUENCIES)[number];

export const INTEREST_RATE_SERIES = ["estr"] as const;
export type InterestRateSeries = (typeof INTEREST_RATE_SERIES)[number];

export const PRICE_ALERT_DIRECTIONS = ["sopra", "sotto"] as const;
export type PriceAlertDirection = (typeof PRICE_ALERT_DIRECTIONS)[number];

export const PRICE_ALERT_STATUSES = ["attivo", "scattato"] as const;
export type PriceAlertStatus = (typeof PRICE_ALERT_STATUSES)[number];

