/**
 * Vista dei debiti per le schede: per ogni finanziamento il piano calcolato da condizioni ed eventi, e una
 * panoramica aggregata. Tutto puro: nessun accesso al database, la data di oggi arriva dal chiamante.
 */

import { computeApr, round2, type IsoDate } from "@/lib/calc/amortization";
import { buildLoanPlan, type DebtPlanEvent, type DebtTerms, type LoanPlan } from "@/lib/calc/debt-plan";
import type { Debt, DebtCost, DebtEvent } from "@/lib/db/schema/debts";

export interface DebtEventView {
  id: string;
  type: DebtEvent["type"];
  date: IsoDate;
  amount: number | null;
  installmentNumber: number | null;
  rate: number | null;
  penalty: number | null;
  effect: DebtEvent["effect"];
  transactionId: string | null;
  note: string | null;
}

export interface DebtView {
  id: string;
  kind: Debt["kind"];
  name: string;
  startMode: Debt["startMode"];
  principal: number;
  annualRate: number;
  installments: number;
  firstInstallmentDate: IsoDate;
  /** Rata dichiarata dall'utente (null se vale quella calcolata). */
  declaredInstallment: number | null;
  anchorDate: IsoDate | null;
  costs: DebtCost[];
  plan: LoanPlan;
  /** TAEG in % (con la fotografia di oggi è quello di ciò che resta), null se non calcolabile. */
  apr: number | null;
  events: DebtEventView[];
}

export interface DebtDueItem {
  debtId: string;
  name: string;
  date: IsoDate;
  amount: number;
  overdue: boolean;
}

export interface DebtsOverview {
  /** Capitale residuo dei finanziamenti ancora aperti. */
  totalResidual: number;
  /** Debito totale: coincide col capitale residuo (i debiti sono solo finanziamenti). */
  totalDebt: number;
  /** Somma delle rate correnti dei finanziamenti ancora aperti. */
  monthlyPayment: number;
  interestToDate: number;
  interestRemaining: number;
  /** Data dell'ultima rata del debito che finisce per ultimo (null senza debiti aperti). */
  debtFreeDate: IsoDate | null;
  openCount: number;
  /** TAEG medio dei debiti aperti, pesato sul residuo (null se nessuno è calcolabile). */
  weightedApr: number | null;
  nextDue: DebtDueItem[];
  /** Residuo complessivo da oggi in avanti (somma dei residui di tutti i finanziamenti). */
  residualSeries: { date: IsoDate; residual: number }[];
}

export interface DebtsViewData {
  debts: DebtView[];
  overview: DebtsOverview;
}

/** Quante scadenze mostrare nell'elenco "prossime". */
export const NEXT_DUE_LIMIT = 5;

/** Evento del registro nella forma che il motore del piano capisce (null se mancano dati). */
export function toPlanEvent(e: DebtEventView): DebtPlanEvent | null {
  if (e.type === "payment" && e.installmentNumber !== null && e.amount !== null) {
    return { type: "payment", installmentNumber: e.installmentNumber, date: e.date, amount: e.amount, transactionId: e.transactionId };
  }
  if (e.type === "rate_change" && e.rate !== null) return { type: "rate_change", date: e.date, rate: e.rate };
  if (e.type === "balance_correction" && e.amount !== null) return { type: "balance_correction", date: e.date, amount: e.amount };
  if (e.type === "early_repayment" && e.amount !== null && e.effect) {
    return { type: "early_repayment", date: e.date, amount: e.amount, penalty: e.penalty ?? 0, effect: e.effect };
  }
  return null;
}

function toEventView(e: DebtEvent): DebtEventView {
  return {
    id: e.id,
    type: e.type,
    date: e.date,
    amount: e.amount !== null ? Number(e.amount) : null,
    installmentNumber: e.installmentNumber,
    rate: e.rate !== null ? Number(e.rate) : null,
    penalty: e.penalty !== null ? Number(e.penalty) : null,
    effect: e.effect,
    transactionId: e.transactionId,
    note: e.note,
  };
}

/** Condizioni iniziali di un debito nella forma del motore del piano (anche lato client, dalla vista). */
export function toPlanTerms(debt: Pick<DebtView, "startMode" | "principal" | "annualRate" | "installments" | "firstInstallmentDate" | "declaredInstallment">): DebtTerms {
  return {
    startMode: debt.startMode,
    principal: debt.principal,
    annualRate: debt.annualRate,
    installments: debt.installments,
    firstInstallmentDate: debt.firstInstallmentDate,
    installment: debt.declaredInstallment,
  };
}

