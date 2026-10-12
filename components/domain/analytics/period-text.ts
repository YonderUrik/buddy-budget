/** Testi sul periodo dei dati di Analitiche: etichette brevi e frasi «negli ultimi 12 mesi» / «da gen 2024 a dic 2025». */

import { parseDateOnly } from "@/lib/calc/expenses";
import type { DataPeriod } from "@/lib/analitiche/period";

const MONTH = new Intl.DateTimeFormat("it-IT", { month: "short", year: "numeric" });

/** «ott 2025» da una data AAAA-MM-GG o AAAA-MM. */
export function monthText(key: string): string {
  return MONTH.format(parseDateOnly(key.length === 7 ? `${key}-01` : key)).replace(".", "");
}

/** «ott 2025 – set 2026». */
export function rangeText(fromKey: string, toKey: string): string {
  return `${monthText(fromKey)} – ${monthText(toKey)}`;
}

/** Frase per il periodo: «negli ultimi 12 mesi» o «da gen 2024 a dic 2025». */
export function periodPhrase(period: DataPeriod, fromKey: string, toKey: string): string {
  return period.kind === "ultimi" ? `negli ultimi ${period.months} mesi` : `da ${monthText(fromKey)} a ${monthText(toKey)}`;
}
