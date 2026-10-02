import { addDays, toDateKey } from "@/lib/calc/net-worth";
import { parseDateOnly } from "@/lib/calc/expenses";
import type { PensionFundData } from "@/lib/pension/types";

/** Riga della classe "previdenza" nel formato delle righe snapshot dell'API. */
export interface PensionHistoryRow {
  date: string;
  amount: string;
  source: "derivato";
  assetClass: "previdenza";
}

/** Valore di un fondo alla data: l'ultima fotografia con data ≤ `date` (0 prima della prima). */
function fundValueOn(fund: PensionFundData, date: string): number {
  let value = 0;
  for (const snapshot of fund.snapshots) {
    if (snapshot.date > date) break;
    value = snapshot.value;
  }
  return value;
}

/** Valore complessivo della previdenza oggi: ultima fotografia di ogni fondo. */
export function pensionTotalOn(funds: PensionFundData[], date: string): number {
  return funds.reduce((sum, fund) => sum + fundValueOn(fund, date), 0);
}

/**
 * Storico giornaliero del valore della previdenza (ultima fotografia nota di ogni fondo) dalla prima fotografia a
 * ieri: l'ultimo giorno lo fornisce il valore corrente. Non si salva nulla, così lo storico segue ogni modifica.
 */
export function buildPensionHistoryRows(funds: PensionFundData[], todayKey: string, fromKey?: string): PensionHistoryRow[] {
  const firsts = funds.map((f) => f.snapshots[0]?.date).filter((d): d is string => d !== undefined);
  if (firsts.length === 0) return [];
  const first = [...firsts].sort()[0];
  const start = fromKey && fromKey > first ? fromKey : first;
  const rows: PensionHistoryRow[] = [];
  for (let cursor = parseDateOnly(start); toDateKey(cursor) < todayKey; cursor = addDays(cursor, 1)) {
    const key = toDateKey(cursor);
    rows.push({ date: key, amount: pensionTotalOn(funds, key).toFixed(2), source: "derivato", assetClass: "previdenza" });
  }
  return rows;
}