/**
 * TAEG del debito, sempre calcolato quando i dati lo permettono. Con le condizioni originali (nuovo/origine) conta le
 * spese una tantum; con la fotografia di oggi (che non ha l'erogazione) è il TAEG di ciò che resta, dal residuo di oggi.
 */
function computeDebtApr(debt: Debt, plan: LoanPlan): number | null {
  const upfront = debt.startMode === "fotografia" ? 0 : debt.costs.filter((c) => c.kind === "una_tantum").reduce((s, c) => s + c.amount, 0);
  const recurring = debt.costs.filter((c) => c.kind === "per_rata").reduce((s, c) => s + c.amount, 0);
  const installment = debt.installment !== null ? Number(debt.installment) : plan.rows[0]?.installment;
  if (!installment) return null;
  try {
    return computeApr({ principal: Number(debt.principal), upfrontCosts: upfront, installment, recurringCosts: recurring, installments: debt.installments });
  } catch {
    return null;
  }
}

/** Ultimo valore noto di una serie a scalini alla data (0 prima del suo inizio). */
function valueAt(series: { date: IsoDate; residual: number }[], date: IsoDate): number {
  let value = 0;
  for (const point of series) {
    if (point.date > date) break;
    value = point.residual;
  }
  return value;
}

/** Debito complessivo da oggi in avanti: un primo punto a oggi e poi uno per ogni scadenza. */
function buildResidualSeries(views: DebtView[], today: IsoDate): DebtsOverview["residualSeries"] {
  const dates = [...new Set(views.flatMap((v) => v.plan.residualSeries.map((p) => p.date)))].filter((d) => d > today).sort();
  return [today, ...dates].map((date) => ({ date, residual: round2(views.reduce((s, v) => s + valueAt(v.plan.residualSeries, date), 0)) }));
}

/** TAEG medio dei debiti aperti, pesato sul capitale residuo. */
function weightedApr(open: DebtView[]): number | null {
  const withApr = open.filter((v) => v.apr !== null && v.plan.totals.residual > 0);
  const weight = withApr.reduce((s, v) => s + v.plan.totals.residual, 0);
  if (weight === 0) return null;
  return withApr.reduce((s, v) => s + (v.apr as number) * v.plan.totals.residual, 0) / weight;
}

/** Costruisce la vista completa dei debiti dell'utente a `today`. Le righe `credit_line` (funzione rimossa) si ignorano. */
export function buildDebtsView(debts: Debt[], events: DebtEvent[], today: IsoDate): DebtsViewData {
  const views: DebtView[] = debts
    .filter((d) => d.kind === "loan")
    .map((debt) => {
      const own = events.filter((e) => e.debtId === debt.id).sort((a, b) => a.date.localeCompare(b.date)).map(toEventView);
      const view = {
        id: debt.id,
        kind: debt.kind,
        name: debt.name,
        startMode: debt.startMode,
        principal: Number(debt.principal),
        annualRate: Number(debt.annualRate),
        installments: debt.installments,
        firstInstallmentDate: debt.firstInstallmentDate,
        declaredInstallment: debt.installment !== null ? Number(debt.installment) : null,
        anchorDate: debt.anchorDate,
        costs: debt.costs,
      };
      const plan = buildLoanPlan(
        toPlanTerms(view),
        own.flatMap((e) => toPlanEvent(e) ?? []),
        today
      );
      return { ...view, plan, apr: computeDebtApr(debt, plan), events: own };
    });

  const open = views.filter((v) => !v.plan.totals.finished);
  const sum = (pick: (v: DebtView) => number, list = open) => round2(list.reduce((s, v) => s + pick(v), 0));
  const nextDue: DebtDueItem[] = open
    .flatMap((v) => {
      const row = v.plan.rows.find((r) => r.status === "da_pagare" || r.status === "scaduta");
      return row ? [{ debtId: v.id, name: v.name, date: row.dueDate, amount: row.installment, overdue: row.status === "scaduta" }] : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, NEXT_DUE_LIMIT);

  return {
    debts: views,
    overview: {
      totalResidual: sum((v) => v.plan.totals.residual),
      totalDebt: sum((v) => v.plan.totals.residual),
      monthlyPayment: sum((v) => v.plan.totals.currentInstallment),
      interestToDate: sum((v) => v.plan.totals.interestToDate, views),
      interestRemaining: sum((v) => v.plan.totals.interestRemaining, views),
      debtFreeDate: open.length > 0 ? open.map((v) => v.plan.totals.endDate).sort().at(-1)! : null,
      openCount: open.length,
      weightedApr: weightedApr(open),
      nextDue,
      residualSeries: buildResidualSeries(views, today),
    },
  };
}
