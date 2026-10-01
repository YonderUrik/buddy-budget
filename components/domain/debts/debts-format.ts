import type { DebtsOverview } from "@/lib/debts/view";

const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/** "febbraio 2027" da una data ISO. */
export function formatMonthYear(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

/** Frase di riepilogo della panoramica. */
export function summarySentence(overview: DebtsOverview, formatMonth: (isoDate: string) => string): string {
  if (overview.openCount === 0 || overview.debtFreeDate === null) return "Nessun debito aperto: hai finito di pagare.";
  const count = overview.openCount === 1 ? "il tuo debito" : `tutti e ${overview.openCount} i debiti`;
  return `Finisci di pagare ${count} a ${formatMonth(overview.debtFreeDate)}.`;
}
