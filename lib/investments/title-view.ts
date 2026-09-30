import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { computePositions, priceMultiplier } from "@/lib/calc/investments";
import { db } from "@/lib/db/client";
import {
  instrumentPrices,
  userInstrumentPrices,
  userPriceAlerts,
  userWatchlistItems,
  type Instrument,
  type UserPriceAlert,
} from "@/lib/db/schema/investments";
import { redisBackfillStore } from "@/lib/market-data/redis-stores";
import { ensureHistory, fundamentalsOnProviders } from "@/lib/market-data/runtime";
import type { TitleFundamentals } from "@/lib/market-data/fundamentals";
import { loadUserTransactions } from "./data";
import { commentatorFromEnv } from "./commentary";
import { shiftDateKey, toCalcInput, todayKey } from "./operations";
import {
  TITLE_CHART_MAX_POINTS,
  TITLE_MAX_HISTORY_YEARS,
  computeTitleStats,
  downsampleCloses,
  titleChartStartKey,
  type CloseInput,
  type TitleChartPeriod,
  type TitleStats,
} from "./title-stats";

/** Posizione dell'utente sul titolo, in valuta e unità di prezzo dello strumento (niente cambi: è una lettura veloce). */
export interface TitlePosition {
  quantity: number;
  /** Prezzo medio di carico, stessa unità dell'ultima chiusura. */
  averagePrice: number | null;
  /** Valore alla chiusura: quote × prezzo (× 1/100 per le obbligazioni). */
  value: number;
  /** Variazione dell'ultima chiusura rispetto al prezzo medio di carico (frazione). */
  changeVsAverage: number | null;
}

export interface TitleAnalysis {
  instrument: Instrument;
  series: CloseInput[];
  stats: TitleStats | null;
  /** Quanti giorni di storico ci sono (0 = ancora niente). */
  historyDays: number;
  /** True mentre lo storico si sta scaricando in background: la pagina riprova. */
  backfilling: boolean;
  position: TitlePosition | null;
  watching: boolean;
  alerts: UserPriceAlert[];
  fundamentals: TitleFundamentals | null;
  fundamentalsStatus: "ok" | "unsupported" | "unavailable";
  commentaryAvailable: boolean;
}

/** Chiusure ordinate: quelle delle fonti, con i prezzi manuali dell'utente che vincono nella stessa data. */
export async function loadTitleCloses(userId: string, instrument: Instrument): Promise<CloseInput[]> {
  const [auto, manual] = await Promise.all([
    instrument.priceMode === "auto"
      ? db
          .select({ date: instrumentPrices.date, close: instrumentPrices.close })
          .from(instrumentPrices)
          .where(eq(instrumentPrices.instrumentId, instrument.id))
          .orderBy(asc(instrumentPrices.date))
      : Promise.resolve([]),
    db
      .select({ date: userInstrumentPrices.date, close: userInstrumentPrices.close })
      .from(userInstrumentPrices)
      .where(and(eq(userInstrumentPrices.userId, userId), eq(userInstrumentPrices.instrumentId, instrument.id)))
      .orderBy(asc(userInstrumentPrices.date)),
  ]);
  const byDate = new Map<string, number>();
  for (const row of auto) byDate.set(row.date, Number(row.close));
  for (const row of manual) byDate.set(row.date, Number(row.close));
  return [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, close]) => ({ date, close }));
}

/**
 * Tutto ciò che serve alla pagina di un titolo: grafico e statistiche sulle chiusure, posizione dell'utente,
 * watchlist, avvisi, numeri chiave. Avvia in background il recupero dello storico se non arriva fin dove serve
 * al periodo scelto (`schedule` è `after()` di Next.js).
 */
export async function buildTitleAnalysis(
  userId: string,
  instrument: Instrument,
  period: TitleChartPeriod,
  schedule: (task: () => Promise<void>) => void
): Promise<TitleAnalysis> {
  const today = todayKey();
  const chartStart = titleChartStartKey(period, today) ?? shiftDateKey(today, -365 * TITLE_MAX_HISTORY_YEARS);
  // Le statistiche a 1 anno (e la volatilità) servono comunque: si chiede lo storico almeno fino a lì.
  const needFrom = chartStart < shiftDateKey(today, -370) ? chartStart : shiftDateKey(today, -370);
  let backfilling = false;
  try {
    await ensureHistory(instrument, needFrom, schedule);
    const [state] = await redisBackfillStore.views([instrument.id]);
    backfilling = state?.status === "running" && !state.interrupted;
  } catch {
    // Lo storico si recupera comunque col cron serale: la pagina mostra ciò che c'è.
  }

  const [closes, transactions, watch, alerts, fundamentalsResult] = await Promise.all([
    loadTitleCloses(userId, instrument),
    loadUserTransactions(userId, instrument.id),
    db
      .select({ id: userWatchlistItems.id })
      .from(userWatchlistItems)
      .where(and(eq(userWatchlistItems.userId, userId), eq(userWatchlistItems.instrumentId, instrument.id))),
    db
      .select()
      .from(userPriceAlerts)
      .where(and(eq(userPriceAlerts.userId, userId), eq(userPriceAlerts.instrumentId, instrument.id)))
      .orderBy(asc(userPriceAlerts.createdAt)),
    fundamentalsOnProviders(instrument),
  ]);

  const stats = computeTitleStats(closes, today);
  const chartCloses = closes.filter((c) => c.date >= chartStart || period === "Max");
  const series = downsampleCloses(chartCloses, TITLE_CHART_MAX_POINTS);

  let position: TitlePosition | null = null;
  if (transactions.length > 0 && stats) {
    const calc = computePositions(
      transactions.map(toCalcInput),
      [{ id: instrument.id, name: instrument.name, type: instrument.type, currency: instrument.currency, priceUnit: instrument.priceUnit }],
      today
    ).get(instrument.id);
    if (calc && calc.quantity > 0) {
      const multiplier = priceMultiplier(instrument.priceUnit);
      position = {
        quantity: calc.quantity,
        averagePrice: calc.averagePrice,
        value: calc.quantity * stats.lastClose * multiplier,
        changeVsAverage: calc.averagePrice && calc.averagePrice > 0 ? stats.lastClose / calc.averagePrice - 1 : null,
      };
    }
  }

  return {
    instrument,
    series,
    stats,
    historyDays: closes.length,
    backfilling,
    position,
    watching: watch.length > 0,
    alerts,
    fundamentals: fundamentalsResult.status === "ok" ? fundamentalsResult.fundamentals : null,
    fundamentalsStatus: fundamentalsResult.status,
    commentaryAvailable: commentatorFromEnv() !== null,
  };
}
