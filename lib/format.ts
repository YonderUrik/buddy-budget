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

/** Formatta un valore numerico come valuta, secondo la valuta e il locale dell'utente. */
export function formatCurrency(
  value: number,
  currency: string,
  options: { locale?: string; maximumFractionDigits?: number } = {}
): string {
  const { locale = "it-IT", maximumFractionDigits = 2 } = options;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(value);
}
