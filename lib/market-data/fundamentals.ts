import "server-only";
import type { Instrument, InstrumentType } from "@/lib/db/schema/investments";
import { logger, type Logger } from "@/lib/observability";
import { redis } from "@/lib/redis/client";
import { fetchYahooFundamentals, type YahooFundamentals, type YahooProfileKind } from "./providers/yahoo";
import { loadSymbols } from "./store";
import type { ProviderContext } from "./types";

export type { YahooFundamentals as TitleFundamentals };

/** I numeri chiave cambiano lentamente: una richiesta a Yahoo al giorno per strumento basta. */
export const FUNDAMENTALS_CACHE_TTL_SECONDS = 24 * 60 * 60;
/** Se Yahoo non ha risposto o non ha numeri, si riprova prima (ma non a ogni visita). */
export const FUNDAMENTALS_EMPTY_TTL_SECONDS = 60 * 60;
/** Tipi per cui Yahoo ha numeri chiave: azioni, ETF e fondi. Crypto, obbligazioni ed ETC non ne hanno. */
export const FUNDAMENTALS_TYPES: readonly InstrumentType[] = ["azione", "etf", "fondo"];

/** Fonte dei fondamentali: Yahoo in produzione, finta in sviluppo e nei test. */
export interface FundamentalsProvider {
  fetchFundamentals(symbol: string, kind: YahooProfileKind, ctx: ProviderContext): Promise<YahooFundamentals | null>;
}

export const yahooFundamentalsProvider: FundamentalsProvider = { fetchFundamentals: fetchYahooFundamentals };

/** Esito per la pagina: `unsupported` (tipo senza numeri), `unavailable` (fonte muta o senza simbolo), `ok`. */
export type FundamentalsResult =
  | { status: "ok"; fundamentals: YahooFundamentals }
  | { status: "unsupported" | "unavailable" };

const cacheKey = (instrumentId: string) => `market:fundamentals:${instrumentId}`;

/**
 * Numeri chiave di uno strumento, con cache su Redis (Redis giù = si chiede direttamente a Yahoo). Non lancia mai:
 * un guasto della fonte diventa `unavailable`.
 */
export async function loadFundamentals(
  instrument: Pick<Instrument, "id" | "type" | "priceMode">,
  ctx: ProviderContext,
  options: { provider?: FundamentalsProvider; log?: Logger } = {}
): Promise<FundamentalsResult> {
  if (instrument.priceMode !== "auto" || !FUNDAMENTALS_TYPES.includes(instrument.type)) return { status: "unsupported" };
  const log = options.log ?? logger;
  try {
    const cached = await redis.get(cacheKey(instrument.id));
    if (cached !== null) {
      const parsed = JSON.parse(cached) as YahooFundamentals | null;
      return parsed ? { status: "ok", fundamentals: parsed } : { status: "unavailable" };
    }
  } catch {
    // Redis giù: si prosegue senza cache.
  }
  try {
    const symbol = (await loadSymbols([instrument.id])).get(instrument.id)?.yahoo;
    if (!symbol) return { status: "unavailable" };
    const kind: YahooProfileKind = instrument.type === "azione" ? "company" : "fund";
    const fundamentals = await (options.provider ?? yahooFundamentalsProvider).fetchFundamentals(symbol, kind, ctx);
    try {
      await redis.set(
        cacheKey(instrument.id),
        JSON.stringify(fundamentals),
        "EX",
        fundamentals ? FUNDAMENTALS_CACHE_TTL_SECONDS : FUNDAMENTALS_EMPTY_TTL_SECONDS
      );
    } catch {
      // Cache non scrivibile: la risposta vale comunque.
    }
    return fundamentals ? { status: "ok", fundamentals } : { status: "unavailable" };
  } catch (error) {
    log.warn("market.fundamentals.failed", { error });
    return { status: "unavailable" };
  }
}
