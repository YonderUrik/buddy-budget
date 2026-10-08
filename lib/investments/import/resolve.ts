import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { instrumentSymbols, instruments, type Instrument } from "@/lib/db/schema/investments";
import type { YahooSearchHit } from "@/lib/market-data/providers/yahoo";
import { splitYahooSymbol } from "@/lib/market-data/symbols";
import type { ResolveImportInput } from "@/lib/validation/investments-import";
import { visibleTo } from "../instruments";
import type { ImportMatch } from "./types";

type Identity = ResolveImportInput["identities"][number];

/** Ricerche sulle fonti, iniettate per i test. */
export interface ResolveDeps {
  searchMarket(query: string): Promise<YahooSearchHit[]>;
  searchCrypto(query: string): Promise<{ id: string; name: string; symbol: string }[]>;
  /** Ripiego per un ISIN che Yahoo non trova: OpenFIGI propone le quotazioni, Yahoo le conferma (opzionale). */
  searchByIsin?(isin: string, currency: string | null): Promise<{ status: "ok" | "empty" | "unavailable"; hits: YahooSearchHit[] }>;
}

/** Simbolo crypto nello stile Yahoo: `BTC-EUR` → base `BTC`, valuta `EUR`. */
const YAHOO_CRYPTO_SYMBOL = /^([A-Z0-9]{2,10})-([A-Z]{3})$/;
/** Borsa Yahoo preferita quando un ISIN è quotato in più posti: Milano, poi Xetra. */
const PREFERRED_SUFFIXES = ["MI", "DE"];

async function knownBySymbol(userId: string, provider: "yahoo" | "coingecko", symbol: string): Promise<Instrument | null> {
  const [row] = await db
    .select({ instrument: instruments })
    .from(instrumentSymbols)
    .innerJoin(instruments, eq(instrumentSymbols.instrumentId, instruments.id))
    .where(and(eq(instrumentSymbols.provider, provider), eq(instrumentSymbols.symbol, symbol), visibleTo(userId)));
  return row?.instrument ?? null;
}

async function knownBy(userId: string, field: "isin" | "name", value: string, currency?: string | null): Promise<Instrument | null> {
  const condition = field === "isin" ? eq(instruments.isin, value) : sql`lower(${instruments.name}) = ${value.toLowerCase()}`;
  const [row] = await db.select().from(instruments).where(and(condition, visibleTo(userId), currency ? eq(instruments.currency, currency) : undefined)).limit(1);
  return row ?? null;
}

async function resolveCrypto(userId: string, base: string, currency: string, deps: ResolveDeps): Promise<ImportMatch> {
  let coins: Awaited<ReturnType<ResolveDeps["searchCrypto"]>>;
  try {
    coins = await deps.searchCrypto(base);
  } catch {
    return { kind: "none", reason: "unavailable" };
  }
  // CoinGecko ordina per capitalizzazione: il primo con lo stesso simbolo è quello giusto (BTC → bitcoin).
  const coin = coins.find((c) => c.symbol.toUpperCase() === base);
  if (!coin) return { kind: "none", reason: "not_found" };
  const known = await knownBySymbol(userId, "coingecko", `${coin.id}:${currency}`);
  if (known) return { kind: "known", instrument: known };
  return {
    kind: "proposal",
    input: { source: "coingecko", coingeckoId: coin.id, name: coin.name, currency },
    label: coin.name,
    detail: `${coin.symbol.toUpperCase()} · CoinGecko · ${currency}`,
    type: "crypto",
    confidence: "exact",
  };
}

/** Sceglie il risultato di ricerca: simbolo identico se c'è, altrimenti la quotazione preferita (da controllare). */
function pickHit(hits: YahooSearchHit[], identity: Identity): { hit: YahooSearchHit; confidence: "exact" | "guess" } | null {
  const usable = hits.filter((h) => h.type !== "crypto");
  if (identity.symbol) {
    const exact = usable.find((h) => h.symbol.toUpperCase() === identity.symbol);
    if (exact) return { hit: exact, confidence: "exact" };
    if (identity.symbolIsYahoo) return null;
  }
  const sameBase = identity.symbol ? usable.filter((h) => splitYahooSymbol(h.symbol).base.toUpperCase() === identity.symbol) : [];
  const pool = sameBase.length > 0 ? sameBase : usable;
  if (pool.length === 0) return null;
  const preferred = PREFERRED_SUFFIXES.map((s) => pool.find((h) => splitYahooSymbol(h.symbol).suffix === s)).find(Boolean);
  return { hit: preferred ?? pool[0], confidence: pool.length === 1 && identity.isin ? "exact" : "guess" };
}

/**
 * Ripiego per uno strumento con ISIN che la ricerca Yahoo non ha trovato: OpenFIGI propone le quotazioni e Yahoo le
 * conferma (nella valuta del file, se c'è). Sempre "da controllare": il nome e il tipo vengono da OpenFIGI.
 */
