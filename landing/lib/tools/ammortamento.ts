export interface AmortizationRow {
  n: number;
  installment: number;
  interest: number;
  principal: number;
  balance: number;
}

export interface AmortizationResult {
  installment: number;
  totalInterest: number;
  totalPaid: number;
  rows: AmortizationRow[];
}

/** Rata costante del piano alla francese (rata = capitale × i / (1 − (1+i)^−n)); con tasso 0 è capitale / n. */
export function frenchInstallment(principal: number, annualRatePct: number, months: number): number {
  const i = annualRatePct / 100 / 12;
  return i === 0 ? principal / months : (principal * i) / (1 - Math.pow(1 + i, -months));
}

/** Piano di ammortamento alla francese a rata costante, tasso nominale annuo (TAN) e rate mensili posticipate. */
export function buildFrenchPlan(principal: number, annualRatePct: number, months: number): AmortizationResult {
  const i = annualRatePct / 100 / 12;
  const installment = frenchInstallment(principal, annualRatePct, months);
  let balance = principal;
  let totalInterest = 0;
  const rows: AmortizationRow[] = [];
  for (let n = 1; n <= months; n++) {
    const interest = balance * i;
    const principalPart = n === months ? balance : installment - interest;
    balance = Math.max(0, balance - principalPart);
    totalInterest += interest;
    rows.push({ n, installment: principalPart + interest, interest, principal: principalPart, balance });
  }
  return { installment, totalInterest, totalPaid: principal + totalInterest, rows };
}

export interface EarlyRepaymentResult {
  /** Interessi risparmiati rispetto al piano senza estinzione. */
  interestSaved: number;
  penalty: number;
  /** Risparmio netto (interessi risparmiati meno la penale). */
  netSaving: number;
  /** Mesi che mancano al termine con rata invariata dopo l'estinzione parziale. */
  monthsLeftSameInstallment: number;
  /** Nuova rata se si mantiene la durata. */
  newInstallmentSameTerm: number;
}

/**
 * Estinzione parziale dopo `afterMonths` rate: confronta "stessa rata, durata più breve" e "stessa durata, rata più bassa".
 * La penale è una percentuale del capitale estinto (in Italia di norma fino all'1% sui mutui, 0 sulla prima casa).
 */
export function simulateEarlyRepayment(params: { principal: number; annualRatePct: number; months: number; afterMonths: number; extra: number; penaltyPct: number }): EarlyRepaymentResult {
  const { principal, annualRatePct, months, afterMonths, extra, penaltyPct } = params;
  const plan = buildFrenchPlan(principal, annualRatePct, months);
  const row = plan.rows[Math.min(afterMonths, months) - 1];
  const balance = row ? row.balance : principal;
  const paidExtra = Math.min(extra, balance);
  const newBalance = balance - paidExtra;
  const i = annualRatePct / 100 / 12;
  const left = months - afterMonths;
  const interestBefore = plan.rows.slice(afterMonths).reduce((s, r) => s + r.interest, 0);
  const rata = plan.installment;
  const monthsLeft = newBalance <= 0 ? 0 : i === 0 ? Math.ceil(newBalance / rata) : Math.ceil(-Math.log(1 - (newBalance * i) / rata) / Math.log(1 + i));
  const newPlan = newBalance <= 0 || monthsLeft <= 0 ? null : buildFrenchPlan(newBalance, annualRatePct, monthsLeft);
  const interestAfter = newPlan ? newPlan.totalInterest : 0;
  const penalty = (paidExtra * penaltyPct) / 100;
  return {
    interestSaved: interestBefore - interestAfter,
    penalty,
    netSaving: interestBefore - interestAfter - penalty,
    monthsLeftSameInstallment: monthsLeft,
    newInstallmentSameTerm: newBalance <= 0 || left <= 0 ? 0 : frenchInstallment(newBalance, annualRatePct, left),
  };
}
