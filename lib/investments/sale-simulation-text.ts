/** Copy of the «Prima di vendere» result (Italian source strings), shared by the web card and the simulate-sale API. */
import type { SaleSimulation, TaxCategory } from "@/lib/calc/taxes";
import type { TaxRegime } from "@/lib/db/schema/investments";

/** What the gain is for tax purposes, by category. */
export const SALE_CATEGORY_TEXT: Record<TaxCategory, string> = {
  diversi: "Reddito diverso: compensabile con lo zaino.",
  capitale: "Guadagno di un ETF o fondo: reddito di capitale, tassato per intero anche se hai minusvalenze.",
  crypto: "Crypto: si dichiara a parte e si compensa solo con altre crypto.",
};

/** Added to the category text for a non-harmonised ETF. */
export const SALE_NON_HARMONIZED_TEXT = " ETF non armonizzato: in realtà a IRPEF, qui stimato al 26%.";

/** Label of the tax line: less tax this year, withheld (amministrato) or more in the tax return (dichiarativo). */
export function saleTaxLineLabel(result: Pick<SaleSimulation, "taxDelta">, regime: TaxRegime): string {
  if (result.taxDelta < 0) return "Imposte in meno quest'anno";
  return regime === "amministrato" ? "Imposte trattenute" : "Imposte in più in dichiarazione";
}
