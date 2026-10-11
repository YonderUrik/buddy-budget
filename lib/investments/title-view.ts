import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { computePositions, priceMultiplier } from "@/lib/calc/investments";
import { db } from "@/lib/db/client";
import {
  instrumentProfiles,
  instruments as instrumentsTable,
  instrumentPrices,
  userInstrumentPrices,
  userPriceAlerts,
  userWatchlistItems,
  type Instrument,
  type ProfileHolding,
  type UserPriceAlert,
} from "@/lib/db/schema/investments";
import { loadDividends } from "@/lib/market-data/dividends";
import { redisBackfillStore } from "@/lib/market-data/redis-stores";
import { ensureDividendsSafely, ensureHistory, ensureProfilesSafely, fundamentalsOnProviders, statementsOnProviders } from "@/lib/market-data/runtime";
import type { TitleFundamentals } from "@/lib/market-data/fundamentals";
import { loadUserTransactions } from "./data";
import { commentatorFromEnv } from "./commentary";
import { shiftDateKey, toCalcInput, todayKey } from "./operations";
import { findCompanyElsewhere, sharedFundHoldings, type HeldInstrumentRef, type HoldingElsewhere } from "./overlap";
import {
  computeAnnualReturns,
  computeDividendFacts,
  computeStockFundamentals,
  type AnnualReturn,
  type DividendFacts,
  type StockFundamentals,
} from "./title-fundamentals";
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
  /** Differenza tra valore e costo al prezzo medio, nella valuta del titolo (senza cambi, commissioni e tasse). */
  gain: number | null;
  /** Dividendi e cedole lordi registrati sul titolo, nella valuta del titolo. */
  incomeReceived: number;
  /** Acquisti registrati (data e prezzo), per segnarli sul grafico. */
  purchases: { date: string; price: number }[];
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
  /** Indicatori calcolati dai bilanci (solo azioni con bilanci disponibili). */
  stock: StockFundamentals | null;
  dividends: DividendFacts | null;
  /** Rendimenti di prezzo anno per anno (dalle chiusure salvate). */
  annualReturns: AnnualReturn[];
  /** Composizione di un ETF o fondo: primi titoli (con quelli che possiedi anche altrove) e settori. */
  composition: {
    holdings: ProfileHolding[];
    sectors: Record<string, number> | null;
    shared: { holding: ProfileHolding; elsewhere: HoldingElsewhere[] }[];
  } | null;
  /** Per un'azione: i fondi posseduti che la contengono tra i primi titoli. */
  insideFunds: HoldingElsewhere[];
}

/** Anni di storico chiesti per la forbice dei multipli e i rendimenti anno per anno. */
const FUNDAMENTALS_HISTORY_YEARS = 5;
const FUND_TYPES: readonly Instrument["type"][] = ["etf", "fondo"];

