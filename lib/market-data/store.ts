import { and, desc, eq, inArray, isNotNull, isNull, lte, notLike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { PUBLIC_DEMO_USER_PREFIX } from "@/lib/public-demo/config";
import {
  fxRates,
  instrumentPrices,
  instrumentSymbols,
  instruments,
  investmentPortfolios,
  investmentTransactions,
  userPriceAlerts,
  userWatchlistItems,
  type Instrument,
} from "@/lib/db/schema/investments";
import type { DailyClose, FxDailyRate, FxProviderId, ProviderId } from "./types";

/** Righe per insert: blocchi abbastanza grandi da evitare una query per giorno, abbastanza piccoli per i parametri. */
export const PRICE_INSERT_BATCH_SIZE = 500;

/** Soglia sotto cui la quantità netta di uno strumento è considerata zero. */
const HELD_EPSILON = "0.0000001";

/**
 * Strumenti `auto` da aggiornare ogni sera: posseduti oggi da almeno un utente (quantità netta positiva) o scelti
 * come benchmark, seguiti in una watchlist o con un avviso di prezzo attivo. La somma SQL non applica gli split, quindi uno strumento con uno split si considera posseduto.
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
  const watched = db.select({ instrumentId: userWatchlistItems.instrumentId }).from(userWatchlistItems);
  const alerted = db
    .select({ instrumentId: userPriceAlerts.instrumentId })
    .from(userPriceAlerts)
    .where(eq(userPriceAlerts.status, "attivo"));
  return db
    .select()
    .from(instruments)
    .where(
      and(
        eq(instruments.priceMode, "auto"),
        // The public demo's invented securities carry their own price history: no source knows them.
        or(isNull(instruments.createdByUserId), notLike(instruments.createdByUserId, `${PUBLIC_DEMO_USER_PREFIX}%`)),
        or(
          inArray(instruments.id, held),
          inArray(instruments.id, benchmarks),
          inArray(instruments.id, watched),
          inArray(instruments.id, alerted)
        )
      )
    );
}

/**
 * Currencies that need exchange rates: those of the instruments with automatic prices, those of every instrument
 * someone has operations on (manual ones too: a manual-only currency got no new rates and its positions were valued
 * on an old rate, or at zero once the window moved past it) and those of the users who invest.
 */
export async function findNeededCurrencies(heldInstruments: Instrument[]): Promise<string[]> {
  const [userCurrencies, operated] = await Promise.all([
    db.selectDistinct({ currency: authUser.currency }).from(authUser).innerJoin(investmentTransactions, eq(investmentTransactions.userId, authUser.id)),
    db.selectDistinct({ currency: instruments.currency }).from(instruments).innerJoin(investmentTransactions, eq(investmentTransactions.instrumentId, instruments.id)),
  ]);
  const all = new Set<string>([...heldInstruments.map((i) => i.currency), ...userCurrencies.map((u) => u.currency), ...operated.map((o) => o.currency)]);
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

/**
 * Inizio della copertura di chiusure che arriva fino a `toKey`, o null se i dati non coprono il periodo richiesto.
 *
 * Due cose contano, non solo l'esistenza di un prezzo vecchio.
 *
 * 1. La chiusura più recente entro `toKey` deve stare dentro `maxGapDays` da `toKey`: se i dati finiscono molto
 *    prima, l'intervallo richiesto non è coperto (è il caso di un prezzo isolato e poi il vuoto).
 * 2. Da lì si scende finché non si incontra un buco più largo di `maxGapDays` tra due chiusure consecutive — la
 *    tolleranza con cui l'aggiornamento giornaliero rilegge a ogni giro (`DAILY_LOOKBACK_DAYS`), che assorbe
 *    weekend, festivi e un giro saltato del cron. Un buco in mezzo (import parziale, fonte che risponde a metà)
 *    non deve far credere che il periodo sia coperto.
 */
export async function findCoveredFrom(instrumentId: string, toKey: string, maxGapDays: number): Promise<string | null> {
  const rows = await db
    .select({ date: instrumentPrices.date })
    .from(instrumentPrices)
    .where(and(eq(instrumentPrices.instrumentId, instrumentId), lte(instrumentPrices.date, toKey)))
    .orderBy(desc(instrumentPrices.date));
  if (rows.length === 0) return null;
  if (calendarDaysBetween(rows[0].date, toKey) > maxGapDays) return null;

  let from = rows[0].date;
  for (let i = 1; i < rows.length; i += 1) {
    // `rows[i]` è più vecchia: se dista dalla precedente più della tolleranza, la copertura si ferma qui.
    if (calendarDaysBetween(rows[i].date, rows[i - 1].date) > maxGapDays) return from;
    from = rows[i].date;
  }
  return from;
}

/** Giorni di calendario da `from` a `to`, entrambe chiavi `YYYY-MM-DD`; negativo se `to` precede `from`. */
function calendarDaysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
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
          set: { close: sql`excluded.close`, source: sql`excluded.source`, updatedAt: new Date() },
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
        set: { perEur: sql`excluded.per_eur`, source: sql`excluded.source`, updatedAt: new Date() },
      });
  }
  return rates.length;
}
