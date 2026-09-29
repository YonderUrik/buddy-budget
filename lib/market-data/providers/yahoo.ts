import type { InstrumentType, ProfileAssetMix, ProfileHolding } from "@/lib/db/schema/investments";
import { YAHOO_COMPANY_SECTORS, YAHOO_SECTOR_WEIGHTING_KEYS, countryCodeFromName } from "@/lib/investments/exposure-keys";
import { ProviderBlockedError, ProviderError, ProviderRateLimitedError } from "../errors";
import {
  BROWSER_USER_AGENT,
  PROVIDER_TIMEOUT_MS,
  providerGet,
  readJson,
  setCookieHeader,
  toUnixSeconds,
  utcDateKey,
} from "../http";
import type { DailyClose, PriceProvider, ProviderContext } from "../types";

const CHART_URL = "https://query2.finance.yahoo.com/v8/finance/chart/";
const SEARCH_URL = "https://query2.finance.yahoo.com/v1/finance/search";

/**
 * Sessione Yahoo, come fa `yahoo-finance2`: senza il cookie A3 (impostato da `fc.yahoo.com`) e il "crumb" legato a
 * quel cookie, gli endpoint `query*` rispondono spesso 429 anche alla prima richiesta. Il cookie si prende una
 * volta e si riusa; se Yahoo non lo dà si procede senza, riprovando più tardi.
 */
