import type { InvestmentPlan, InvestmentTransactionType, PriceUnit } from "@/lib/db/schema/investments";

/** Campi visibili nel form a seconda del tipo di operazione. */
export interface OperationFieldVisibility {
  quantity: boolean;
  price: boolean;
  grossAmount: boolean;
}

/** Acquisti, vendite e rimborsi muovono quote; dividendi e cedole sono importi. */
export function fieldsFor(type: InvestmentTransactionType): OperationFieldVisibility {
  const income = type === "dividendo" || type === "cedola";
  return { quantity: !income, price: !income, grossAmount: income };
}

/** Etichetta della quantità: per le obbligazioni si registra il valore nominale. */
export function quantityLabel(unit: PriceUnit | undefined): string {
  return unit === "percentuale_nominale" ? "Valore nominale" : "Quote";
}

/** Etichetta del prezzo: per le obbligazioni il prezzo è in percentuale del nominale. */
export function priceLabel(unit: PriceUnit | undefined): string {
  return unit === "percentuale_nominale" ? "Prezzo (% del nominale)" : "Prezzo per quota";
}

/** Controvalore nella valuta dello strumento (quote × prezzo, o l'importo lordo per i proventi); null se incompleto. */
export function computeGrossValue(
  type: InvestmentTransactionType,
  quantity: number | null,
  price: number | null,
  grossAmount: number | null,
  unit: PriceUnit | undefined
): number | null {
  if (!fieldsFor(type).quantity) return grossAmount;
  if (quantity === null || price === null) return null;
  return quantity * price * (unit === "percentuale_nominale" ? 0.01 : 1);
}

/** Valori iniziali del form per registrare l'esecuzione di un PAC: quote stimate dall'ultimo prezzo, se noto. */
export function prefillFromPlan(
  plan: Pick<InvestmentPlan, "instrumentId" | "amount">,
  lastPrice: number | null
): { instrumentId: string; type: InvestmentTransactionType; price: number | null; quantity: number | null } {
  const amount = Number(plan.amount);
  const quantity = lastPrice && lastPrice > 0 ? Math.floor((amount / lastPrice) * 10_000) / 10_000 : null;
  return { instrumentId: plan.instrumentId, type: "acquisto", price: lastPrice, quantity };
}

/** Data di oggi YYYY-MM-DD in ora locale (per il campo data). */
export function localTodayKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
