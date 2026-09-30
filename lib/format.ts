/**
 * Estrae il simbolo di valuta per un codice ISO 4217.
 * Formatta 0 con Intl e rimuove cifre, spazi (inclusi non-breaking   e  ) e separatori.
 */
export function getCurrencySymbol(currency: string, locale = "it-IT"): string {
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(0);
  return formatted.replace(/[\d\s  .,]/g, "").trim();
}

/** Maschera mostrata al posto degli importi quando l'utente ha scelto di nasconderli. */
export const AMOUNT_MASK = "••••";

let amountsMasked = false;

/**
 * Attiva o disattiva la maschera globale sugli importi (usata da `formatCurrency`). Chiamata dal provider della
 * privacy solo nel browser: sul server il valore sarebbe condiviso tra richieste di utenti diversi.
 */
export function setAmountsMasked(masked: boolean): void {
  amountsMasked = masked;
}

/** Formatta un valore numerico come valuta, secondo la valuta e il locale dell'utente. Con gli importi nascosti restituisce `AMOUNT_MASK`. */
export function formatCurrency(
  value: number,
  currency: string,
  options: { locale?: string; maximumFractionDigits?: number } = {}
): string {
  if (amountsMasked) return AMOUNT_MASK;
  const { locale = "it-IT", maximumFractionDigits = 2 } = options;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(value);
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const RELATIVE_TIME_MAX_DAYS = 7;

/**
 * Formatta la distanza temporale tra `date` e `now` in italiano, con granularità
 * decrescente (minuti/ore/giorni); oltre RELATIVE_TIME_MAX_DAYS giorni torna a
 * una data assoluta breve (es. "12 lug").
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < MINUTE_MS) return "adesso";
  if (diffMs < HOUR_MS) return `${Math.floor(diffMs / MINUTE_MS)} min fa`;
  if (diffMs < DAY_MS) return `${Math.floor(diffMs / HOUR_MS)} h fa`;
  if (diffMs < RELATIVE_TIME_MAX_DAYS * DAY_MS) return `${Math.floor(diffMs / DAY_MS)} giorni fa`;
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(date);
}

/**
 * Formatta una data calendario "YYYY-MM-DD" (es. `transactions.date`) in forma breve, "26 set".
 * Costruisce la data in ora locale: `new Date("YYYY-MM-DD")` la interpreterebbe in UTC e,
 * a ovest di Greenwich, mostrerebbe il giorno prima.
 */
export function formatShortDate(isoDate: string, locale = "it-IT"): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(year, month - 1, day));
}

/** Data con giorno, mese abbreviato e anno ("12 set 2026") da una stringa `YYYY-MM-DD`. */
export function formatDateWithYear(isoDate: string, locale = "it-IT"): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(year, month - 1, day)
  );
}

/** Data estesa ("29 ottobre 2026") da un istante, per scadenze e date importanti. */
export function formatLongDate(date: Date, locale = "it-IT"): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(date);
}
