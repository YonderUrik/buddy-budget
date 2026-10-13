/** Mesi oltre i quali il calcolatore smette di cercare: 100 anni bastano a dire «così non ci arrivi». */
export const MAX_GOAL_MONTHS = 1200;

export interface SavingsGoalInput {
  /** Cifra da raggiungere (€). */
  target: number;
  /** Quanto hai già da parte oggi (€). */
  start: number;
  /** Quanto metti da parte ogni mese (€). */
  monthly: number;
  /** Rendimento annuo atteso dei risparmi (%), 0 se restano sul conto. */
  annualReturnPct: number;
}

export interface SavingsGoalResult {
  /** Mesi per arrivare all'obiettivo; null se non ci si arriva entro `MAX_GOAL_MONTHS`. */
  months: number | null;
  /** Quanto avrai versato di tasca tua in quei mesi (partenza compresa). */
  contributed: number;
  /** Quanto viene dal rendimento. */
  growth: number;
  /** Saldo mese per mese (indice 0 = oggi), fino all'arrivo o al limite. */
  path: number[];
}

/** Mesi per arrivare a un obiettivo di risparmio con un versamento mensile fisso e un rendimento composto mensile. */
export function savingsGoal({ target, start, monthly, annualReturnPct }: SavingsGoalInput): SavingsGoalResult {
  const r = Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1;
  let balance = Math.max(0, start);
  let contributed = balance;
  const path = [balance];
  if (balance >= target) return { months: 0, contributed, growth: 0, path };
  for (let m = 1; m <= MAX_GOAL_MONTHS; m++) {
    balance = balance * (1 + r) + monthly;
    contributed += monthly;
    path.push(balance);
    if (balance >= target) return { months: m, contributed, growth: balance - contributed, path };
  }
  return { months: null, contributed, growth: balance - contributed, path };
}

/** Versamento mensile che serve per arrivare all'obiettivo in `months` mesi (0 se ci arrivi già con quello che hai). */
export function monthlyNeeded(target: number, start: number, months: number, annualReturnPct: number): number {
  if (months <= 0) return Math.max(0, target - start);
  const r = Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1;
  const grownStart = Math.max(0, start) * Math.pow(1 + r, months);
  const factor = r === 0 ? months : (Math.pow(1 + r, months) - 1) / r;
  return Math.max(0, (target - grownStart) / factor);
}