/** Strumenti posseduti oggi dall'utente diversi da `excludeId`, con simbolo e primi titoli dal profilo. */
async function loadOtherHoldings(heldIds: string[]): Promise<HeldInstrumentRef[]> {
  if (heldIds.length === 0) return [];
  const rows = await db
    .select({
      id: instrumentsTable.id,
      name: instrumentsTable.name,
      type: instrumentsTable.type,
      symbol: instrumentProfiles.symbol,
      holdings: instrumentProfiles.holdings,
    })
    .from(instrumentsTable)
    .leftJoin(instrumentProfiles, eq(instrumentProfiles.instrumentId, instrumentsTable.id))
    .where(inArray(instrumentsTable.id, heldIds));
  return rows.map((r) => ({ ...r, symbol: r.symbol ?? null, holdings: r.holdings ?? null }));
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
  // Le statistiche a 1 anno servono comunque; per azioni ed ETF anche 5 anni (forbice dei multipli, anni).
  const minimumFrom = ["azione", "etf", "fondo"].includes(instrument.type)
    ? shiftDateKey(today, -366 * FUNDAMENTALS_HISTORY_YEARS - 15)
    : shiftDateKey(today, -370);
  const needFrom = chartStart < minimumFrom ? chartStart : minimumFrom;
  let backfilling = false;
  try {
    await ensureHistory(instrument, needFrom, schedule);
    const [state] = await redisBackfillStore.views([instrument.id]);
    backfilling = state?.status === "running" && !state.interrupted;
  } catch {
    // Lo storico si recupera comunque col cron serale: la pagina mostra ciò che c'è.
  }
  if (instrument.priceMode === "auto") {
    await Promise.all([ensureProfilesSafely([instrument], schedule), ensureDividendsSafely([instrument], schedule)]);
  }

  const [closes, allTransactions, watch, alerts, fundamentalsResult, statements, dividendRows, profileRows] = await Promise.all([
    loadTitleCloses(userId, instrument),
    loadUserTransactions(userId),
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
    statementsOnProviders(instrument),
    loadDividends([instrument.id]),
    db.select().from(instrumentProfiles).where(eq(instrumentProfiles.instrumentId, instrument.id)),
  ]);
  const transactions = allTransactions.filter((t) => t.instrumentId === instrument.id);
  const fundamentals = fundamentalsResult.status === "ok" ? fundamentalsResult.fundamentals : null;

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
      const value = calc.quantity * stats.lastClose * multiplier;
      position = {
        quantity: calc.quantity,
        averagePrice: calc.averagePrice,
        value,
        changeVsAverage: calc.averagePrice && calc.averagePrice > 0 ? stats.lastClose / calc.averagePrice - 1 : null,
        gain: calc.averagePrice !== null ? value - calc.quantity * calc.averagePrice * multiplier : null,
        incomeReceived: transactions
          .filter((t) => t.type === "dividendo" || t.type === "cedola")
          .reduce((sum, t) => sum + Number(t.grossAmount ?? 0), 0),
        purchases: transactions.filter((t) => t.type === "acquisto").map((t) => ({ date: t.date, price: Number(t.price) })),
      };
    }
  }

  // Strumenti posseduti oltre a questo: servono per dire dove ritrovi gli stessi titoli.
  const heldIds = [
    ...computePositions(
      allTransactions.filter((t) => t.instrumentId !== instrument.id).map(toCalcInput),
      [],
      today
    ).entries(),
  ]
    .filter(([, p]) => p.quantity > 0)
    .map(([id]) => id);
  const others = await loadOtherHoldings(heldIds).catch(() => []);
  const profile = profileRows[0] ?? null;
  const isFund = FUND_TYPES.includes(instrument.type);
  const holdings = profile?.holdings ?? [];

  return {
    instrument,
    series,
    stats,
    historyDays: closes.length,
    backfilling,
    position,
    watching: watch.length > 0,
    alerts,
    fundamentals,
    fundamentalsStatus: fundamentalsResult.status,
    commentaryAvailable: commentatorFromEnv() !== null,
    stock: statements ? computeStockFundamentals(statements, closes, instrument.currency) : null,
    dividends: computeDividendFacts({
      dividends: dividendRows.map((d) => ({ exDate: d.exDate, amount: Number(d.amount) })),
      lastClose: stats?.lastClose ?? null,
      averagePrice: position?.averagePrice ?? null,
      announcedExDate: fundamentals?.exDividendDate ?? null,
      today,
    }),
    annualReturns: computeAnnualReturns(closes),
    composition:
      isFund && (holdings.length > 0 || profile?.sectors)
        ? { holdings, sectors: profile?.sectors ?? null, shared: sharedFundHoldings(holdings, others) }
        : null,
    insideFunds:
      instrument.type === "azione" ? findCompanyElsewhere({ symbol: profile?.symbol ?? null, name: instrument.name }, others).filter((o) => o.weight !== null) : [],
  };
}
