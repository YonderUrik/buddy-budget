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