const COOKIE_URL = "https://fc.yahoo.com/";
const CRUMB_URL = "https://query2.finance.yahoo.com/v1/test/getcrumb";
/** Durata di una sessione Yahoo riusata dentro lo stesso processo. */
export const YAHOO_SESSION_TTL_MS = 60 * 60 * 1000;
/** Dopo un tentativo fallito di ottenere la sessione, attesa prima di riprovare (evita 2 chiamate in più a ricerca). */
export const YAHOO_SESSION_RETRY_MS = 5 * 60 * 1000;
/** Dopo un rifiuto (429/403) confermato, pausa prima di ritentare Yahoo: evita di martellare una fonte già in rifiuto. */
export const YAHOO_COOLDOWN_MS = 3 * 60 * 1000;
/** Un crumb è una stringa corta senza spazi; una pagina HTML o un JSON d'errore non lo sono. */
const CRUMB_PATTERN = /^[^\s<>{}"]{1,64}$/;

interface YahooSession {
  cookie: string;
  crumb: string | null;
}

/**
 * Cache della sessione Yahoo e del raffreddamento dopo un rifiuto. In produzione è su Redis (condivisa tra pod,
 * sopravvive ai riavvii); i test usano quella in memoria di default, mai toccata da Redis.
 */
export interface YahooSessionStore {
  /** Sessione cache, `undefined` se non salvata/scaduta (va rinegoziata), `null` se un tentativo precedente è fallito. */
  get(): Promise<YahooSession | null | undefined>;
  set(session: YahooSession | null, ttlSeconds: number): Promise<void>;
  isCoolingDown(): Promise<boolean>;
  markRefused(ttlSeconds: number): Promise<void>;
  clear(): Promise<void>;
}

function createMemoryYahooSessionStore(): YahooSessionStore {
  let entry: { session: YahooSession | null; expiresAt: number } | null = null;
  let coolingUntil = 0;
  return {
    async get() {
      if (!entry || entry.expiresAt <= Date.now()) return undefined;
      return entry.session;
    },
    async set(session, ttlSeconds) {
      entry = { session, expiresAt: Date.now() + ttlSeconds * 1000 };
    },
    async isCoolingDown() {
      return coolingUntil > Date.now();
    },
    async markRefused(ttlSeconds) {
      coolingUntil = Date.now() + ttlSeconds * 1000;
    },
    async clear() {
      entry = null;
      coolingUntil = 0;
    },
  };
}

let activeStore: YahooSessionStore = createMemoryYahooSessionStore();

/** Sostituisce lo store attivo (produzione: quello su Redis). Va chiamato una volta, al caricamento del modulo. */
export function setYahooSessionStore(store: YahooSessionStore): void {
  activeStore = store;
}

/** Svuota la sessione in cache e il raffreddamento (test, o dopo un rifiuto di Yahoo). */
export async function resetYahooSession(): Promise<void> {
  await activeStore.clear();
}

async function createSession(ctx: ProviderContext): Promise<YahooSession | null> {
  let cookie: string;
  try {
    // fc.yahoo.com risponde con un errore o un redirect, ma imposta comunque il cookie: niente redirect seguiti.
    const response = await ctx.fetch(COOKIE_URL, {
      headers: { "User-Agent": BROWSER_USER_AGENT },
      redirect: "manual",
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    cookie = setCookieHeader(response);
  } catch {
    return null;
  }
  if (!cookie) return null;
  let crumb: string | null = null;
  try {
    const response = await ctx.fetch(CRUMB_URL, {
      headers: { "User-Agent": BROWSER_USER_AGENT, Cookie: cookie },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    const text = (await response.text()).trim();
    if (response.ok && CRUMB_PATTERN.test(text)) crumb = text;
  } catch {
    // Il solo cookie basta a molti endpoint: si prosegue senza crumb.
  }
  return { cookie, crumb };
}

async function getSession(ctx: ProviderContext): Promise<YahooSession | null> {
  const cached = await activeStore.get();
  if (cached !== undefined) return cached;
  const session = await createSession(ctx);
  await activeStore.set(session, (session ? YAHOO_SESSION_TTL_MS : YAHOO_SESSION_RETRY_MS) / 1000);
  return session;
}

function withSession(url: string, session: YahooSession | null): { url: string; headers?: Record<string, string> } {
  if (!session) return { url };
  const crumbParam = session.crumb ? `&crumb=${encodeURIComponent(session.crumb)}` : "";
  return { url: `${url}${crumbParam}`, headers: { Cookie: session.cookie } };
}

function isRefusal(error: unknown): boolean {
  return error instanceof ProviderRateLimitedError || error instanceof ProviderBlockedError;
}

/**
 * GET verso Yahoo con cookie e crumb. Con `useCooldown` (la ricerca interattiva, priva di un proprio interruttore)
 * si salta subito la chiamata di rete se Yahoo ci ha rifiutato di recente; l'aggiornamento prezzi giornaliero/storico
 * ha già il proprio interruttore per run in `chain.ts` e non lo usa, per non alterarne i codici di errore.
 * Se Yahoo rifiuta (429, 401/403) una sessione già in cache, la sessione potrebbe essere scaduta: se ne prende una
 * nuova e si riprova una volta sola. Un rifiuto confermato attiva comunque il raffreddamento condiviso.
 */
async function yahooGet(url: string, ctx: ProviderContext, options: { useCooldown?: boolean } = {}): Promise<Response | null> {
  if (options.useCooldown && (await activeStore.isCoolingDown())) throw new ProviderRateLimitedError("yahoo");
  const wasCached = (await activeStore.get()) !== undefined;
  const session = await getSession(ctx);
  const first = withSession(url, session);
  try {
    return await providerGet("yahoo", first.url, ctx, { notFoundAsNull: true, headers: first.headers });
  } catch (error) {
    if (!isRefusal(error)) throw error;
    if (wasCached && session) {
      await resetYahooSession();
      const fresh = await getSession(ctx);
      if (fresh) {
        const retry = withSession(url, fresh);
        try {
          return await providerGet("yahoo", retry.url, ctx, { notFoundAsNull: true, headers: retry.headers });
        } catch (retryError) {
          if (isRefusal(retryError)) await activeStore.markRefused(YAHOO_COOLDOWN_MS / 1000);
          throw retryError;
        }
      }
    }
    await activeStore.markRefused(YAHOO_COOLDOWN_MS / 1000);
    throw error;
  }
}

/** Valute quotate in sottounità da Yahoo (pence, cent sudafricani, agorot): prezzo / 100 nella valuta vera. */
const MINOR_UNIT_CURRENCIES: Record<string, string> = { GBp: "GBP", GBX: "GBP", ZAc: "ZAR", ILA: "ILS" };

interface YahooChartResponse {
  chart: {
    result:
      | {
          meta: { currency?: string | null; gmtoffset?: number; exchangeName?: string; symbol?: string };
          timestamp?: number[];
          indicators: { quote: { close?: (number | null)[] }[] };
        }[]
      | null;
    error: { code?: string } | null;
  };
}

/** Valuta vera e divisore per una valuta dichiarata da Yahoo (gestisce le sottounità). */
export function normalizeYahooCurrency(currency: string | null | undefined): { currency: string | null; divisor: number } {
  if (!currency) return { currency: null, divisor: 1 };
  const major = MINOR_UNIT_CURRENCIES[currency];
  return major ? { currency: major, divisor: 100 } : { currency: currency.toUpperCase(), divisor: 1 };
}

/** Converte la risposta `chart` di Yahoo in chiusure giornaliere (data locale della borsa). */
export function parseYahooChart(body: YahooChartResponse): { closes: DailyClose[]; exchange: string | null } {
  const result = body.chart.result?.[0];
  if (!result) return { closes: [], exchange: null };
  const { currency, divisor } = normalizeYahooCurrency(result.meta.currency);
  const offsetMs = (result.meta.gmtoffset ?? 0) * 1000;
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators.quote[0]?.close ?? [];
  const byDate = new Map<string, DailyClose>();
  timestamps.forEach((ts, i) => {
    const close = closes[i];
    if (close === null || close === undefined) return;
    const date = utcDateKey(ts * 1000 + offsetMs);
    byDate.set(date, { date, close: close / divisor, currency });
  });
  return { closes: [...byDate.values()], exchange: result.meta.exchangeName ?? null };
}

async function fetchChart(symbol: string, period1: number, period2: number, ctx: ProviderContext) {
  const url = `${CHART_URL}${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=`;
  const response = await yahooGet(url, ctx);
  if (!response) return null;
  const body = await readJson<YahooChartResponse>("yahoo", response);
  if (body.chart.error && body.chart.error.code !== "Not Found") throw new ProviderError("yahoo", "chart error");
  return body;
}

/** Yahoo Finance (endpoint non ufficiali `chart` e `search`): prima fonte per ETF, azioni e fondi. */
export const yahooProvider: PriceProvider = {
  id: "yahoo",
  requiredKeyEnv: null,
  maxHistory: "unlimited",
  minDelayMs: 400,
  async fetchDailyCloses(symbol, from, to, ctx) {
    // period2 è esclusivo: si aggiunge un giorno per includere `to`.
    const body = await fetchChart(symbol, toUnixSeconds(from), toUnixSeconds(to) + 86_400, ctx);
    return body ? parseYahooChart(body).closes : [];
  },
};

/** Dati essenziali di una quotazione: valuta e borsa, dall'ultima settimana di `chart`. */
export async function fetchYahooQuoteMeta(
  symbol: string,
  ctx: ProviderContext,
  nowMs: number = Date.now()
): Promise<{ currency: string | null; exchange: string | null } | null> {
  const to = Math.floor(nowMs / 1000);
  const body = await fetchChart(symbol, to - 10 * 86_400, to, ctx);
  const meta = body?.chart.result?.[0]?.meta;
  if (!meta) return null;
  return { currency: normalizeYahooCurrency(meta.currency).currency, exchange: meta.exchangeName ?? null };
}

/** Risultato della ricerca Yahoo, già tradotto nei tipi dell'app. */
export interface YahooSearchHit {
  symbol: string;
  name: string;
  exchange: string;
  exchangeLabel: string;
  type: InstrumentType;
}

interface YahooSearchResponse {
  quotes?: {
    symbol?: string;
    shortname?: string;
    longname?: string;
    exchange?: string;
    exchDisp?: string;
    quoteType?: string;
  }[];
}

const QUOTE_TYPES: Record<string, InstrumentType> = {
  ETF: "etf",
  EQUITY: "azione",
  MUTUALFUND: "fondo",
  CRYPTOCURRENCY: "crypto",
  BOND: "obbligazione",
};

/** Traduce la risposta di ricerca, scartando i tipi non gestiti (indici, futures, valute). */
export function parseYahooSearch(body: YahooSearchResponse): YahooSearchHit[] {
  const hits: YahooSearchHit[] = [];
  for (const q of body.quotes ?? []) {
    const type = q.quoteType ? QUOTE_TYPES[q.quoteType] : undefined;
    if (!q.symbol || !type) continue;
    hits.push({
      symbol: q.symbol,
      name: q.longname ?? q.shortname ?? q.symbol,
      exchange: q.exchange ?? "",
      exchangeLabel: q.exchDisp ?? q.exchange ?? "",
      type,
    });
  }
  return hits;
}

/** Cerca strumenti per nome, ticker o ISIN. */
export async function searchYahoo(query: string, ctx: ProviderContext): Promise<YahooSearchHit[]> {
  const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}&quotesCount=15&newsCount=0&listsCount=0`;
  const response = await yahooGet(url, ctx, { useCooldown: true });
  if (!response) return [];
  return parseYahooSearch(await readJson<YahooSearchResponse>("yahoo", response));
}

const QUOTE_SUMMARY_URL = "https://query2.finance.yahoo.com/v10/finance/quoteSummary/";

interface YahooRawNumber {
  raw?: number;
}

interface YahooQuoteSummaryResponse {
  quoteSummary?: {
    result?:
      | {
          topHoldings?: {
            stockPosition?: YahooRawNumber;
            bondPosition?: YahooRawNumber;
            cashPosition?: YahooRawNumber;
            otherPosition?: YahooRawNumber;
            holdings?: { symbol?: string; holdingName?: string; holdingPercent?: YahooRawNumber }[];
            sectorWeightings?: Record<string, YahooRawNumber>[];
          };
          assetProfile?: { sector?: string; country?: string };
        }[]
      | null;
    error?: { code?: string } | null;
  };
}

/** Profilo di uno strumento letto da Yahoo `quoteSummary`, già nelle chiavi dell'app. */
export interface YahooProfile {
  sectors: Record<string, number> | null;
  assetMix: ProfileAssetMix | null;
  holdings: ProfileHolding[] | null;
  sector: string | null;
  country: string | null;
}

/** `company`: settore e paese di un'azienda; `fund`: settori, mix di attività e primi titoli di un ETF/fondo. */
export type YahooProfileKind = "company" | "fund";

function rawNumber(value: YahooRawNumber | undefined): number | null {
  return typeof value?.raw === "number" && Number.isFinite(value.raw) ? value.raw : null;
}

/** Converte la risposta `quoteSummary` (moduli `topHoldings` e `assetProfile`) nel profilo dell'app. */
export function parseYahooQuoteSummary(body: YahooQuoteSummaryResponse): YahooProfile | null {
  const result = body.quoteSummary?.result?.[0];
  if (!result) return null;
  const top = result.topHoldings;
  const sectors: Record<string, number> = {};
  for (const entry of top?.sectorWeightings ?? []) {
    for (const [yahooKey, value] of Object.entries(entry)) {
      const key = YAHOO_SECTOR_WEIGHTING_KEYS[yahooKey];
      const weight = rawNumber(value);
      if (key && weight !== null && weight > 0) sectors[key] = (sectors[key] ?? 0) + weight;
    }
  }
  const holdings: ProfileHolding[] = [];
  for (const h of top?.holdings ?? []) {
    const weight = rawNumber(h.holdingPercent);
    const name = h.holdingName?.trim() || h.symbol?.trim();
    if (name && weight !== null && weight > 0) holdings.push({ symbol: h.symbol?.trim() || null, name, weight });
  }
  const assetMix: ProfileAssetMix | null = top
    ? {
        stock: rawNumber(top.stockPosition),
        bond: rawNumber(top.bondPosition),
        cash: rawNumber(top.cashPosition),
        other: rawNumber(top.otherPosition),
      }
    : null;
  const hasMix = assetMix !== null && Object.values(assetMix).some((v) => v !== null);
  const sectorName = result.assetProfile?.sector;
  return {
    sectors: Object.keys(sectors).length > 0 ? sectors : null,
    assetMix: hasMix ? assetMix : null,
    holdings: holdings.length > 0 ? holdings : null,
    sector: sectorName ? (YAHOO_COMPANY_SECTORS[sectorName] ?? null) : null,
    country: countryCodeFromName(result.assetProfile?.country),
  };
}

/** Profilo di un simbolo Yahoo, o null se Yahoo non ha dati per quello strumento. */
export async function fetchYahooProfile(symbol: string, kind: YahooProfileKind, ctx: ProviderContext): Promise<YahooProfile | null> {
  const modules = kind === "company" ? "assetProfile" : "topHoldings";
  const response = await yahooGet(`${QUOTE_SUMMARY_URL}${encodeURIComponent(symbol)}?modules=${modules}`, ctx);
  if (!response) return null;
  return parseYahooQuoteSummary(await readJson<YahooQuoteSummaryResponse>("yahoo", response));
}
