/** Valute supportate come valuta principale dell'utente (scelta in onboarding). Unica fonte di verità per UI e API. */

export const SUPPORTED_CURRENCIES = [
  { value: "EUR", label: "Euro", symbol: "€" },
  { value: "USD", label: "Dollaro USA", symbol: "$" },
  { value: "GBP", label: "Sterlina britannica", symbol: "£" },
  { value: "CHF", label: "Franco svizzero", symbol: "CHF" },
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]["value"];

/** Valuta preselezionata in onboarding. */
export const DEFAULT_CURRENCY: SupportedCurrency = "EUR";

/** True se `value` è una delle valute supportate (confronto esatto, case-sensitive). */
export function isSupportedCurrency(value: unknown): value is SupportedCurrency {
  return typeof value === "string" && SUPPORTED_CURRENCIES.some((c) => c.value === value);
}
