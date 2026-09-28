import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import type { Instrument, InvestmentTransaction, InvestmentTransactionType } from "@/lib/db/schema/investments";
import { buildFxTable, fxRateBetween } from "@/lib/calc/fx";
import { findOversoldTransaction, type InvestmentTransactionInput } from "@/lib/calc/investments";
import { loadRatesUpTo } from "./data";

/** Tipi che non muovono quote: quantità e prezzo si salvano a zero. */
const INCOME_TYPES: ReadonlySet<InvestmentTransactionType> = new Set(["dividendo", "cedola"]);

/** Campi di un'operazione come arrivano validati dall'API. */
export interface OperationFields {
  type: InvestmentTransactionType;
  date: string;
  quantity: number;
  price: number;
  grossAmount?: number | null;
  fees: number;
  taxes: number;
  note?: string | null;
}

/** Valori per la tabella `investment_transactions` (numeric come stringhe). */
export function toRowValues(fields: OperationFields, fxRate: number) {
  const income = INCOME_TYPES.has(fields.type);
  return {
    type: fields.type,
    date: fields.date,
    quantity: income ? "0" : String(fields.quantity),
    price: income ? "0" : String(fields.price),
    grossAmount: income ? String(fields.grossAmount ?? 0) : null,
    fxRate: String(fxRate),
    fees: fields.fees.toFixed(2),
    taxes: fields.taxes.toFixed(2),
    note: fields.note ?? null,
  };
}

/** Valuta principale dell'utente. */
export async function getUserCurrency(userId: string): Promise<string> {
  const [row] = await db.select({ currency: authUser.currency }).from(authUser).where(eq(authUser.id, userId));
  return row?.currency ?? "EUR";
}

/**
 * Cambio valuta strumento → valuta utente alla data: 1 se coincidono, altrimenti dai cambi salvati; se mancano
 * prova a scaricarli con `fetchMissing` e riprova. Null se non è disponibile (l'utente lo inserisce a mano).
 */
export async function resolveOperationFxRate(
  instrument: Instrument,
  userCurrency: string,
  dateKey: string,
  fetchMissing: (currencies: string[], dateKey: string) => Promise<void>
): Promise<number | null> {
  if (instrument.currency === userCurrency) return 1;
  const currencies = [instrument.currency, userCurrency];
  const fromTable = async () => fxRateBetween(buildFxTable(await loadRatesUpTo(currencies, dateKey)), instrument.currency, userCurrency, dateKey);
  const stored = await fromTable();
  if (stored !== null) return stored;
  await fetchMissing(currencies, dateKey);
  return fromTable();
}

/**
 * Messaggio d'errore se, dopo la modifica, qualche vendita o rimborso supera le quote possedute in quel momento.
 * `next` è l'elenco finale delle operazioni dello strumento.
 */
export function oversoldMessage(next: InvestmentTransactionInput[]): string | null {
  const oversold = findOversoldTransaction(next);
  if (!oversold) return null;
  const [year, month, day] = oversold.date.split("-");
  return `Il ${day}/${month}/${year} risulterebbero vendute più quote di quelle possedute`;
}

/** Operazione dal DB nella forma dei calcoli. */
export function toCalcInput(row: InvestmentTransaction): InvestmentTransactionInput {
  return {
    id: row.id,
    instrumentId: row.instrumentId,
    type: row.type,
    date: row.date,
    quantity: row.quantity,
    price: row.price,
    fxRate: row.fxRate,
    fees: row.fees,
    taxes: row.taxes,
    grossAmount: row.grossAmount,
  };
}

/** Data odierna YYYY-MM-DD (UTC, come le chiavi delle altre date del modulo). */
export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Data spostata di `days` giorni. */
export function shiftDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
