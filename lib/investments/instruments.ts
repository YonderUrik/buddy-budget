import { and, eq, exists, ilike, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  instrumentSymbols,
  instruments,
  investmentTransactions,
  userInstrumentSettings,
  userPriceAlerts,
  userWatchlistItems,
  type Instrument,
  type InstrumentType,
  type NewInstrument,
} from "@/lib/db/schema/investments";
import { saveSymbols } from "@/lib/market-data/store";
import { deriveSymbols } from "@/lib/market-data/symbols";
import type { ProviderId } from "@/lib/market-data/types";
import type { CreateInstrumentInput } from "@/lib/validation/investments";

/** Strumenti visibili a un utente: quelli comuni e quelli manuali creati da lui. */
export function visibleTo(userId: string): SQL {
  return or(isNull(instruments.createdByUserId), eq(instruments.createdByUserId, userId))!;
}

/** Strumento visibile all'utente per id, o null (anche se esiste ma è il manuale di un altro). */
export async function findVisibleInstrument(userId: string, instrumentId: string): Promise<Instrument | null> {
  const [row] = await db.select().from(instruments).where(and(eq(instruments.id, instrumentId), visibleTo(userId)));
  return row ?? null;
}

/**
 * Strumenti legati all'utente: creati da lui (manuali), con sue operazioni, in watchlist, con un suo avviso o sue
 * impostazioni. Il catalogo comune è condiviso per i prezzi, ma non si elenca: altrimenti ognuno vedrebbe i titoli
 * che hanno aggiunto gli altri.
 */
export function linkedToUser(userId: string): SQL {
  return or(
    eq(instruments.createdByUserId, userId),
    exists(db.select({ one: investmentTransactions.id }).from(investmentTransactions).where(and(eq(investmentTransactions.instrumentId, instruments.id), eq(investmentTransactions.userId, userId)))),
    exists(db.select({ one: userWatchlistItems.id }).from(userWatchlistItems).where(and(eq(userWatchlistItems.instrumentId, instruments.id), eq(userWatchlistItems.userId, userId)))),
    exists(db.select({ one: userPriceAlerts.id }).from(userPriceAlerts).where(and(eq(userPriceAlerts.instrumentId, instruments.id), eq(userPriceAlerts.userId, userId)))),
    exists(db.select({ one: userInstrumentSettings.id }).from(userInstrumentSettings).where(and(eq(userInstrumentSettings.instrumentId, instruments.id), eq(userInstrumentSettings.userId, userId))))
  )!;
}

/** Ricerca per ISIN o nome tra gli strumenti dell'utente (non l'intero catalogo comune). */
export async function searchKnownInstruments(userId: string, query: string, limit = 8): Promise<Instrument[]> {
  const q = query.trim();
  if (!q) return [];
  const escaped = q.replace(/[%_\\]/g, (c) => `\\${c}`);
  return db
    .select()
    .from(instruments)
    .where(and(visibleTo(userId), linkedToUser(userId), or(eq(instruments.isin, q.toUpperCase()), ilike(instruments.name, `%${escaped}%`))))
    .limit(limit);
}

/** Strumento comune (non manuale) con quel simbolo: i manuali collegati a una quotazione restano privati. */
async function findBySymbol(provider: ProviderId, symbol: string): Promise<Instrument | null> {
  const [row] = await db
    .select({ instrument: instruments })
    .from(instrumentSymbols)
    .innerJoin(instruments, eq(instrumentSymbols.instrumentId, instruments.id))
    .where(and(eq(instrumentSymbols.provider, provider), eq(instrumentSymbols.symbol, symbol), isNull(instruments.createdByUserId)));
  return row?.instrument ?? null;
}

async function findByIsin(isin: string, userId?: string | null, currency?: string): Promise<Instrument | null> {
  const [row] = await db.select().from(instruments).where(and(eq(instruments.isin, isin),
    userId ? visibleTo(userId) : isNull(instruments.createdByUserId),
    currency ? eq(instruments.currency, currency) : undefined));
  return row ?? null;
}

