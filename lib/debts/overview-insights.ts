/**
 * Letture della panoramica di Debiti: dove si pagano più interessi in un anno e come uscire prima dai debiti con un
 * extra mensile. Pure: la data di oggi arriva dal chiamante.
 */

import type { IsoDate } from "@/lib/calc/amortization";
import type { LoanPlanRow } from "@/lib/calc/debt-plan";
import { comparePayoffStrategies, type PayoffLoan } from "@/lib/calc/debt-simulator";
import type { DebtView } from "./view";

export interface InterestShare {
  id: string;
  name: string;
  /** Interessi di un anno al residuo e al tasso di oggi. */
  yearly: number;
  /** Quota sul totale (0-1). */
  share: number;
}

export interface YearlyInterest {
  items: InterestShare[];
  total: number;
}

/** Interessi di un anno su ogni finanziamento aperto dal più alto al più basso. */
export function yearlyInterestShares(debts: DebtView[]): YearlyInterest {
  const raw = [
    ...debts
      .filter((d) => !d.plan.totals.finished && d.plan.totals.residual > 0)
      .map((d) => ({ id: d.id, name: d.name, yearly: (d.plan.totals.residual * d.annualRate) / 100 })),
  ].filter((r) => r.yearly > 0);
  const total = raw.reduce((sum, r) => sum + r.yearly, 0);
  const items = raw.sort((a, b) => b.yearly - a.yearly).map((r) => ({ ...r, share: total > 0 ? r.yearly / total : 0 }));
  return { items, total };
}

export interface ExitStep {
  id: string;
  name: string;
  endDate: IsoDate;
  /** Quando finirebbe senza l'extra. */
  baselineEndDate: IsoDate;
  monthsSaved: number;
}

export interface ExitPlan {
  steps: ExitStep[];
  endDate: IsoDate;
  baselineEndDate: IsoDate;
  interestSaved: number;
}

/** «Come uscirne prima» slider: monthly extra from 0 to `EXIT_EXTRA_MAX` in steps of `EXIT_EXTRA_STEP`. */
export const EXIT_EXTRA_DEFAULT = 200;
export const EXIT_EXTRA_MAX = 1000;
export const EXIT_EXTRA_STEP = 50;

/** Share of the principal already repaid (0-1), from the plan. */
export function repaidShare(debt: DebtView): number {
  const first = debt.plan.rows[0];
  if (!first) return 0;
  const total = first.residual + first.capital;
  return total > 0 ? Math.min(1, Math.max(0, 1 - debt.plan.totals.residual / total)) : 0;
}

/**
 * Overview readings of `GET /api/debts?include=insights` (gaps.md G12): yearly interest shares, repaid share per debt,
 * the exit-plan inputs and the avalanche plan for every step of the extra-per-month slider (so the slider only indexes).
 */
export function buildDebtsInsights(debts: DebtView[], today: IsoDate) {
  const extras = Array.from({ length: EXIT_EXTRA_MAX / EXIT_EXTRA_STEP + 1 }, (_, i) => i * EXIT_EXTRA_STEP);
  return {
    interestShares: yearlyInterestShares(debts),
    repaid: debts.map((debt) => ({ debtId: debt.id, share: repaidShare(debt) })),
    exit: {
      loans: toPayoffLoans(debts),
      slider: { min: 0, max: EXIT_EXTRA_MAX, step: EXIT_EXTRA_STEP, default: EXIT_EXTRA_DEFAULT },
      /** `plans[i]` is the plan with `extras[i]` per month; null when no open loan or a payment never closes it. */
      extras,
      plans: extras.map((extra) => buildExitPlan(debts, extra, today)),
    },
  };
}

export type DebtsInsights = ReturnType<typeof buildDebtsInsights>;

/** Tetto di mesi: oltre, la simulazione non chiude il debito e il piano non viene proposto. */
const MAX_MONTHS_SIM = 600;

function toPayoffLoans(debts: DebtView[]): PayoffLoan[] {
  return debts
    .filter((d) => !d.plan.totals.finished && d.plan.totals.residual > 0)
    .map((d) => ({ id: d.id, name: d.name, residual: d.plan.totals.residual, annualRate: d.annualRate, installment: d.plan.totals.currentInstallment }));
}

/**
 * Piano "valanga": l'extra mensile e le rate dei debiti già chiusi vanno al tasso più alto. Per ogni debito dice quando
 * si chiude con l'extra e quando si chiuderebbe senza. Null senza finanziamenti aperti o se una rata non basta a chiudere.
 */
export function buildExitPlan(debts: DebtView[], monthlyExtra: number, today: IsoDate): ExitPlan | null {
  const loans = toPayoffLoans(debts);
  if (loans.length === 0) return null;
  const { none, avalanche } = comparePayoffStrategies(loans, Math.max(0, monthlyExtra), today);
  if (none.months >= MAX_MONTHS_SIM || avalanche.months >= MAX_MONTHS_SIM) return null;
  const baseline = new Map(none.closings.map((c) => [c.id, c]));
  const steps = avalanche.closings.map((c) => {
    const base = baseline.get(c.id) ?? c;
    return { id: c.id, name: c.name, endDate: c.endDate, baselineEndDate: base.endDate, monthsSaved: Math.max(0, base.months - c.months) };
  });
  return { steps, endDate: avalanche.endDate, baselineEndDate: none.endDate, interestSaved: Math.max(0, none.totalInterest - avalanche.totalInterest) };
}

/** La rata di un debito che scade alla data indicata e non è ancora saldata (per "Segna pagata" dalla panoramica). */
export function findDueRow(debt: DebtView, date: IsoDate): LoanPlanRow | undefined {
  return debt.plan.rows.find((r) => r.dueDate === date && r.status !== "pagata");
}
