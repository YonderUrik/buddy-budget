import { formatCurrency } from "@/lib/format";

/** Segnaposto al posto degli importi quando l'utente nasconde i valori. */
export const HIDDEN_PLACEHOLDER = "••••";
/** Posizioni mostrate nella sezione Portafoglio prima del rimando all'elenco completo. */
export const MAX_HOLDINGS_SHOWN = 3;
/** Titoli mostrati nella Watchlist prima del rimando all'elenco completo. */
export const MAX_WATCHLIST_SHOWN = 4;

/** Importo intero in valuta ("12.480 €"), o il segnaposto se i valori sono nascosti. */
export function formatSidebarAmount(value: number, currency: string, hidden: boolean): string {
  return hidden ? HIDDEN_PLACEHOLDER : formatCurrency(value, currency, { maximumFractionDigits: 0 });
}

/** Prezzo di un titolo con due decimali ("118,40 $"), o il segnaposto. */
export function formatSidebarPrice(value: number, currency: string, hidden: boolean): string {
  return hidden ? HIDDEN_PLACEHOLDER : formatCurrency(value, currency, { maximumFractionDigits: 2 });
}

/** Importo con segno esplicito ("+320 €", "−45 €"), o il segnaposto. */
export function formatSidebarSignedAmount(value: number, currency: string, hidden: boolean): string {
  if (hidden) return HIDDEN_PLACEHOLDER;
  return `${value < 0 ? "−" : "+"}${formatCurrency(Math.abs(value), currency, { maximumFractionDigits: 0 })}`;
}

/** Classe colore per una variazione: verde sopra zero, rosso sotto, neutro se nulla o assente. */
export function changeToneClass(value: number | null): string {
  if (value === null || Math.abs(value) < 0.00005) return "text-sidebar-foreground/60";
  return value < 0 ? "text-neg" : "text-pos";
}

const MONTH_ABBR = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

/** Giorno e mese abbreviato di una data `YYYY-MM-DD` ("2026-10-12" → { day: "12", month: "ott" }). */
export function formatDeadlineDay(date: string): { day: string; month: string } {
  const [, month, day] = date.split("-").map(Number);
  return { day: String(day), month: MONTH_ABBR[month - 1] ?? "" };
}

/** Percentuale intera di avanzamento ("38%"); sopra il 100% resta "100%" perché la barra è piena. */
export function formatFireProgress(progress: number): string {
  return `${Math.round(Math.min(Math.max(progress, 0), 1) * 100)}%`;
}

/** Larghezza (0-100) del riempimento della barra FIRE. */
export function fireBarWidth(progress: number): number {
  return Math.min(Math.max(progress, 0), 1) * 100;
}

/** Anni al traguardo in parole brevi: "tra 12 anni", "tra meno di un anno", "raggiunto". */
export function formatYearsToFire(years: number | null): string | null {
  if (years === null) return null;
  if (years <= 0) return "raggiunto";
  if (years < 1) return "tra meno di un anno";
  const rounded = Math.round(years);
  return rounded === 1 ? "tra 1 anno" : `tra ${rounded} anni`;
}
