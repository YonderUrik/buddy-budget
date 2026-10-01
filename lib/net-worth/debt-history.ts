import { addDays, toDateKey } from "@/lib/calc/net-worth";
import { parseDateOnly } from "@/lib/calc/expenses";
import type { DebtsViewData } from "@/lib/debts/view";

/** Riga della classe "debiti" nel formato delle righe snapshot dell'API (importo negativo). */
export interface DebtHistoryRow {
  date: string;
  amount: string;
  source: "derivato";
  assetClass: "debiti";
}

interface StepPoint {
  date: string;
  value: number;
}

/** Valore di una serie a gradini alla data: l'ultimo punto con data ≤ `date` (0 prima del primo punto). */
function stepValueOn(points: StepPoint[], date: string): number {
  let value = 0;
  for (const point of points) {
    if (point.date > date) break;
    value = point.value;
  }
  return value;
}

/**
 * Storico giornaliero del debito complessivo (residuo dei finanziamenti + utilizzato delle linee di credito) come
 * righe della classe "debiti" con importo negativo, dal primo debito a ieri (oggi lo fornisce il valore corrente).
 * Non si salva nulla: i piani sono calcolati da condizioni ed eventi, quindi lo storico segue ogni modifica.
 */
export function buildDebtHistoryRows(view: DebtsViewData, todayKey: string, fromKey?: string): DebtHistoryRow[] {
  const series: StepPoint[][] = [
    ...view.debts.map((d) =>
      [...d.plan.residualSeries].sort((a, b) => a.date.localeCompare(b.date)).map((p) => ({ date: p.date, value: p.residual }))
    ),
    ...view.creditLines.map((l) => l.plan.balanceSeries.map((p) => ({ date: p.date, value: p.balance }))),
  ].filter((s) => s.length > 0);
  if (series.length === 0) return [];

  const first = series.map((s) => s[0].date).sort()[0];
  const start = fromKey && fromKey > first ? fromKey : first;
  const rows: DebtHistoryRow[] = [];
  for (let cursor = parseDateOnly(start); toDateKey(cursor) < todayKey; cursor = addDays(cursor, 1)) {
    const key = toDateKey(cursor);
    const total = series.reduce((sum, s) => sum + stepValueOn(s, key), 0);
    rows.push({ date: key, amount: (-total).toFixed(2), source: "derivato", assetClass: "debiti" });
  }
  return rows;
}