async function resolveByIsinFallback(userId: string, identity: Identity, deps: ResolveDeps): Promise<ImportMatch> {
  if (!identity.isin || !deps.searchByIsin) return { kind: "none", reason: "not_found" };
  const found = await deps.searchByIsin(identity.isin, identity.currency);
  if (found.status === "unavailable") return { kind: "none", reason: "unavailable" };
  const hit = found.hits[0];
  if (!hit) return { kind: "none", reason: "not_found" };
  const known = await knownBySymbol(userId, "yahoo", hit.symbol);
  if (known) return { kind: "known", instrument: known };
  return {
    kind: "proposal",
    input: { source: "yahoo", yahooSymbol: hit.symbol, name: identity.name ?? hit.name, type: identity.type ?? hit.type, isin: identity.isin },
    label: identity.name ?? hit.name,
    detail: `${hit.symbol} · ${hit.exchangeLabel} · trovato dall'ISIN`,
    type: identity.type ?? hit.type,
    confidence: "guess",
  };
}

/**
 * Per gli strumenti del rendiconto, che restano manuali con i prezzi del broker: dice se esiste una quotazione
 * (verificata su Yahoo, nella valuta del file) da collegare dopo l'import con «Cerca la quotazione».
 */
async function quotationHint(isin: string, currency: string, deps: ResolveDeps): Promise<string> {
  if (!deps.searchByIsin) return "";
  try {
    const found = await deps.searchByIsin(isin, currency);
    if (found.status === "unavailable") return "";
    const hit = found.hits[0];
    return hit ? ` · quotazione trovata: ${hit.symbol}, collegabile dopo l'import da «Cerca la quotazione»` : " · nessuna quotazione trovata";
  } catch {
    return "";
  }
}

/**
 * Abbina uno strumento del file: prima il catalogo (ISIN, simbolo Yahoo, nome identico), poi le fonti. I simboli
 * crypto di Yahoo (`ETH-EUR`) vanno su CoinGecko, che è la fonte delle crypto nell'app.
 */
export async function resolveIdentity(userId: string, identity: Identity, deps: ResolveDeps): Promise<ImportMatch> {
  if (identity.isin) {
    const known = await knownBy(userId, "isin", identity.isin, identity.currency);
    if (known && (!identity.currency || known.currency === identity.currency)) return { kind: "known", instrument: known };
  }
  // Broker ISIN + native currency is more reliable than an arbitrary Yahoo search listing.
  // Preserve the statement currency and use broker closing prices until an exchange listing is explicitly linked.
  if (!identity.symbolIsYahoo && identity.isin && identity.currency && identity.name) {
    const quotation = await quotationHint(identity.isin, identity.currency, deps);
    return { kind: "proposal", input: { source: "manuale", isin: identity.isin, name: identity.name, currency: identity.currency, type: identity.type ?? (/\b(ETF|UCITS)\b/i.test(identity.name) ? "etf" : "azione") }, label: identity.name, detail: `${identity.isin} · ${identity.currency} · prezzi dal rendiconto${quotation}`, type: identity.type ?? (/\b(ETF|UCITS)\b/i.test(identity.name) ? "etf" : "azione"), confidence: "exact" };
  }
  if (identity.type === "crypto" && identity.symbol && identity.currency && !identity.isin && !identity.symbolIsYahoo) return resolveCrypto(userId, identity.symbol, identity.currency, deps);
  const crypto = identity.symbol && !identity.isin ? YAHOO_CRYPTO_SYMBOL.exec(identity.symbol) : null;
  if (crypto && identity.symbolIsYahoo) return resolveCrypto(userId, crypto[1], crypto[2], deps);
  if (identity.symbol && identity.symbolIsYahoo) {
    const known = await knownBySymbol(userId, "yahoo", identity.symbol);
    if (known) return { kind: "known", instrument: known };
  }
  if (identity.name && !identity.isin && !identity.symbol) {
    const known = await knownBy(userId, "name", identity.name);
    if (known) return { kind: "known", instrument: known };
  }

  const query = identity.isin ?? identity.symbol ?? identity.name;
  if (!query) return { kind: "none", reason: "not_found" };
  let hits: YahooSearchHit[];
  try {
    hits = await deps.searchMarket(query);
  } catch {
    // Yahoo non risponde: per un ISIN si prova comunque la strada OpenFIGI, che conferma su Yahoo solo se risponde.
    const fallback = await resolveByIsinFallback(userId, identity, deps);
    return fallback.kind === "none" ? { kind: "none", reason: "unavailable" } : fallback;
  }
  const picked = pickHit(hits, identity);
  if (!picked) return resolveByIsinFallback(userId, identity, deps);
  const { hit, confidence } = picked;
  const known = await knownBySymbol(userId, "yahoo", hit.symbol);
  if (known) return { kind: "known", instrument: known };
  return {
    kind: "proposal",
    input: { source: "yahoo", yahooSymbol: hit.symbol, name: hit.name, type: hit.type, ...(identity.isin ? { isin: identity.isin } : {}) },
    label: hit.name,
    detail: `${hit.symbol} · ${hit.exchangeLabel}`,
    type: hit.type,
    confidence,
  };
}
