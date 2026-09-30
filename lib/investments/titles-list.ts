import "server-only";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { computePositions } from "@/lib/calc/investments";
import { db } from "@/lib/db/client";
import {
  instrumentPrices,
  instruments,
  userPriceAlerts,
  userWatchlistItems,
  type Instrument,
} from "@/lib/db/schema/investments";
import { loadUserTransactions } from "./data";
import { shiftDateKey, toCalcInput, todayKey } from "./operations";

/** Giorni di chiusure per la piccola linea di ogni titolo e per la variazione del mese. */
export const TITLE_LIST_SPARK_DAYS = 35;

/** Un titolo dell'elenco "Titoli": seguito, posseduto o entrambi. */
export interface TitleListItem {
  instrument: Instrument;
  held: boolean;
  watching: boolean;
  lastClose: number | null;
  lastDate: string | null;
  /** Variazione dalla chiusura precedente (frazione). */
  dayChange: number | null;
  /** Variazione sugli ultimi ~30 giorni (frazione), se lo storico arriva fin lì. */
  monthChange: number | null;
  /** Chiusure recenti in ordine di data, per la linea. */
  spark: number[];
  activeAlerts: number;
  triggeredAlerts: number;
}

/**
 * Elenco dei titoli dell'utente: quelli in watchlist e quelli posseduti. Legge solo chiusure delle fonti (i prezzi
 * manuali non entrano: un titolo manuale mostra "senza prezzo" finché non ha chiusure).
 */
export async function loadTitleList(userId: string): Promise<TitleListItem[]> {
  const [watch, transactions, alerts] = await Promise.all([
    db.select({ instrumentId: userWatchlistItems.instrumentId }).from(userWatchlistItems).where(eq(userWatchlistItems.userId, userId)),
    loadUserTransactions(userId),
    db
      .select({ instrumentId: userPriceAlerts.instrumentId, status: userPriceAlerts.status })
      .from(userPriceAlerts)
      .where(eq(userPriceAlerts.userId, userId)),
  ]);
  const watchedIds = new Set(watch.map((w) => w.instrumentId));
  const heldIds = new Set<string>();
  if (transactions.length > 0) {
    const ids = [...new Set(transactions.map((t) => t.instrumentId))];
    const rows = await db.select().from(instruments).where(inArray(instruments.id, ids));
    const positions = computePositions(
      transactions.map(toCalcInput),
      rows.map((i) => ({ id: i.id, name: i.name, type: i.type, currency: i.currency, priceUnit: i.priceUnit })),
      todayKey()
    );
    for (const p of positions.values()) if (p.quantity > 0) heldIds.add(p.instrumentId);
  }
  const allIds = [...new Set([...watchedIds, ...heldIds])];
  if (allIds.length === 0) return [];

  const from = shiftDateKey(todayKey(), -TITLE_LIST_SPARK_DAYS);
  const [instrumentRows, priceRows] = await Promise.all([
    db.select().from(instruments).where(inArray(instruments.id, allIds)),
    db
      .select({ instrumentId: instrumentPrices.instrumentId, date: instrumentPrices.date, close: instrumentPrices.close })
      .from(instrumentPrices)
      .where(and(inArray(instrumentPrices.instrumentId, allIds), gte(instrumentPrices.date, from)))
      .orderBy(asc(instrumentPrices.date)),
  ]);
  const closesById = new Map<string, { date: string; close: number }[]>();
  for (const row of priceRows) {
    const list = closesById.get(row.instrumentId) ?? [];
    list.push({ date: row.date, close: Number(row.close) });
    closesById.set(row.instrumentId, list);
  }
  const alertCount = (id: string, status: string) => alerts.filter((a) => a.instrumentId === id && a.status === status).length;

  const monthStart = shiftDateKey(todayKey(), -30);
  return instrumentRows
    .map((instrument): TitleListItem => {
      const closes = closesById.get(instrument.id) ?? [];
      const last = closes[closes.length - 1] ?? null;
      const previous = closes[closes.length - 2] ?? null;
      const monthBase = [...closes].reverse().find((c) => c.date <= monthStart) ?? null;
      return {
        instrument,
        held: heldIds.has(instrument.id),
        watching: watchedIds.has(instrument.id),
        lastClose: last?.close ?? null,
        lastDate: last?.date ?? null,
        dayChange: last && previous && previous.close > 0 ? last.close / previous.close - 1 : null,
        monthChange: last && monthBase && monthBase.close > 0 ? last.close / monthBase.close - 1 : null,
        spark: closes.map((c) => c.close),
        activeAlerts: alertCount(instrument.id, "attivo"),
        triggeredAlerts: alertCount(instrument.id, "scattato"),
      };
    })
    .sort((a, b) => Number(b.held) - Number(a.held) || a.instrument.name.localeCompare(b.instrument.name, "it"));
}