/** Inserisce lo strumento; se nel frattempo un'altra richiesta ha creato lo stesso ISIN, restituisce quello. */
async function insertInstrument(values: NewInstrument, symbols: Partial<Record<ProviderId, string>>): Promise<Instrument> {
  try {
    const [created] = await db.insert(instruments).values(values).returning();
    await saveSymbols(created.id, symbols);
    return created;
  } catch (error) {
    if (values.isin) {
      const existing = await findByIsin(values.isin, values.createdByUserId, values.currency);
      if (existing) return existing;
    }
    throw error;
  }
}

/** Esito della creazione: `created` false se lo strumento esisteva già ed è stato riusato. */
export type CreateInstrumentOutcome =
  | { ok: true; instrument: Instrument; created: boolean }
  | { ok: false; status: 400 | 422 | 502; error: string };

/** Dipendenze di rete della creazione: dati della quotazione da Yahoo e quotazioni di un ISIN (OpenFIGI). */
export interface CreateInstrumentDeps {
  quoteMeta(symbol: string): Promise<{ currency: string | null; exchange: string | null; name?: string | null; type?: InstrumentType | null } | null>;
  /** Senza questa dipendenza (o se la fonte non risponde) l'ISIN indicato dal client non si lega allo strumento comune. */
  listings?(isin: string): Promise<{ yahooSymbol: string }[]>;
}

/**
 * ISIN da legare a uno strumento comune Yahoo: solo se OpenFIGI conferma che quel simbolo è una quotazione dell'ISIN.
 * Un legame sbagliato varrebbe per tutti (prezzi, dividendi, ricerca per ISIN), quindi nel dubbio non si lega.
 */
async function verifiedIsin(isin: string | undefined, yahooSymbol: string, deps: CreateInstrumentDeps): Promise<string | null> {
  if (!isin || !deps.listings) return null;
  try {
    const listings = await deps.listings(isin);
    return listings.some((listing) => listing.yahooSymbol.toUpperCase() === yahooSymbol.toUpperCase()) ? isin : null;
  } catch {
    return null;
  }
}

/**
 * Crea uno strumento o riusa quello esistente (stesso ISIN o stesso simbolo sulla fonte). Gli strumenti da Yahoo,
 * CoinGecko e ISIN sono comuni a tutti; quelli manuali sono visibili solo a chi li crea. La valuta di uno strumento
 * Yahoo la legge il server, non la dichiara il client: la tabella è condivisa. Aliquota e armonizzazione scelte
 * per uno strumento comune vanno tra le impostazioni dell'utente.
 */
export async function createOrReuseInstrument(
  userId: string,
  input: CreateInstrumentInput,
  deps: CreateInstrumentDeps
): Promise<CreateInstrumentOutcome> {
  const outcome = await findOrCreateInstrument(userId, input, deps);
  if (outcome.ok && outcome.instrument.createdByUserId === null) await savePersonalTaxChoice(userId, outcome.instrument.id, input);
  return outcome;
}

/**
 * Aliquota e armonizzazione scelte alla creazione di uno strumento comune: si salvano tra le impostazioni
 * dell'utente, mai sulla riga condivisa (varrebbero per tutti). Si scrivono solo i campi indicati.
 */
async function savePersonalTaxChoice(userId: string, instrumentId: string, input: CreateInstrumentInput): Promise<void> {
  const choice: { taxRate?: string; taxHarmonized?: boolean } = {};
  if ("taxRate" in input && input.taxRate) choice.taxRate = input.taxRate;
  if ("taxHarmonized" in input && input.taxHarmonized != null) choice.taxHarmonized = input.taxHarmonized;
  if (Object.keys(choice).length === 0) return;
  await db
    .insert(userInstrumentSettings)
    .values({ userId, instrumentId, ...choice })
    .onConflictDoUpdate({
      target: [userInstrumentSettings.userId, userInstrumentSettings.instrumentId],
      set: { ...choice, updatedAt: new Date() },
    });
}

