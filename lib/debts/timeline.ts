/** Linea del tempo dei debiti: una barra per finanziamento aperto, da quando comincia a pesare fino all'ultima rata. */

import { addMonthsClamped, type IsoDate } from "@/lib/calc/amortization";
import type { DebtView } from "./view";

/** Larghezza minima di una barra (in % della linea), perché un debito quasi finito resti visibile. */
export const MIN_BAR_WIDTH_PCT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DebtTimelineBar {
  debtId: string;
  name: string;
  /** Inizio della barra, % della linea. */
  startPct: number;
  widthPct: number;
  endDate: IsoDate;
  /** Rata mensile che si libera quando il debito finisce. */
  installment: number;
}

export interface DebtTimeline {
  start: IsoDate;
  end: IsoDate;
  bars: DebtTimelineBar[];
  /** Segni sull'asse (un anno ciascuno, o ogni 6 mesi sotto i 2 anni). */
  ticks: { date: IsoDate; pct: number }[];
}

function days(from: IsoDate, to: IsoDate): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
}

/** Costruisce la linea del tempo da oggi alla fine del debito più lungo; vuota senza debiti aperti. */
export function buildDebtTimeline(debts: DebtView[], today: IsoDate): DebtTimeline | null {
  const open = debts.filter((d) => !d.plan.totals.finished);
  if (open.length === 0) return null;
  const end = open.map((d) => d.plan.totals.endDate).sort().at(-1) as IsoDate;
  const span = Math.max(1, days(today, end));
  const bars = open
    .map((debt) => {
      const barStart = debt.firstInstallmentDate > today ? debt.firstInstallmentDate : today;
      const startPct = (days(today, barStart) / span) * 100;
      const widthPct = Math.max(MIN_BAR_WIDTH_PCT, (days(barStart, debt.plan.totals.endDate) / span) * 100);
      return {
        debtId: debt.id,
        name: debt.name,
        startPct: Math.min(startPct, 100 - MIN_BAR_WIDTH_PCT),
        widthPct: Math.min(widthPct, 100),
        endDate: debt.plan.totals.endDate,
        installment: debt.plan.totals.currentInstallment,
      };
    })
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
  const stepMonths = span > 2 * 365 ? 12 : 6;
  const ticks: DebtTimeline["ticks"] = [];
  for (let m = stepMonths; ; m += stepMonths) {
    const date = addMonthsClamped(today, m);
    if (date >= end) break;
    ticks.push({ date, pct: (days(today, date) / span) * 100 });
  }
  return { start: today, end, bars, ticks };
}
