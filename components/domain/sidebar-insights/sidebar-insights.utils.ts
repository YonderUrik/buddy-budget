import { localizedFormats } from "@/lib/localization/format";
import { translate, type MessageValues } from "@/lib/localization/messages";
import { LANGUAGE_LOCALES, type Language } from "@/lib/localization/config";

/** Bind presentation text and formatting to one language without shared mutable state. */
export function localizedSidebarFormats(language: Language) {
  const locale = LANGUAGE_LOCALES[language];
  const { formatCurrency } = localizedFormats(locale);
  const tr = (source: string, values?: MessageValues) => translate(language, source, values);
const HIDDEN_PLACEHOLDER = "••••";
/** Posizioni mostrate nella sezione Portafoglio prima del rimando all'elenco completo. */
const MAX_HOLDINGS_SHOWN = 3;
/** Titoli mostrati nella Watchlist prima del rimando all'elenco completo. */
const MAX_WATCHLIST_SHOWN = 4;

/** Importo intero in valuta ("12.480 €"), o il segnaposto se i valori sono nascosti. */
function formatSidebarAmount(value: number, currency: string, hidden: boolean): string {
  return hidden ? HIDDEN_PLACEHOLDER : formatCurrency(value, currency, { maximumFractionDigits: 0 });
}

/** Prezzo di un titolo con due decimali ("118,40 $"), o il segnaposto. */
function formatSidebarPrice(value: number, currency: string, hidden: boolean): string {
  return hidden ? HIDDEN_PLACEHOLDER : formatCurrency(value, currency, { maximumFractionDigits: 2 });
}

/** Importo con segno esplicito ("+320 €", "−45 €"), o il segnaposto. */
function formatSidebarSignedAmount(value: number, currency: string, hidden: boolean): string {
  if (hidden) return HIDDEN_PLACEHOLDER;
  return `${value < 0 ? "−" : "+"}${formatCurrency(Math.abs(value), currency, { maximumFractionDigits: 0 })}`;
}

/** Classe colore per una variazione: verde sopra zero, rosso sotto, neutro se nulla o assente. */
function changeToneClass(value: number | null): string {
  if (value === null || Math.abs(value) < 0.00005) return "text-sidebar-foreground/60";
  return value < 0 ? "text-neg" : "text-pos";
}



/** Giorno e mese abbreviato di una data `YYYY-MM-DD` ("2026-10-12" → { day: "12", month: "ott" }). */
function formatDeadlineDay(date: string): { day: string; month: string } {
  const [, month, day] = date.split("-").map(Number);
  return { day: String(day), month: new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2000, month - 1, 1)) };
}

/** Percentuale intera di avanzamento ("38%"); sopra il 100% resta "100%" perché la barra è piena. */
function formatFireProgress(progress: number): string {
  return `${Math.round(Math.min(Math.max(progress, 0), 1) * 100)}%`;
}

/** Larghezza (0-100) del riempimento della barra FIRE. */
function fireBarWidth(progress: number): number {
  return Math.min(Math.max(progress, 0), 1) * 100;
}

/** Anni al traguardo in parole brevi: "tra 12 anni", "tra meno di un anno", "raggiunto". */
function formatYearsToFire(years: number | null): string | null {
  if (years === null) return null;
  if (years <= 0) return tr("raggiunto");
  if (years < 1) return tr("tra meno di un anno");
  const rounded = Math.round(years);
  return rounded === 1 ? tr("tra 1 anno") : tr("tra {0} anni", { 0: rounded });
}
  return { HIDDEN_PLACEHOLDER, MAX_HOLDINGS_SHOWN, MAX_WATCHLIST_SHOWN, formatSidebarAmount, formatSidebarPrice, formatSidebarSignedAmount, changeToneClass, formatDeadlineDay, formatFireProgress, fireBarWidth, formatYearsToFire };
}

/** Italian defaults retained for existing callers and pure calculation tests. */
export const { HIDDEN_PLACEHOLDER, MAX_HOLDINGS_SHOWN, MAX_WATCHLIST_SHOWN, formatSidebarAmount, formatSidebarPrice, formatSidebarSignedAmount, changeToneClass, formatDeadlineDay, formatFireProgress, fireBarWidth, formatYearsToFire } = localizedSidebarFormats("it");
