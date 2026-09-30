/**
 * Statistiche di un singolo titolo calcolate sulle chiusure salvate (pagina strumento, Fase 6): variazioni sui
 * periodi, massimo e minimo a 52 settimane, volatilità e caduta massima a un anno. Tutto puro: riceve le chiusure
 * in ordine di data e la data di oggi, non conosce database né fonti.
 */

import { observationsPerYear, sampleStd } from "@/lib/calc/risk";

export interface CloseInput {
  date: string;
  close: number;
}

/** Periodi mostrati come variazione percentuale. */
export const TITLE_RETURN_PERIODS = ["1M", "3M", "6M", "1A", "YTD"] as const;
export type TitleReturnPeriod = (typeof TITLE_RETURN_PERIODS)[number];

/** Giorni indietro per periodo (YTD si calcola dall'inizio dell'anno). */
const PERIOD_DAYS: Record<Exclude<TitleReturnPeriod, "YTD">, number> = { "1M": 30, "3M": 91, "6M": 182, "1A": 365 };
/** Finestra di massimo/minimo, volatilità e caduta: un anno. */
const YEAR_DAYS = 365;
/** Osservazioni minime perché volatilità e caduta massima abbiano senso. */
export const MIN_TITLE_OBSERVATIONS = 20;
/** Quanto indietro può stare la chiusura di partenza rispetto alla data cercata (weekend, festivi, storico che parte dopo). */
const START_TOLERANCE_DAYS = 10;

export interface TitleStats {
  lastClose: number;
  lastDate: string;
  /** Variazione dalla chiusura precedente (frazione, 0,01 = 1%), o null se manca. */
  dayChange: number | null;
  returns: Partial<Record<TitleReturnPeriod, number>>;
  high52: number | null;
  low52: number | null;
  /** Distanza dal massimo a 52 settimane (frazione, ≤ 0). */
  fromHigh: number | null;
  /** Volatilità annua sull'ultimo anno, o null con dati insufficienti. */
  volatility: number | null;
  /** Caduta massima dal picco sull'ultimo anno (frazione, ≤ 0), o null. */
  maxDrawdown: number | null;
}

function shift(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Ultima chiusura in data o prima (richiede l'elenco ordinato per data crescente). */
export function closeOnOrBefore(closes: CloseInput[], dateKey: string): CloseInput | null {
  let lo = 0;
  let hi = closes.length - 1;
  let found: CloseInput | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (closes[mid].date <= dateKey) {
      found = closes[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** Variazione tra la chiusura in `startKey` (o la precedente entro la tolleranza) e l'ultima; null se lo storico non arriva fin lì. */
function changeSince(closes: CloseInput[], startKey: string): number | null {
  const start = closeOnOrBefore(closes, startKey);
  if (!start || start.close <= 0) return null;
  if (start.date < shift(startKey, -START_TOLERANCE_DAYS)) return null;
  return closes[closes.length - 1].close / start.close - 1;
}

/** Statistiche del titolo, o null senza nessuna chiusura. `closes` ordinate per data crescente. */
export function computeTitleStats(closes: CloseInput[], today: string): TitleStats | null {
  if (closes.length === 0) return null;
  const last = closes[closes.length - 1];
  const previous = closes.length > 1 ? closes[closes.length - 2] : null;
  const dayChange = previous && previous.close > 0 ? last.close / previous.close - 1 : null;

  const returns: Partial<Record<TitleReturnPeriod, number>> = {};
  for (const period of TITLE_RETURN_PERIODS) {
    const startKey = period === "YTD" ? `${today.slice(0, 4)}-01-01` : shift(last.date, -PERIOD_DAYS[period]);
    // YTD parte dall'ultima chiusura dell'anno prima: la data cercata è il 31 dicembre.
    const value = changeSince(closes, period === "YTD" ? shift(startKey, -1) : startKey);
    if (value !== null) returns[period] = value;
  }

  const yearStart = shift(last.date, -YEAR_DAYS);
  const year = closes.filter((c) => c.date >= yearStart);
  const high52 = year.length > 0 ? Math.max(...year.map((c) => c.close)) : null;
  const low52 = year.length > 0 ? Math.min(...year.map((c) => c.close)) : null;

  let volatility: number | null = null;
  let maxDrawdown: number | null = null;
  if (year.length > MIN_TITLE_OBSERVATIONS) {
    const rets: number[] = [];
    let peak = year[0].close;
    let worst = 0;
    for (let i = 1; i < year.length; i += 1) {
      if (year[i - 1].close > 0) rets.push(year[i].close / year[i - 1].close - 1);
      peak = Math.max(peak, year[i].close);
      worst = Math.min(worst, year[i].close / peak - 1);
    }
    const days = (Date.parse(`${year[year.length - 1].date}T00:00:00Z`) - Date.parse(`${year[0].date}T00:00:00Z`)) / 86_400_000;
    const perYear = observationsPerYear(rets.length, days);
    const std = sampleStd(rets);
    if (perYear !== null && std !== null) volatility = std * Math.sqrt(perYear);
    maxDrawdown = worst;
  }

  return {
    lastClose: last.close,
    lastDate: last.date,
    dayChange,
    returns,
    high52,
    low52,
    fromHigh: high52 !== null && high52 > 0 ? last.close / high52 - 1 : null,
    volatility,
    maxDrawdown,
  };
}

/** Riduce una serie a al più `maxPoints` punti equidistanti, tenendo sempre primo e ultimo. */
export function downsampleCloses<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints || maxPoints < 2) return points;
  const out: T[] = [];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i += 1) out.push(points[Math.round(i * step)]);
  return out;
}

/** Periodi del grafico del titolo e giorni indietro (null = tutto lo storico). */
export const TITLE_CHART_PERIODS = ["1M", "3M", "6M", "1A", "5A", "Max"] as const;
export type TitleChartPeriod = (typeof TITLE_CHART_PERIODS)[number];
export const TITLE_CHART_PERIOD_DAYS: Record<TitleChartPeriod, number | null> = {
  "1M": 30,
  "3M": 91,
  "6M": 182,
  "1A": 365,
  "5A": 1826,
  Max: null,
};
export const TITLE_DEFAULT_CHART_PERIOD: TitleChartPeriod = "1A";
/** Anni di storico chiesti alle fonti quando si apre la pagina di un titolo con "Max". */
export const TITLE_MAX_HISTORY_YEARS = 5;
/** Punti al massimo nel grafico: oltre, la serie si riduce (basta a colpo d'occhio, alleggerisce la risposta). */
export const TITLE_CHART_MAX_POINTS = 240;

/** Data di partenza del grafico per un periodo, o null per tutto lo storico. */
export function titleChartStartKey(period: TitleChartPeriod, todayKey: string): string | null {
  const days = TITLE_CHART_PERIOD_DAYS[period];
  return days === null ? null : shift(todayKey, -days);
}
