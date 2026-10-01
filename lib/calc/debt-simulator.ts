/**
 * Simulatore di Debiti: confronti "e se" puri, senza scrivere nulla. Surroga (offerta nuova contro condizioni attuali),
 * rialzo dell'indice su una linea di credito e strategie di estinzione con più debiti (valanga / palla di neve).
 */

import { addMonthsClamped, installmentAmount, round2, type IsoDate } from "./amortization";
import type { LoanPlanTotals } from "./debt-plan";

// --- Surroga ---------------------------------------------------------------------------------------------------------

export interface RefinanceOffer {
  /** Nuovo TAN annuo in %. */
  annualRate: number;
  /** Numero di rate del nuovo finanziamento. */
  installments: number;
  /** Spese una tantum della nuova offerta (istruttoria, perizia, ...). */
  upfrontCosts: number;
  /** Penale di estinzione del finanziamento attuale. */
  penalty: number;
}

export interface RefinanceResult {
  /** Capitale da rifinanziare: il residuo di oggi. */
  residual: number;
  currentInstallment: number;
  currentInterestRemaining: number;
  currentEndDate: IsoDate;
  newInstallment: number;
  newInterest: number;
  newEndDate: IsoDate;
  /** Spese e penale da pagare per cambiare. */
  switchCosts: number;
  /** Interessi risparmiati meno spese e penale: quanto conviene davvero (negativo = non conviene). */
  netSaving: number;
  /** Dopo quanti mesi il risparmio sulla rata copre le spese (null se la rata non scende o non ci sono spese). */
  breakEvenMonths: number | null;
}

/** Confronta ciò che resta da pagare oggi con una nuova offerta sullo stesso residuo. */
export function compareRefinance(current: Pick<LoanPlanTotals, "residual" | "currentInstallment" | "interestRemaining" | "endDate">, today: IsoDate, offer: RefinanceOffer): RefinanceResult {
  const newInstallment = installmentAmount(current.residual, offer.annualRate, offer.installments);
  const newInterest = round2(newInstallment * offer.installments - current.residual);
  const switchCosts = round2(offer.upfrontCosts + offer.penalty);
  const monthlySaving = current.currentInstallment - newInstallment;
  return {
    residual: current.residual,
    currentInstallment: current.currentInstallment,
    currentInterestRemaining: current.interestRemaining,
    currentEndDate: current.endDate,
    newInstallment,
    newInterest,
    newEndDate: addMonthsClamped(today, offer.installments),
    switchCosts,
    netSaving: round2(current.interestRemaining - newInterest - switchCosts),
    breakEvenMonths: switchCosts > 0 && monthlySaving > 0 ? Math.ceil(switchCosts / monthlySaving) : null,
  };
}

// --- Rialzo dell'indice su una linea di credito -----------------------------------------------------------------------

/** Punti di indice in più simulati sulla linea di credito. */
export const RATE_SHOCK_POINTS = [0.5, 1, 2] as const;

export interface RateShockRow {
  points: number;
  rate: number;
  monthlyCost: number;
  yearlyCost: number;
  /** Costo annuo in più rispetto a oggi. */
  extraYearly: number;
}

/** Costo di interessi su `used` se il tasso totale salisse di 0,5 / 1 / 2 punti. */
export function creditLineRateScenarios(used: number, currentRate: number, shocks: readonly number[] = RATE_SHOCK_POINTS): RateShockRow[] {
  const yearly = (rate: number) => round2((used * rate) / 100);
  const base = yearly(currentRate);
  return shocks.map((points) => {
    const rate = round2(currentRate + points);
    return { points, rate, monthlyCost: round2(yearly(rate) / 12), yearlyCost: yearly(rate), extraYearly: round2(yearly(rate) - base) };
  });
}

// --- Strategie di estinzione ------------------------------------------------------------------------------------------

export type PayoffStrategy = "avalanche" | "snowball";

export interface PayoffLoan {
  id: string;
  name: string;
  residual: number;
  /** TAN annuo in %. */
  annualRate: number;
  installment: number;
}

export interface PayoffResult {
  strategy: PayoffStrategy | "none";
  months: number;
  totalInterest: number;
  endDate: IsoDate;
  /** Nomi dei debiti nell'ordine in cui si chiudono. */
  closeOrder: string[];
}

/** Tetto di mesi simulati: oltre, il debito non si chiude (rata troppo bassa). */
export const MAX_PAYOFF_MONTHS = 600;

/**
 * Stima a mesi interi: ogni mese maturano gli interessi, si paga la rata di ciascun debito e tutto ciò che avanza
 * (extra mensile più le rate dei debiti già chiusi) va al debito scelto dalla strategia. Semplificata: rate costanti,
 * tasso costante, nessuna penale. Serve a confrontare le strategie tra loro, non a prevedere gli importi.
 */
export function simulatePayoff(loans: PayoffLoan[], monthlyExtra: number, strategy: PayoffStrategy | "none", today: IsoDate): PayoffResult {
  const state = loans.filter((l) => l.residual > 0).map((l) => ({ ...l, balance: l.residual }));
  const closeOrder: string[] = [];
  let totalInterest = 0;
  let freed = 0;
  let months = 0;
  const rollover = strategy !== "none";

  while (state.some((l) => l.balance > 0.005) && months < MAX_PAYOFF_MONTHS) {
    months += 1;
    for (const loan of state) {
      if (loan.balance <= 0.005) continue;
      const interest = (loan.balance * loan.annualRate) / 1200;
      totalInterest += interest;
      loan.balance += interest - Math.min(loan.installment, loan.balance + interest);
    }
    let pool = rollover ? monthlyExtra + freed : 0;
    const order = state
      .filter((l) => l.balance > 0.005)
      .sort((a, b) => (strategy === "snowball" ? a.balance - b.balance : b.annualRate - a.annualRate));
    for (const loan of order) {
      if (pool <= 0) break;
      const pay = Math.min(pool, loan.balance);
      loan.balance -= pay;
      pool -= pay;
    }
    for (const loan of state) {
      if (loan.balance <= 0.005 && !closeOrder.includes(loan.name)) {
        closeOrder.push(loan.name);
        loan.balance = 0;
        freed += loan.installment;
      }
    }
  }
  return { strategy, months, totalInterest: round2(totalInterest), endDate: addMonthsClamped(today, months), closeOrder };
}

/** Le tre simulazioni affiancate: senza extra, valanga (tasso più alto prima) e palla di neve (residuo più piccolo prima). */
export function comparePayoffStrategies(loans: PayoffLoan[], monthlyExtra: number, today: IsoDate): Record<PayoffStrategy | "none", PayoffResult> {
  return {
    none: simulatePayoff(loans, 0, "none", today),
    avalanche: simulatePayoff(loans, monthlyExtra, "avalanche", today),
    snowball: simulatePayoff(loans, monthlyExtra, "snowball", today),
  };
}
