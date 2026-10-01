import type { DebtsOverview } from "@/lib/debts/view";

const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/** "febbraio 2027" da una data ISO. */
export function formatMonthYear(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

/** Frase di riepilogo della panoramica: quando finiscono i finanziamenti e cosa resta sulle linee di credito. */
export function summarySentence(overview: DebtsOverview, formatMonth: (isoDate: string) => string): string {
  const linesOpen = overview.creditUsed > 0;
  if (overview.openCount === 0 || overview.debtFreeDate === null) {
    return linesOpen ? "Nessun finanziamento aperto: resta quanto hai utilizzato sulle linee di credito." : "Nessun debito aperto: hai finito di pagare.";
  }
  const count = overview.openCount === 1 ? "il tuo finanziamento" : `tutti e ${overview.openCount} i finanziamenti`;
  const loans = `Finisci di pagare ${count} a ${formatMonth(overview.debtFreeDate)}`;
  return linesOpen ? `${loans}; le linee di credito restano finché non rimborsi.` : `${loans}.`;
}
