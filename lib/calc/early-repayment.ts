/**
 * Confronto tra le alternative di un'estinzione anticipata ("ho fatto" ed "e se" usano lo stesso calcolo): costruisce il
 * piano con e senza l'estinzione e ne ricava interessi risparmiati, nuova rata e nuova fine. Tutto puro.
 */

import { round2, type IsoDate } from "./amortization";
import { buildLoanPlan, type DebtPlanEvent, type DebtTerms, type EarlyRepaymentEffect, type LoanPlan } from "./debt-plan";

export interface EarlyRepaymentInput {
  date: IsoDate;
  amount: number;
  /** Penale in euro (già calcolata: la percentuale si converte prima di arrivare qui). */
  penalty: number;
}

export interface EarlyRepaymentOutcome {
  effect: EarlyRepaymentEffect;
  /** Rata della prossima scadenza dopo l'estinzione (0 se il debito si chiude). */
  nextInstallment: number;
  endDate: IsoDate;
  /** Rate che restano dopo la data dell'estinzione. */
  remainingInstallments: number;
  /** Interessi che si pagherebbero da dopo la data dell'estinzione in poi. */
  interestAfter: number;
  /** Interessi risparmiati rispetto a non estinguere. */
  interestSaved: number;
  /** Interessi risparmiati meno la penale: quanto conviene davvero. */
  netBenefit: number;
  /** Mesi di anticipo sulla fine (0 se la scadenza non cambia). */
  monthsSaved: number;
  closesDebt: boolean;
  plan: LoanPlan;
}

export interface EarlyRepaymentComparison {
  /** Interessi che si pagherebbero comunque da dopo la data in poi, senza estinguere. */
  baselineInterest: number;
  baselineEndDate: IsoDate;
  baselineInstallment: number;
  reduceInstallment: EarlyRepaymentOutcome;
  reduceDuration: EarlyRepaymentOutcome;
}

function interestAfter(plan: LoanPlan, date: IsoDate): number {
  return round2(plan.rows.filter((r) => r.dueDate > date).reduce((s, r) => s + r.interest, 0));
}

function monthsBetween(from: IsoDate, to: IsoDate): number {
  return (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + (Number(to.slice(5, 7)) - Number(from.slice(5, 7)));
}

function outcome(
  terms: DebtTerms,
  events: DebtPlanEvent[],
  today: IsoDate,
  input: EarlyRepaymentInput,
  effect: EarlyRepaymentEffect,
  baseline: LoanPlan,
  baselineInterest: number
): EarlyRepaymentOutcome {
  const plan = buildLoanPlan(terms, [...events, { type: "early_repayment", ...input, effect }], today);
  const after = interestAfter(plan, input.date);
  const next = plan.rows.find((r) => r.dueDate > input.date);
  return {
    effect,
    nextInstallment: next?.installment ?? 0,
    endDate: plan.totals.endDate,
    remainingInstallments: plan.rows.filter((r) => r.dueDate > input.date).length,
    interestAfter: after,
    interestSaved: round2(baselineInterest - after),
    netBenefit: round2(baselineInterest - after - input.penalty),
    monthsSaved: Math.max(0, monthsBetween(plan.totals.endDate, baseline.totals.endDate)),
    closesDebt: plan.totals.closedOn !== null,
    plan,
  };
}

/** Le due alternative affiancate per un'estinzione anticipata, con gli interessi risparmiati di ciascuna. */
export function compareEarlyRepayment(terms: DebtTerms, events: DebtPlanEvent[], today: IsoDate, input: EarlyRepaymentInput): EarlyRepaymentComparison {
  const baseline = buildLoanPlan(terms, events, today);
  const baselineInterest = interestAfter(baseline, input.date);
  const next = baseline.rows.find((r) => r.dueDate > input.date);
  return {
    baselineInterest,
    baselineEndDate: baseline.totals.endDate,
    baselineInstallment: next?.installment ?? 0,
    reduceInstallment: outcome(terms, events, today, input, "reduce_installment", baseline, baselineInterest),
    reduceDuration: outcome(terms, events, today, input, "reduce_duration", baseline, baselineInterest),
  };
}

export interface RecurringExtraResult {
  /** Interessi totali da oggi in avanti con l'extra mensile. */
  interestWith: number;
  interestWithout: number;
  interestSaved: number;
  /** Totale versato in extra fino alla chiusura. */
  extraPaid: number;
  endDate: IsoDate;
  baselineEndDate: IsoDate;
  monthsSaved: number;
}

/**
 * "Se pagassi ogni mese un extra": a ogni scadenza futura un'estinzione parziale con effetto "riduci la durata". Solo
 * simulazione, non si registra.
 */
export function simulateRecurringExtra(terms: DebtTerms, events: DebtPlanEvent[], today: IsoDate, monthlyExtra: number): RecurringExtraResult {
  const baseline = buildLoanPlan(terms, events, today);
  const extras: DebtPlanEvent[] = baseline.rows
    .filter((r) => r.dueDate > today)
    .map((r) => ({ type: "early_repayment", date: r.dueDate, amount: monthlyExtra, penalty: 0, effect: "reduce_duration" }));
  const plan = buildLoanPlan(terms, [...events, ...extras], today);
  const future = (p: LoanPlan) => round2(p.rows.filter((r) => r.dueDate > today).reduce((s, r) => s + r.interest, 0));
  const extraPaid = round2(plan.earlyRepayments.reduce((s, r) => s + r.amount, 0));
  return {
    interestWith: future(plan),
    interestWithout: future(baseline),
    interestSaved: round2(future(baseline) - future(plan)),
    extraPaid,
    endDate: plan.totals.endDate,
    baselineEndDate: baseline.totals.endDate,
    monthsSaved: Math.max(0, monthsBetween(plan.totals.endDate, baseline.totals.endDate)),
  };
}
