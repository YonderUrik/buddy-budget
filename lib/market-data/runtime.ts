import "server-only";
import type { Instrument } from "@/lib/db/schema/investments";
import { logger } from "@/lib/observability";
import { browserTlsFetch } from "./browser-fetch";
import {
  FAKE_FX_PROVIDER,
  FAKE_PRICE_PROVIDERS,
  fakeCryptoSearch,
  fakeQuoteMeta,
  fakeSearch,
  isFakeMarketData,
} from "./fake";
import { fetchYahooQuoteMeta, searchCoinGecko, searchYahoo, setYahooSessionStore, type YahooSearchHit } from "./providers";
import { redisBackfillStore, redisBudgetStore, redisYahooSessionStore } from "./redis-stores";
import { findFirstPriceDate } from "./store";
import type { ProviderContext } from "./types";
import { backfillInstrument, type MarketDataDeps } from "./update";

// Sessione Yahoo condivisa su Redis tra i pod, invece che in memoria per processo (vedi yahoo.ts).
setYahooSessionStore(redisYahooSessionStore);

/** Contesto reale delle fonti: `fetch` con TLS da browser (vedi browser-fetch.ts) e variabili d'ambiente del processo. */
function realContext(): ProviderContext {
  return { fetch: browserTlsFetch, env: process.env };
}

/** Dipendenze dell'aggiornamento prezzi: fonti vere, o finte con `MARKET_DATA_FAKE=1` fuori produzione. */
export function marketDataDeps(): MarketDataDeps {
  const base = { ctx: realContext(), budget: redisBudgetStore };
  return isFakeMarketData() ? { ...base, providers: FAKE_PRICE_PROVIDERS, fxProviders: [FAKE_FX_PROVIDER] } : base;
}

/** Ricerca strumenti su Yahoo (o sul catalogo finto). */
export async function searchInstrumentsOnProviders(query: string): Promise<YahooSearchHit[]> {
  return isFakeMarketData() ? fakeSearch(query) : searchYahoo(query, realContext());
}

/** Ricerca crypto su CoinGecko (o sull'elenco finto). */
export async function searchCryptoOnProviders(query: string): Promise<{ id: string; name: string; symbol: string }[]> {
  return isFakeMarketData() ? fakeCryptoSearch(query) : searchCoinGecko(query, realContext());
}

/** Valuta e borsa di un simbolo Yahoo, o null se Yahoo non lo conosce. */
export async function quoteMetaOnProviders(symbol: string): Promise<{ currency: string | null; exchange: string | null } | null> {
  return isFakeMarketData() ? fakeQuoteMeta(symbol) : fetchYahooQuoteMeta(symbol, realContext());
}

/** Giorni di storico chiesti alla creazione di uno strumento, prima che ci siano operazioni. */
export const INITIAL_HISTORY_DAYS = 30;

/**
 * Avvia in background il recupero dello storico se mancano prezzi da `fromKey` in poi (strumenti `auto`).
 * `schedule` è `after()` di Next.js nelle route. Restituisce true se un recupero è partito ora.
 */
export async function ensureHistory(
  instrument: Instrument,
  fromKey: string,
  schedule: (task: () => Promise<void>) => void
): Promise<boolean> {
  if (instrument.priceMode !== "auto") return false;
  const firstPrice = await findFirstPriceDate(instrument.id);
  if (firstPrice !== null && firstPrice <= fromKey) return false;
  if (!(await redisBackfillStore.tryStart(instrument.id))) return false;

  schedule(async () => {
    let saved = 0;
    try {
      const result = await backfillInstrument(instrument, fromKey, new Date(), marketDataDeps(), (done, total) => {
        saved = done;
        void redisBackfillStore.progress(instrument.id, done, total);
      });
      await redisBackfillStore.finish(instrument.id, result.source ? "done" : "failed", result.saved);
    } catch (error) {
      logger.error("market.backfill.failed", { error });
      await redisBackfillStore.finish(instrument.id, "failed", saved);
    }
  });
  return true;
}
