import { parseDateOnly, startOfDay } from "./expenses";
import { periodStartKey, type InvestmentTransactionInput } from "./investments";
import { addDays, toDateKey, type NetWorthPeriod } from "./net-worth";

export interface PerformanceRange { from: string; to: string }

/** Unica finestra per rendimenti e rischio; include il valore di apertura del giorno precedente. */
export function resolvePerformanceRange(
  transactions: Pick<InvestmentTransactionInput, "date" | "type">[],
  period: NetWorthPeriod,
  today: Date,
  range?: PerformanceRange,
) {
  const first = periodStartKey(transactions, "max", today);
  const start = range?.from ?? periodStartKey(transactions, period, today);
  if (!first || !start) return null;
  const fromKey = start < first ? first : start;
  const todayKey = toDateKey(startOfDay(today));
  const toKey = range?.to && range.to < todayKey ? range.to : todayKey;
  if (fromKey > toKey) return null;
  return { fromKey, baseKey: toDateKey(addDays(parseDateOnly(fromKey), -1)), toKey };
}
