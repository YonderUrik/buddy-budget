/**
 * Stato e regole dei form della linea di credito (puro): "Aggiungi una linea" e "Impostazioni". Legge i campi come testo,
 * li controlla e costruisce l'input per l'API; i form si limitano a mostrare ciò che questo modulo restituisce.
 */

import type { CreditLineDayCount, CreditLineFrequency } from "@/lib/db/schema/debts";
import type { CreateCreditLineInput, UpdateDebtInput } from "@/lib/validation/debts";
import { CREDIT_LINE_MAX_SPREAD, DEBT_MAX_ANNUAL_RATE } from "@/lib/validation/debts";
import { parseAmount, type AddDebtCostField } from "./add-form";
import type { CreditLineView } from "./view";

export type AlertKind = "none" | "percent" | "amount";

export interface CreditLineFormState {
  name: string;
  creditLimit: string;
  /** Utilizzato alla data di apertura (solo creazione). */
  initialUsed: string;
  /** Valore iniziale dell'indice in % (solo creazione). */
  indexRate: string;
  spread: string;
  indexLabel: string;
  /** Data di apertura o di inizio del tracciamento (solo creazione). */
  openDate: string;
  interestFrequency: CreditLineFrequency;
  dayCount: CreditLineDayCount;
  capitalizeInterest: boolean;
  alertKind: AlertKind;
  alertValue: string;
  costs: AddDebtCostField[];
}

/** Valori proposti: l'utente li controlla sul contratto, nessuna regola è cablata. */
export const CREDIT_LINE_DEFAULTS = {
  interestFrequency: "monthly",
  dayCount: "365",
  capitalizeInterest: false,
} as const satisfies Pick<CreditLineFormState, "interestFrequency" | "dayCount" | "capitalizeInterest">;

export function emptyCreditLineForm(today: string): CreditLineFormState {
  return {
    name: "",
    creditLimit: "",
    initialUsed: "0",
    indexRate: "",
    spread: "0",
    indexLabel: "",
    openDate: today,
    alertKind: "none",
    alertValue: "",
    costs: [],
    ...CREDIT_LINE_DEFAULTS,
  };
}

const text = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value).replace(".", ","));

/** Stato del form delle impostazioni, dai valori attuali della linea. */
export function creditLineFormFromView(line: CreditLineView): CreditLineFormState {
  return {
    name: line.name,
    creditLimit: text(line.creditLimit),
    initialUsed: text(line.initialUsed),
    indexRate: text(line.initialIndexRate),
    spread: text(line.spread),
    indexLabel: line.indexLabel ?? "",
    openDate: line.openDate,
    interestFrequency: line.interestFrequency,
    dayCount: line.dayCount,
    capitalizeInterest: line.capitalizeInterest,
    alertKind: line.alertThreshold?.type ?? "none",
    alertValue: text(line.alertThreshold?.value),
    costs: line.costs.map((c) => ({ label: c.label, amount: text(c.amount), kind: c.kind })),
  };
}

/** Primo errore da mostrare all'utente, o null se il form è valido. `creating` controlla anche i dati iniziali. */
export function validateCreditLineForm(state: CreditLineFormState, creating: boolean): string | null {
  if (state.name.trim() === "") return "Dai un nome alla linea";
  const limit = parseAmount(state.creditLimit);
  if (limit === undefined || limit <= 0) return "Inserisci il fido: è l'importo massimo che puoi utilizzare";
  const spread = parseAmount(state.spread);
  if (spread === undefined || spread < 0 || spread > CREDIT_LINE_MAX_SPREAD) return "Lo spread deve essere un numero da 0 in su";
  if (state.alertKind !== "none") {
    const value = parseAmount(state.alertValue);
    if (value === undefined || value <= 0) return "Inserisci la soglia di allerta oppure toglila";
    if (state.alertKind === "percent" && value > 100) return "La soglia in percentuale non può superare 100";
  }
  for (const cost of state.costs) {
    if (cost.label.trim() === "" || parseAmount(cost.amount) === undefined) return "Completa le spese oppure toglile";
  }
  if (!creating) return null;
  const used = parseAmount(state.initialUsed);
  if (used === undefined || used < 0) return "Inserisci quanto hai già utilizzato (anche 0)";
  if (used > limit) return "L'utilizzato iniziale supera il fido";
  const index = parseAmount(state.indexRate);
  if (index === undefined || index < 0 || index > DEBT_MAX_ANNUAL_RATE) return "Inserisci il valore dell'indice (per un tasso fisso, il tasso)";
  if (state.openDate === "") return "Indica da quando tenere traccia";
  return null;
}

function costsOf(state: CreditLineFormState) {
  return state.costs.map((c) => ({ label: c.label.trim(), amount: parseAmount(c.amount) ?? 0, kind: c.kind }));
}

function alertOf(state: CreditLineFormState): { type: "percent" | "amount"; value: number } | null {
  if (state.alertKind === "none") return null;
  return { type: state.alertKind, value: parseAmount(state.alertValue) ?? 0 };
}

/** Input dell'API per creare la linea (da chiamare solo con un form valido). */
export function buildCreateCreditLineInput(state: CreditLineFormState): CreateCreditLineInput {
  const alert = alertOf(state);
  return {
    kind: "credit_line",
    name: state.name.trim(),
    creditLimit: parseAmount(state.creditLimit) ?? 0,
    initialUsed: parseAmount(state.initialUsed) ?? 0,
    indexRate: parseAmount(state.indexRate) ?? 0,
    spread: parseAmount(state.spread) ?? 0,
    indexLabel: state.indexLabel.trim() || undefined,
    openDate: state.openDate,
    interestFrequency: state.interestFrequency,
    dayCount: state.dayCount,
    capitalizeInterest: state.capitalizeInterest,
    alertThreshold: alert,
    costs: costsOf(state),
  };
}

/** Modifica per l'API dalle impostazioni: tutte le regole, la soglia `null` quando l'utente la toglie. */
export function buildCreditLineSettingsPatch(state: CreditLineFormState): UpdateDebtInput {
  return {
    name: state.name.trim(),
    creditLimit: parseAmount(state.creditLimit) ?? 0,
    spread: parseAmount(state.spread) ?? 0,
    indexLabel: state.indexLabel.trim(),
    interestFrequency: state.interestFrequency,
    dayCount: state.dayCount,
    capitalizeInterest: state.capitalizeInterest,
    alertThreshold: alertOf(state),
    costs: costsOf(state),
  };
}
