import type { FxProvider, PriceProvider, ProviderId } from "../types";
import { alphaVantageProvider } from "./alphavantage";
import { borsaItalianaProvider } from "./borsaitaliana";
import { coinGeckoProvider } from "./coingecko";
import { ecbProvider } from "./ecb";
import { frankfurterProvider } from "./frankfurter";
import { krakenProvider } from "./kraken";
import { stooqProvider } from "./stooq";
import { twelveDataProvider } from "./twelvedata";
import { yahooProvider } from "./yahoo";

/** Tutte le fonti di prezzi per id: la catena sceglie l'ordine, qui c'è solo il registro. */
export const PRICE_PROVIDERS: Record<ProviderId, PriceProvider> = {
  yahoo: yahooProvider,
  borsaitaliana: borsaItalianaProvider,
  stooq: stooqProvider,
  alphavantage: alphaVantageProvider,
  twelvedata: twelveDataProvider,
  coingecko: coinGeckoProvider,
  kraken: krakenProvider,
};

/** Fonti dei cambi in ordine: BCE, poi Frankfurter. */
export const FX_PROVIDERS: readonly FxProvider[] = [ecbProvider, frankfurterProvider];

export { BORSAITALIANA_EXCHANGE_BY_TYPE, resetBorsaItalianaSession } from "./borsaitaliana";
export { searchCoinGecko } from "./coingecko";
export { fetchYahooQuoteMeta, searchYahoo, type YahooSearchHit } from "./yahoo";
