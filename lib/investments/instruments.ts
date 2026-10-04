import { and, eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { instrumentSymbols, instruments, type Instrument, type NewInstrument } from "@/lib/db/schema/investments";
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

/** Ricerca tra gli strumenti già noti per ISIN o nome. */
export async function searchKnownInstruments(userId: string, query: string, limit = 8): Promise<Instrument[]> {
  const q = query.trim();
  if (!q) return [];
  const escaped = q.replace(/[%_\\]/g, (c) => `\\${c}`);
  return db
    .select()
    .from(instruments)
    .where(and(visibleTo(userId), or(eq(instruments.isin, q.toUpperCase()), ilike(instruments.name, `%${escaped}%`))))
    .limit(limit);
}

async function findBySymbol(provider: ProviderId, symbol: string): Promise<Instrument | null> {
  const [row] = await db
    .select({ instrument: instruments })
    .from(instrumentSymbols)
    .innerJoin(instruments, eq(instrumentSymbols.instrumentId, instruments.id))
    .where(and(eq(instrumentSymbols.provider, provider), eq(instrumentSymbols.symbol, symbol)));
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

/** Dipendenze di rete della creazione (lettura di valuta e borsa da Yahoo). */
export interface CreateInstrumentDeps {
  quoteMeta(symbol: string): Promise<{ currency: string | null; exchange: string | null } | null>;
}

/**
 * Crea uno strumento o riusa quello esistente (stesso ISIN o stesso simbolo sulla fonte). Gli strumenti da Yahoo,
 * CoinGecko e ISIN sono comuni a tutti; quelli manuali sono visibili solo a chi li crea. La valuta di uno strumento
 * Yahoo la legge il server, non la dichiara il client: la tabella è condivisa.
 */
export async function createOrReuseInstrument(
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
      const values: NewInstrument = {
        isin: input.isin ?? null,
        name: input.name,
        type: input.type,
        currency: meta.currency,
        exchange: meta.exchange,
        priceUnit: input.type === "obbligazione" ? "percentuale_nominale" : "unita",
        ...(taxRate ? { taxRate } : {}),
        taxHarmonized: taxHarmonized ?? null,
      };
      const symbols = deriveSymbols({ isin: values.isin ?? null, type: input.type, currency: meta.currency, yahooSymbol: input.yahooSymbol });
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
      const existing = await findByIsin(input.isin);
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
