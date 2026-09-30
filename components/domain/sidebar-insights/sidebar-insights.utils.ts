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
