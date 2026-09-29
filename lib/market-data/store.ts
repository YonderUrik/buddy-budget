import { and, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import {
  fxRates,
  instrumentPrices,
  instrumentSymbols,
  instruments,
  investmentPortfolios,
  investmentTransactions,
  type Instrument,
} from "@/lib/db/schema/investments";
import type { DailyClose, FxDailyRate, FxProviderId, ProviderId } from "./types";

/** Righe per insert: blocchi abbastanza grandi da evitare una query per giorno, abbastanza piccoli per i parametri. */
export const PRICE_INSERT_BATCH_SIZE = 500;

/** Soglia sotto cui la quantità netta di uno strumento è considerata zero. */
const HELD_EPSILON = "0.0000001";

/**
 * Strumenti `auto` da aggiornare ogni sera: posseduti oggi da almeno un utente (quantità netta positiva) o scelti
 * come benchmark. La somma SQL non applica gli split, quindi uno strumento con uno split si considera posseduto.
 */
export async function findHeldAutoInstruments(): Promise<Instrument[]> {
  const held = db
    .select({ instrumentId: investmentTransactions.instrumentId })
    .from(investmentTransactions)
    .groupBy(investmentTransactions.instrumentId)
    .having(
      sql`sum(case when ${investmentTransactions.type} = 'acquisto' then ${investmentTransactions.quantity}
        when ${investmentTransactions.type} in ('vendita', 'rimborso') then -${investmentTransactions.quantity}
        else 0 end) > ${HELD_EPSILON}
        or bool_or(${investmentTransactions.type} = 'split')`
    );
  const benchmarks = db
    .select({ instrumentId: investmentPortfolios.benchmarkInstrumentId })
    .from(investmentPortfolios)
    .where(isNotNull(investmentPortfolios.benchmarkInstrumentId));
  return db
    .select()
    .from(instruments)
    .where(
      and(eq(instruments.priceMode, "auto"), or(inArray(instruments.id, held), inArray(instruments.id, benchmarks)))
    );
}

/** Valute per cui servono i cambi: quelle degli strumenti posseduti e quelle degli utenti che investono. */
export async function findNeededCurrencies(heldInstruments: Instrument[]): Promise<string[]> {
  const userCurrencies = await db
    .selectDistinct({ currency: authUser.currency })
    .from(authUser)
    .innerJoin(investmentTransactions, eq(investmentTransactions.userId, authUser.id));
  const all = new Set<string>([...heldInstruments.map((i) => i.currency), ...userCurrencies.map((u) => u.currency)]);
  all.delete("EUR");
  return [...all].sort();
}

/** Simboli per fonte degli strumenti richiesti. */
export async function loadSymbols(instrumentIds: string[]): Promise<Map<string, Partial<Record<ProviderId, string>>>> {
  const result = new Map<string, Partial<Record<ProviderId, string>>>();
  if (instrumentIds.length === 0) return result;
  const rows = await db.select().from(instrumentSymbols).where(inArray(instrumentSymbols.instrumentId, instrumentIds));
  for (const row of rows) {
    const symbols = result.get(row.instrumentId) ?? {};
    symbols[row.provider] = row.symbol;
    result.set(row.instrumentId, symbols);
  }
  return result;
}

/** Salva i simboli mancanti di uno strumento; quelli già presenti non si toccano. */
export async function saveSymbols(instrumentId: string, symbols: Partial<Record<ProviderId, string>>): Promise<void> {
  const values = Object.entries(symbols).map(([provider, symbol]) => ({
    instrumentId,
    provider: provider as ProviderId,
    symbol: symbol!,
  }));
  if (values.length === 0) return;
  await db.insert(instrumentSymbols).values(values).onConflictDoNothing();
}

/** Ultima chiusura salvata dello strumento (per il controllo di plausibilità), o null. */
export async function findLastClose(instrumentId: string): Promise<{ date: string; close: number; source: string } | null> {
  const [row] = await db
    .select({ date: instrumentPrices.date, close: instrumentPrices.close, source: instrumentPrices.source })
    .from(instrumentPrices)
    .where(eq(instrumentPrices.instrumentId, instrumentId))
    .orderBy(desc(instrumentPrices.date))
    .limit(1);
  return row ? { date: row.date, close: Number(row.close), source: row.source } : null;
}

/** Data della prima chiusura salvata, o null se lo storico è vuoto. */
export async function findFirstPriceDate(instrumentId: string): Promise<string | null> {
  const [row] = await db
    .select({ date: sql<string>`min(${instrumentPrices.date})` })
    .from(instrumentPrices)
    .where(eq(instrumentPrices.instrumentId, instrumentId));
  return row?.date ?? null;
}

/**
 * Salva chiusure a blocchi. `overwrite` (aggiornamento giornaliero) sostituisce valore e fonte di un giorno già
 * presente: l'ultima lettura buona vince. Il recupero storico invece non tocca i giorni già salvati.
 */
export async function savePrices(
  instrumentId: string,
  closes: DailyClose[],
  source: ProviderId,
  options: { overwrite: boolean; onBatch?: (saved: number) => void }
): Promise<number> {
  let saved = 0;
  for (let i = 0; i < closes.length; i += PRICE_INSERT_BATCH_SIZE) {
    const batch = closes.slice(i, i + PRICE_INSERT_BATCH_SIZE).map((c) => ({
      instrumentId,
      date: c.date,
      close: String(c.close),
      source,
    }));
    const insert = db.insert(instrumentPrices).values(batch);
    await (options.overwrite
      ? insert.onConflictDoUpdate({
          target: [instrumentPrices.instrumentId, instrumentPrices.date],
          set: { close: sql`excluded.close`, source: sql`excluded.source` },
        })
      : insert.onConflictDoNothing());
    saved += batch.length;
    options.onBatch?.(saved);
  }
  return saved;
}

/** Salva i cambi, sostituendo quelli dello stesso giorno. */
export async function saveFxRates(rates: FxDailyRate[], source: FxProviderId): Promise<number> {
  for (let i = 0; i < rates.length; i += PRICE_INSERT_BATCH_SIZE) {
    const batch = rates.slice(i, i + PRICE_INSERT_BATCH_SIZE).map((r) => ({
      date: r.date,
      currency: r.currency,
      perEur: String(r.perEur),
      source,
    }));
    await db
      .insert(fxRates)
      .values(batch)
      .onConflictDoUpdate({
        target: [fxRates.date, fxRates.currency],
        set: { perEur: sql`excluded.per_eur`, source: sql`excluded.source` },
      });
  }
  return rates.length;
}
