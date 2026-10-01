/**
 * Stato e regole del form "Aggiungi debito" (puro): legge i quattro dati del finanziamento come testo, calcola quello
 * che manca e costruisce l'input per l'API. Il form si limita a mostrare ciò che questo modulo restituisce.
 */

import {
  AmortizationError,
  buildSegmentSchedule,
  computeApr,
  resolveMissingLoanInput,
  round2,
  type LoanInputKey,
  type LoanInputs,
} from "@/lib/calc/amortization";
import type { DebtStartMode } from "@/lib/db/schema/debts";
import type { CreateDebtInput } from "@/lib/validation/debts";

export interface AddDebtCostField {
  label: string;
  amount: string;
  kind: "una_tantum" | "per_rata";
}

export interface AddDebtFormState {
  name: string;
  startMode: DebtStartMode;
  /** Capitale erogato (nuovo/origine) o residuo di oggi (fotografia). */
  principal: string;
  installment: string;
  /** Rate totali (nuovo/origine) o rimanenti (fotografia). */
  installments: string;
  /** TAN annuo in %. */
  annualRate: string;
  /** Prima scadenza (nuovo/origine) o prossima scadenza (fotografia). */
  firstInstallmentDate: string;
  costs: AddDebtCostField[];
}

export function emptyAddDebtForm(startMode: DebtStartMode): AddDebtFormState {
  return { name: "", startMode, principal: "", installment: "", installments: "", annualRate: "", firstInstallmentDate: "", costs: [] };
}

/** Legge un numero scritto all'italiana ("1.250,50" o "6,9"); stringa vuota o non valida → undefined. */
export function parseAmount(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

export interface ResolvedAddForm {
  inputs: LoanInputs;
  /** Quale dato è stato calcolato (assente se l'utente li ha inseriti tutti e quattro). */
  calculated?: LoanInputKey;
  /** TAEG in % se ci sono le condizioni originali e delle spese; altrimenti null. */
  apr: number | null;
}

export type AddFormResolution = { ok: true; value: ResolvedAddForm } | { ok: false; message: string | null };

/** Quanti dati servono prima di provare a calcolare. */
const MIN_FILLED_FIELDS = 3;

/**
 * Risolve i quattro dati del finanziamento. Con meno di tre dati non è un errore (l'utente sta ancora scrivendo): `message`
 * è null. Con tre dati calcola il quarto; con quattro li usa come sono.
 */
export function resolveAddForm(state: AddDebtFormState): AddFormResolution {
  const partial: Partial<LoanInputs> = {
    principal: parseAmount(state.principal),
    installment: parseAmount(state.installment),
    installments: parseAmount(state.installments),
    annualRate: parseAmount(state.annualRate),
  };
  const filled = Object.values(partial).filter((v) => v !== undefined).length;
  if (filled < MIN_FILLED_FIELDS) return { ok: false, message: null };
  if (partial.installments !== undefined && !Number.isInteger(partial.installments)) {
    return { ok: false, message: "Il numero di rate deve essere intero" };
  }
  try {
    const { calculated, ...inputs } = resolveMissingLoanInput(partial);
    return { ok: true, value: { inputs, calculated, apr: computeFormApr(state, inputs) } };
  } catch (error) {
    if (error instanceof AmortizationError) return { ok: false, message: error.message };
    throw error;
  }
}

function sumCosts(costs: AddDebtCostField[], kind: AddDebtCostField["kind"]): number {
  return round2(costs.filter((c) => c.kind === kind).reduce((s, c) => s + (parseAmount(c.amount) ?? 0), 0));
}

function computeFormApr(state: AddDebtFormState, inputs: LoanInputs): number | null {
  if (state.startMode === "fotografia") return null;
  try {
    return computeApr({
      principal: inputs.principal,
      upfrontCosts: sumCosts(state.costs, "una_tantum"),
      installment: inputs.installment,
      recurringCosts: sumCosts(state.costs, "per_rata"),
      installments: inputs.installments,
    });
  } catch {
    return null;
  }
}

/** Input per `POST /api/debts`; la rata si dichiara solo se l'ha scritta l'utente (altrimenti vale quella calcolata dal piano). */
export function buildCreateDebtInput(state: AddDebtFormState, resolved: ResolvedAddForm, today: string): CreateDebtInput {
  const { inputs, calculated } = resolved;
  return {
    name: state.name.trim(),
    startMode: state.startMode,
    principal: round2(inputs.principal),
    annualRate: Math.round(inputs.annualRate * 10000) / 10000,
    installments: inputs.installments,
    firstInstallmentDate: state.firstInstallmentDate,
    installment: calculated === "installment" ? undefined : round2(inputs.installment),
    anchorDate: state.startMode === "fotografia" ? today : undefined,
    costs: state.costs
      .filter((c) => c.label.trim() !== "" && parseAmount(c.amount) !== undefined)
      .map((c) => ({ label: c.label.trim(), amount: parseAmount(c.amount) as number, kind: c.kind })),
  };
}

/** Controlli che non dipendono dal calcolo: nome e data. Restituisce il primo messaggio o null. */
export function validateAddFormBasics(state: AddDebtFormState): string | null {
  if (state.name.trim() === "") return "Dai un nome al debito";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.firstInstallmentDate)) return "Indica la data della prima rata";
  return null;
}

export interface AddFormPreview {
  installment: number;
  totalInterest: number;
  endDate: string;
}

/** Anteprima del piano dai dati risolti (rata, interessi totali, data dell'ultima rata); null se manca la data. */
export function previewAddForm(state: AddDebtFormState, resolved: ResolvedAddForm): AddFormPreview | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.firstInstallmentDate)) return null;
  const { inputs, calculated } = resolved;
  const rows = buildSegmentSchedule({
    firstDueDate: state.firstInstallmentDate,
    principal: inputs.principal,
    annualRate: inputs.annualRate,
    installments: inputs.installments,
    installment: calculated === "installment" ? undefined : inputs.installment,
  });
  return {
    installment: rows[0].installment,
    totalInterest: round2(rows.reduce((s, r) => s + r.interest, 0)),
    endDate: rows[rows.length - 1].dueDate,
  };
}
