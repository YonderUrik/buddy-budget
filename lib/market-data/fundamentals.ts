import "server-only";
import type { Instrument, InstrumentType } from "@/lib/db/schema/investments";
import { logger, recordFundamentalsRequest, type Logger } from "@/lib/observability";
import { redis } from "@/lib/redis/client";
import { fetchYahooFundamentals, fetchYahooStatements, type YahooFundamentals, type YahooProfileKind } from "./providers/yahoo";
import type { CompanyStatements } from "./statements";
import { loadSymbols } from "./store";
import type { ProviderContext } from "./types";

export type { YahooFundamentals as TitleFundamentals };
export type { CompanyStatements };

/** I numeri chiave cambiano lentamente: una richiesta a Yahoo al giorno per strumento basta. */
export const FUNDAMENTALS_CACHE_TTL_SECONDS = 24 * 60 * 60;
/** Se Yahoo non ha risposto o non ha numeri, si riprova prima (ma non a ogni visita). */
export const FUNDAMENTALS_EMPTY_TTL_SECONDS = 60 * 60;
/** Tipi per cui Yahoo ha numeri chiave: azioni, ETF e fondi. Crypto, obbligazioni ed ETC non ne hanno. */
export const FUNDAMENTALS_TYPES: readonly InstrumentType[] = ["azione", "etf", "fondo"];

/** Fonte dei fondamentali: Yahoo in produzione, finta in sviluppo e nei test. */
export interface FundamentalsProvider {
  fetchFundamentals(symbol: string, kind: YahooProfileKind, ctx: ProviderContext): Promise<YahooFundamentals | null>;
  /** Bilanci annuali e degli ultimi 12 mesi (solo azioni). */
  fetchStatements(symbol: string, ctx: ProviderContext): Promise<CompanyStatements | null>;
}

export const yahooFundamentalsProvider: FundamentalsProvider = {
  fetchFundamentals: fetchYahooFundamentals,
  fetchStatements: (symbol, ctx) => fetchYahooStatements(symbol, ctx),
};

/** Esito per la pagina: `unsupported` (tipo senza numeri), `unavailable` (fonte muta o senza simbolo), `ok`. */
export type FundamentalsResult =
  | { status: "ok"; fundamentals: YahooFundamentals }
  | { status: "unsupported" | "unavailable" };

// v2: dal 2026-10-11 i numeri chiave hanno più campi; le voci vecchie in cache non li hanno.
const cacheKey = (instrumentId: string) => `market:fundamentals:v2:${instrumentId}`;
const statementsKey = (instrumentId: string) => `market:statements:v1:${instrumentId}`;

/**
 * Valore da Redis con riempimento dalla fonte: `null` in cache = la fonte non aveva dati (si riprova dopo il TTL
 * corto). Redis giù = si chiede direttamente alla fonte. Gli errori della fonte risalgono al chiamante.
 */
async function cached<T>(key: string, load: () => Promise<T | null>, onFetched: (value: T | null) => void): Promise<T | null> {
  try {
    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit) as T | null;
  } catch {
    // Redis giù: si prosegue senza cache.
  }
  const value = await load();
  onFetched(value);
  try {
    await redis.set(key, JSON.stringify(value), "EX", value ? FUNDAMENTALS_CACHE_TTL_SECONDS : FUNDAMENTALS_EMPTY_TTL_SECONDS);
  } catch {
    // Cache non scrivibile: la risposta vale comunque.
  }
  return value;
}

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
    const symbol = (await loadSymbols([instrument.id])).get(instrument.id)?.yahoo;
    if (!symbol) return { status: "unavailable" };
    const kind: YahooProfileKind = instrument.type === "azione" ? "company" : "fund";
    const fundamentals = await cached(
      cacheKey(instrument.id),
      () => (options.provider ?? yahooFundamentalsProvider).fetchFundamentals(symbol, kind, ctx),
      (value) => recordFundamentalsRequest("snapshot", value ? "ok" : "empty")
    );
    return fundamentals ? { status: "ok", fundamentals } : { status: "unavailable" };
  } catch (error) {
    recordFundamentalsRequest("snapshot", "error");
    log.warn("market.fundamentals.failed", { error });
    return { status: "unavailable" };
  }
}

/**
 * Bilanci di un'azienda (solo azioni con prezzi automatici), con la stessa cache dei numeri chiave. Non lancia mai:
 * senza simbolo, senza dati o con la fonte giù restituisce null e la pagina mostra solo i numeri chiave.
 */
export async function loadStatements(
  instrument: Pick<Instrument, "id" | "type" | "priceMode">,
  ctx: ProviderContext,
  options: { provider?: FundamentalsProvider; log?: Logger } = {}
): Promise<CompanyStatements | null> {
  if (instrument.priceMode !== "auto" || instrument.type !== "azione") return null;
  const log = options.log ?? logger;
  try {
    const symbol = (await loadSymbols([instrument.id])).get(instrument.id)?.yahoo;
    if (!symbol) return null;
    return await cached(
      statementsKey(instrument.id),
      () => (options.provider ?? yahooFundamentalsProvider).fetchStatements(symbol, ctx),
      (value) => {
        recordFundamentalsRequest("statements", value ? "ok" : "empty");
        if (!value) log.info("market.statements.empty", { symbol });
      }
    );
  } catch (error) {
    recordFundamentalsRequest("statements", "error");
    log.warn("market.statements.failed", { error });
    return null;
  }
}
