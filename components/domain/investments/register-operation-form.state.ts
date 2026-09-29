import type { ResolvedPrice } from "@/lib/calc/investments";
import type { InvestmentPlan, InvestmentTransactionType, PriceUnit } from "@/lib/db/schema/investments";
import { formatDateWithYear } from "@/lib/format";

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

/** Decimali massimi di un prezzo precompilato (le chiusure salvate ne hanno fino a 8). */
export const PREFILL_PRICE_DECIMALS = 6;

/** Numero nel formato del campo (virgola decimale), vuoto se assente. */
export function numberText(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value).replace(".", ",");
}

/** Prezzo precompilato nel formato del campo, senza la coda di decimali delle chiusure salvate. */
export function priceText(close: number): string {
  return numberText(Number(close.toFixed(PREFILL_PRICE_DECIMALS)));
}

/**
 * Il prezzo di mercato alla data si propone solo per acquisti e vendite: un rimborso avviene al valore di
 * rimborso (per un BTP 100), non alla quotazione di quel giorno.
 */
export function suggestsMarketPrice(type: InvestmentTransactionType): boolean {
  return type === "acquisto" || type === "vendita";
}

/** Stato della ricerca del prezzo alla data, come arriva dalla query. */
export interface PriceSuggestionState {
  price: ResolvedPrice | null;
  /** Lo storico dello strumento si sta ancora scaricando. */
  loading: boolean;
}

/** Frase sotto il campo prezzo: da dove viene il valore proposto, o perché manca. Null se non c'è niente da dire. */
export function priceSuggestionHint(dateKey: string, state: PriceSuggestionState | undefined, fetching: boolean): string | null {
  if (!state) return fetching ? "Cerco il prezzo di questa data…" : null;
  if (state.loading) return "Scarico i prezzi di questa data…";
  const { price } = state;
  if (!price) return "Nessun prezzo per questa data: inseriscilo tu.";
  const when = formatDateWithYear(price.date);
  if (price.origin === "manuale") return price.date === dateKey ? `Il tuo prezzo del ${when}` : `Il tuo ultimo prezzo prima di questa data, del ${when}`;
  return price.date === dateKey ? `Chiusura del ${when}` : `Ultima chiusura prima di questa data, del ${when}`;
}
