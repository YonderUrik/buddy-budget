import type { Locale } from "./i18n";

/**
 * Numero intero con il punto come separatore delle migliaia, sempre (anche sotto 10.000).
 * Fatto a mano e non con `toLocaleString`: Node e il browser raggruppano diversamente le cifre a 4 cifre e
 * la differenza rompe l'idratazione del testo renderizzato su server.
 */
export function groupThousands(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Importo in euro, arrotondato all'unità, con separatore italiano delle migliaia. */
export function eur(n: number): string {
  return `${groupThousands(n)} €`;
}

/** Integer grouped by thousands in the page language: «22.595» in Italian, "22,595" in English. Hand-made for the same hydration reason. */
export function groupThousandsIn(n: number, locale: Locale): string {
  const it = groupThousands(n);
  return locale === "en" ? it.replace(/\./g, ",") : it;
}

/** Rounded euro amount with a real minus sign: «−39.937 €» in Italian, "−€39,937" in English. */
export function money(n: number, locale: Locale): string {
  const sign = n < 0 ? "−" : "";
  const digits = groupThousandsIn(Math.abs(n), locale);
  return locale === "en" ? `${sign}€${digits}` : `${sign}${digits} €`;
}

const MONTHS: Record<Locale, readonly string[]> = {
  it: ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

/** ISO date (YYYY-MM-DD) in words: «3 ottobre 2026», "October 3, 2026"; `short` drops the year. Hand-made for the same hydration reason. */
export function longDate(iso: string, locale: Locale, short = false): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = MONTHS[locale][m - 1];
  if (locale === "en") return short ? `${month} ${d}` : `${month} ${d}, ${y}`;
  return short ? `${d} ${month}` : `${d} ${month} ${y}`;
}
