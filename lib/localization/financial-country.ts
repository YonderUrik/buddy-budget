import type { ProductCountry } from "./config";

/** Product capabilities are independent of display language. Add countries here as each model is validated. */
const disabled = { taxes: false, pension: false, retirement: false, incomeForecasts: false, inflation: false };
export const FINANCIAL_COUNTRIES = {
  IT: { name: "Italia", features: { taxes: true, pension: true, retirement: true, incomeForecasts: true, inflation: true }, inflation: { area: "IT", currency: "EUR" }, investmentCosts: { annualStampDutyRate: 0.002 } },
  DE: { name: "Germania", features: { ...disabled, inflation: true }, inflation: { area: "DE", currency: "EUR" }, investmentCosts: { annualStampDutyRate: 0 } },
  // No local rules yet: no taxes, pension or national inflation (the area never matches a currency). Retirement
  // planning (Analitiche, FIRE, goals) runs on the user's own figures, without capital gains tax.
  OTHER: { name: "Altro paese", features: { ...disabled, retirement: true }, inflation: { area: "", currency: "" }, investmentCosts: { annualStampDutyRate: 0 } },
} satisfies Record<ProductCountry, { name: string; features: typeof disabled; inflation: { area: string; currency: string }; investmentCosts: { annualStampDutyRate: number } }>;

export function financialCountry(country: string) {
  return Object.hasOwn(FINANCIAL_COUNTRIES, country) ? FINANCIAL_COUNTRIES[country as ProductCountry] : null;
}
export function inflationAreaForCountry(country: string, currency: string): string | null {
  const config = financialCountry(country);
  return config?.features.inflation && config.inflation.currency === currency ? config.inflation.area : null;
}
export const INFLATION_AREAS = [...new Set(Object.values(FINANCIAL_COUNTRIES).filter(c => c.features.inflation).map(c => c.inflation.area))];
export const DISABLED_FINANCIAL_FEATURES = disabled;
