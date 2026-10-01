/** Logica pura del dialog "Estinzione anticipata": validazione dei campi e anteprima del confronto. */

import { compareEarlyRepayment, simulateRecurringExtra, type EarlyRepaymentComparison, type RecurringExtraResult } from "@/lib/calc/early-repayment";
import { round2 } from "@/lib/calc/amortization";
import { parseAmount } from "./add-form";
import { toPlanEvent, toPlanTerms, type DebtView } from "./view";

export type PenaltyUnit = "eur" | "percent";
export type EarlyRepaymentMode = "once" | "monthly";

export interface EarlyRepaymentFormValues {
  mode: EarlyRepaymentMode;
  date: string;
  amount: string;
  penalty: string;
  penaltyUnit: PenaltyUnit;
}

export type EarlyRepaymentPreview =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "once"; amount: number; penalty: number; date: string; comparison: EarlyRepaymentComparison }
  | { kind: "monthly"; amount: number; result: RecurringExtraResult };

/** Penale in euro: un importo fisso o una percentuale della somma estinta. */
export function resolvePenalty(amount: number, text: string, unit: PenaltyUnit): number | undefined {
  if (text.trim() === "") return 0;
  const value = parseAmount(text);
  if (value === undefined || value < 0) return undefined;
  return unit === "percent" ? round2((amount * value) / 100) : round2(value);
}

/** Anteprima del confronto per i valori inseriti (o il motivo per cui non è ancora calcolabile). */
export function previewEarlyRepayment(debt: DebtView, today: string, values: EarlyRepaymentFormValues): EarlyRepaymentPreview {
  const amount = parseAmount(values.amount);
  if (values.amount.trim() === "") return { kind: "empty" };
  if (amount === undefined || amount <= 0) return { kind: "error", message: "Inserisci un importo valido" };
  const terms = toPlanTerms(debt);
  const events = debt.events.flatMap((e) => toPlanEvent(e) ?? []);
  if (values.mode === "monthly") {
    if (debt.plan.totals.finished) return { kind: "error", message: "Il debito è già concluso" };
    return { kind: "monthly", amount, result: simulateRecurringExtra(terms, events, today, amount) };
  }
  if (!values.date) return { kind: "error", message: "Indica la data" };
  if (!debt.plan.rows.some((r) => r.dueDate > values.date)) return { kind: "error", message: "La data è dopo l'ultima rata del piano" };
  const penalty = resolvePenalty(amount, values.penalty, values.penaltyUnit);
  if (penalty === undefined) return { kind: "error", message: "La penale non è valida" };
  return { kind: "once", amount, penalty, date: values.date, comparison: compareEarlyRepayment(terms, events, today, { date: values.date, amount, penalty }) };
}