async function findOrCreateInstrument(
  userId: string,
  input: CreateInstrumentInput,
  deps: CreateInstrumentDeps
): Promise<CreateInstrumentOutcome> {
  const taxRate = "taxRate" in input && input.taxRate ? input.taxRate : undefined;
  const taxHarmonized = "taxHarmonized" in input ? input.taxHarmonized : undefined;

  switch (input.source) {
    case "yahoo": {
      const bySymbol = await findBySymbol("yahoo", input.yahooSymbol);
      if (bySymbol) return { ok: true, instrument: bySymbol, created: false };
      if (input.isin) {
        const byIsin = await findByIsin(input.isin);
        if (byIsin) return { ok: true, instrument: byIsin, created: false };
      }
      let meta: Awaited<ReturnType<CreateInstrumentDeps["quoteMeta"]>>;
      try {
        meta = await deps.quoteMeta(input.yahooSymbol);
      } catch {
        return { ok: false, status: 502, error: "Fonte prezzi non raggiungibile, riprova tra poco" };
      }
      if (!meta?.currency) return { ok: false, status: 422, error: "Strumento non trovato sulla fonte prezzi" };
      // Lo strumento è comune: nome, tipo, valuta e ISIN vengono dalla fonte, non da quello che manda il client.
      const type = meta.type ?? input.type;
      const values: NewInstrument = {
        isin: await verifiedIsin(input.isin, input.yahooSymbol, deps),
        name: meta.name ?? input.name,
        type,
        currency: meta.currency,
        exchange: meta.exchange,
        priceUnit: type === "obbligazione" ? "percentuale_nominale" : "unita",
      };
      const symbols = deriveSymbols({ isin: values.isin ?? null, type, currency: meta.currency, yahooSymbol: input.yahooSymbol });
      return { ok: true, instrument: await insertInstrument(values, symbols), created: true };
    }
    case "coingecko": {
      const symbol = `${input.coingeckoId}:${input.currency}`;
      const existing = await findBySymbol("coingecko", symbol);
      if (existing) return { ok: true, instrument: existing, created: false };
      const symbols = deriveSymbols({ isin: null, type: "crypto", currency: input.currency, coingeckoId: input.coingeckoId });
      const created = await insertInstrument({ name: input.name, type: "crypto", currency: input.currency }, symbols);
      return { ok: true, instrument: created, created: true };
    }
    case "isin": {
      // Nome, tipo e valuta li indica il client e nessuna fonte li conferma: lo strumento nasce privato (prezzi
      // automatici comunque), così una scelta di un utente non vale per gli altri.
      const existing = await findByIsin(input.isin, userId, input.currency);
      if (existing) return { ok: true, instrument: existing, created: false };
      const symbols = deriveSymbols({ isin: input.isin, type: input.type, currency: input.currency });
      if (Object.keys(symbols).length === 0) {
        return { ok: false, status: 400, error: "Per questo tipo di strumento cercalo per nome, oppure crealo con prezzi manuali" };
      }
      const created = await insertInstrument(
        {
          isin: input.isin,
          name: input.name,
          type: input.type,
          currency: input.currency,
          priceUnit: input.type === "obbligazione" ? "percentuale_nominale" : "unita",
          ...(taxRate ? { taxRate } : {}),
          taxHarmonized: taxHarmonized ?? null,
          createdByUserId: userId,
        },
        symbols
      );
      return { ok: true, instrument: created, created: true };
    }
    case "manuale": {
      if (input.isin) {
        const existing = await findByIsin(input.isin, userId, input.currency);
        if (existing) return { ok: true, instrument: existing, created: false };
      }
      const created = await insertInstrument(
        {
          isin: input.isin ?? null,
          name: input.name,
          type: input.type,
          currency: input.currency,
          priceMode: "manuale",
          priceUnit: input.priceUnit ?? (input.type === "obbligazione" ? "percentuale_nominale" : "unita"),
          ...(taxRate ? { taxRate } : {}),
          taxHarmonized: taxHarmonized ?? null,
          createdByUserId: userId,
        },
        {}
      );
      return { ok: true, instrument: created, created: true };
    }
  }
}
