/**
 * Euro price of Pro from cents in the given locale. Our price, not the user's money: it is never masked by "hide
 * amounts", and it is in euro whatever the account currency.
 */
export function formatProPrice(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}
