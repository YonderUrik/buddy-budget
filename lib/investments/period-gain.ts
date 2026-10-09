import { addDays, toDateKey } from "@/lib/calc/net-worth";
import { parseDateOnly, startOfDay } from "@/lib/calc/expenses";
import { computeDailyPortfolioValues, periodStartKey } from "@/lib/calc/investments";
import { computeDailyReturns, toDailyFlows, type computePortfolioReturns } from "@/lib/calc/returns";

type PeriodInputs = Parameters<typeof computePortfolioReturns>[0];

/**
 * Guadagno del portafoglio in un periodo: variazione di valore al netto di ciò che hai versato e prelevato nel periodo,
 * proventi (dividendi e cedole) inclusi. Vale `endValue − startValue − netContributions + income`.
 */
export interface PeriodGain {
  /** Primo e ultimo giorno del periodo. */
  fromKey: string;
  toKey: string;
  /** Valore alla chiusura del giorno prima del periodo (0 se non c'era ancora niente). */
  startValue: number;
  endValue: number;
  /** Acquisti meno vendite e rimborsi nel periodo: i soldi che hai messo (o ritirato) tu, non il mercato. */
  netContributions: number;
  income: number;
  gain: number;
  /** Rendimento del periodo a parità di versamenti (TWR), null se nel periodo non c'era niente investito. */
  twr: number | null;
}

/**
 * Calcola il guadagno nel periodo scelto: o uno dei periodi preimpostati, o un intervallo esplicito (`range`, per
 * «Da inizio anno» e personalizzato). Il guadagno di ogni giorno è la variazione di valore tolti i movimenti di quel giorno.
 */
export function computePeriodGain(params: PeriodInputs & { range?: { from: string; to: string } }): PeriodGain | null {
  const { transactions, period, today, range } = params;
  const fromKey = range?.from ?? periodStartKey(transactions, period, today);
  if (fromKey === null) return null;
  const todayKey = toDateKey(startOfDay(today));
  const toKey = range && range.to < todayKey ? range.to : todayKey;
  if (fromKey > toKey) return null;
  const baseKey = toDateKey(addDays(parseDateOnly(fromKey), -1));
  const points = computeDailyPortfolioValues({ ...params, fromKey: baseKey, toKey });
  const base = points[0];
  const flows = toDailyFlows(points);
  const daily = computeDailyReturns(base.value, flows);
  let gain = 0;
  let index = 1;
  let invested = false;
  for (const day of daily) {
    gain += day.gain;
    if (day.ret !== null) { index *= 1 + day.ret; invested = true; }
  }
  const last = points.at(-1) ?? base;
  return {
    fromKey,
    toKey,
    startValue: base.value,
    endValue: last.value,
    netContributions: flows.reduce((total, f) => total + f.inflow - f.outflow, 0),
    income: last.income - base.income,
    gain,
    twr: invested ? index - 1 : null,
  };
}
