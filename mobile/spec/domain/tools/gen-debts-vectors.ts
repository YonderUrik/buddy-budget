import * as A from "@/lib/calc/amortization";
import { buildLoanPlan } from "@/lib/calc/debt-plan";
import { compareEarlyRepayment, simulateRecurringExtra } from "@/lib/calc/early-repayment";
import { compareRefinance, simulatePayoff, comparePayoffStrategies } from "@/lib/calc/debt-simulator";
import { parseAmount, resolveAddForm, previewAddForm, emptyAddDebtForm, buildCreateDebtInput } from "@/lib/debts/add-form";
import { resolvePenalty } from "@/lib/debts/early-repayment-form";
import { addDaysIso, todayIso } from "@/lib/debts/dates";
import { buildDebtsView } from "@/lib/debts/view";
import { yearlyInterestShares, buildExitPlan } from "@/lib/debts/overview-insights";
import { writeFileSync } from "fs";

const V: any[] = [];
function v(id: string, fn: string, input: any, run: () => any, tolerance: number | null = 1e-9, notes?: string) {
  let expected: any;
  try { expected = run(); } catch (e: any) { expected = { error: e.constructor.name, message: e.message }; }
  V.push({ id, function: fn, input, expected, tolerance, ...(notes ? { notes } : {}) });
}
// round2
for (const x of [1.005, 2.675, -1.005, 0.125, 1234.5649]) v(`round2.${x}`, "round2", { value: x }, () => A.round2(x), 0, "Math.round((x + Number.EPSILON) * 100) / 100 — half-up toward +inf (JS Math.round)");
// installmentAmount
const ia = [[10000, 6.5, 60], [200000, 3.2, 360], [1200, 0, 12], [1000, 0, 7], [15000, 9.9, 48]] as const;
for (const [p, r, n] of ia) v(`installmentAmount.${p}_${r}_${n}`, "installmentAmount", { principal: p, annualRate: r, installments: n }, () => A.installmentAmount(p, r, n), 0);
v("installmentAmount.error.zeroPrincipal", "installmentAmount", { principal: 0, annualRate: 5, installments: 10 }, () => A.installmentAmount(0, 5, 10), null);
// addMonthsClamped
const am: [string, number, number?][] = [["2024-01-31", 1], ["2024-01-31", 2], ["2023-01-31", 1], ["2024-02-29", 1, 31], ["2024-03-15", -3], ["2024-11-30", 3]];
for (const [d, m, a] of am) v(`addMonthsClamped.${d}_${m}_${a ?? "none"}`, "addMonthsClamped", { date: d, months: m, anchorDay: a ?? null }, () => A.addMonthsClamped(d, m, a), 0);
// buildSegmentSchedule
const s1 = { firstDueDate: "2024-01-31", principal: 1000, annualRate: 12, installments: 4 };
v("buildSegmentSchedule.short_eom", "buildSegmentSchedule", s1, () => A.buildSegmentSchedule(s1), 0, "anchor day 31 clamps to Feb 29 then returns to 31");
const s2 = { firstDueDate: "2025-03-10", principal: 1000, annualRate: 0, installments: 3 };
v("buildSegmentSchedule.zeroRate_lastAbsorbs", "buildSegmentSchedule", s2, () => A.buildSegmentSchedule(s2), 0, "333.33 x2 then last 333.34");
const s3 = { firstDueDate: "2025-01-15", principal: 5000, annualRate: 5, installments: 6, installment: 900, firstNumber: 4 };
v("buildSegmentSchedule.declaredInstallment_firstNumber", "buildSegmentSchedule", s3, () => A.buildSegmentSchedule(s3), 0, "declared installment higher than computed: last row absorbs the residual (smaller)");
const s4 = { firstDueDate: "2025-01-15", principal: 10000, annualRate: 6.5, installments: 60 };
v("buildSegmentSchedule.60_summary", "buildSegmentSchedule(summary)", s4, () => { const r = A.buildSegmentSchedule(s4); return { first: r[0], second: r[1], last: r[r.length - 1], totalInterest: A.round2(r.reduce((s, x) => s + x.interest, 0)), rows: r.length }; }, 0);
const s5 = { firstDueDate: "2025-01-15", principal: 1000, annualRate: 0, installments: 4, installment: 600 };
v("buildSegmentSchedule.declaredTooHigh_quirk", "buildSegmentSchedule", s5, () => A.buildSegmentSchedule(s5), 0, "non-last rows keep the declared installment after residual reaches 0; last row 0");
// solveAnnualRate
for (const inp of [{ principal: 10000, installment: 195.66, installments: 60 }, { principal: 1200, installment: 100, installments: 12 }, { principal: 20000, installment: 400, installments: 60 }])
  v(`solveAnnualRate.${inp.principal}_${inp.installment}_${inp.installments}`, "solveAnnualRate", inp, () => A.solveAnnualRate(inp), 1e-5, "bisection on [0,100] with tol 1e-12 on annual % (max 200 iterations)");
v("solveAnnualRate.error.tooLow", "solveAnnualRate", { principal: 10000, installment: 100, installments: 60 }, () => A.solveAnnualRate({ principal: 10000, installment: 100, installments: 60 }), null);
// solveInstallments
for (const inp of [{ principal: 10000, annualRate: 6.5, installment: 195.66 }, { principal: 10000, annualRate: 6.5, installment: 300 }, { principal: 1000, annualRate: 0, installment: 300 }, { principal: 1000, annualRate: 0, installment: 101 }])
  v(`solveInstallments.${inp.principal}_${inp.annualRate}_${inp.installment}`, "solveInstallments", inp, () => A.solveInstallments(inp), 0);
v("solveInstallments.error.interestOnly", "solveInstallments", { principal: 10000, annualRate: 12, installment: 100 }, () => A.solveInstallments({ principal: 10000, annualRate: 12, installment: 100 }), null);
// solvePrincipal
for (const inp of [{ annualRate: 6.5, installment: 195.66, installments: 60 }, { annualRate: 0, installment: 100, installments: 12 }, { annualRate: 3.2, installment: 864.93, installments: 360 }])
  v(`solvePrincipal.${inp.annualRate}_${inp.installment}_${inp.installments}`, "solvePrincipal", inp, () => A.solvePrincipal(inp), 0);
// computeApr
for (const inp of [{ principal: 10000, upfrontCosts: 0, installment: 195.66, recurringCosts: 0, installments: 60 },
  { principal: 10000, upfrontCosts: 300, installment: 195.66, recurringCosts: 2.5, installments: 60 },
  { principal: 1200, upfrontCosts: 0, installment: 100, recurringCosts: 0, installments: 12 },
  { principal: 1200, upfrontCosts: 50, installment: 100, recurringCosts: 0, installments: 12 }])
  v(`computeApr.${inp.principal}_${inp.upfrontCosts}_${inp.recurringCosts}`, "computeApr", inp, () => A.computeApr(inp), 1e-6, "TAEG = ((1+i)^12 - 1)*100, i by bisection on [0,1]");
// resolveMissingLoanInput
for (const inp of [{ principal: 10000, annualRate: 6.5, installments: 60 }, { principal: 10000, annualRate: 6.5, installment: 195.66 }, { annualRate: 6.5, installment: 195.66, installments: 60 }, { principal: 10000, installment: 195.66, installments: 60 }, { principal: 10000 }])
  v(`resolveMissingLoanInput.${Object.keys(inp).join("+")}`, "resolveMissingLoanInput", inp, () => A.resolveMissingLoanInput(inp as any), 1e-6);
// parseAmount
for (const t of ["1.250,50", "6,9", "1250.5", "", "abc", " 12 ", "1.250"]) v(`parseAmount.${JSON.stringify(t)}`, "parseAmount", { text: t }, () => parseAmount(t) ?? null, 0, "undefined is serialized as null");
// resolvePenalty
for (const [a, t, u] of [[5000, "1", "percent"], [5000, "150", "eur"], [5000, "", "eur"], [3333, "0,5", "percent"], [5000, "-1", "eur"]] as const)
  v(`resolvePenalty.${a}_${t}_${u}`, "resolvePenalty", { amount: a, text: t, unit: u }, () => resolvePenalty(a, t, u) ?? null, 0);
// resolveAddForm / preview
const f1 = { ...emptyAddDebtForm("nuovo"), name: "Auto", principal: "10000", annualRate: "6,5", installments: "60", firstInstallmentDate: "2025-01-31" };
v("addForm.missingInstallment", "resolveAddForm+previewAddForm", f1, () => { const r = resolveAddForm(f1); return { resolution: r, preview: r.ok ? previewAddForm(f1, r.value) : null, createInput: r.ok ? buildCreateDebtInput(f1, r.value, "2025-01-01") : null }; }, 1e-6);
const f2 = { ...emptyAddDebtForm("origine"), name: "Prestito", principal: "10000", installment: "195,66", installments: "60", firstInstallmentDate: "2023-05-05", costs: [{ label: "Istruttoria", amount: "300", kind: "una_tantum" as const }, { label: "Incasso", amount: "2,5", kind: "per_rata" as const }] };
v("addForm.missingRate_withCosts", "resolveAddForm+previewAddForm", f2, () => { const r = resolveAddForm(f2); return { resolution: r, preview: r.ok ? previewAddForm(f2, r.value) : null, createInput: r.ok ? buildCreateDebtInput(f2, r.value, "2025-01-01") : null }; }, 1e-6);
const f3 = { ...emptyAddDebtForm("fotografia"), name: "Mutuo", principal: "150000", installment: "800", annualRate: "3", firstInstallmentDate: "2025-02-28" };
v("addForm.fotografia_missingInstallments", "resolveAddForm+previewAddForm", f3, () => { const r = resolveAddForm(f3); return { resolution: r, preview: r.ok ? previewAddForm(f3, r.value) : null, createInput: r.ok ? buildCreateDebtInput(f3, r.value, "2025-01-10") : null }; }, 1e-6, "fotografia → apr null, anchorDate = today");
const f4 = { ...emptyAddDebtForm("nuovo"), principal: "10000", installments: "60,5", annualRate: "5" };
v("addForm.nonIntegerInstallments", "resolveAddForm", f4, () => resolveAddForm(f4), 0);
const f5 = { ...emptyAddDebtForm("nuovo"), principal: "10000", annualRate: "5" };
v("addForm.tooFewFields", "resolveAddForm", f5, () => resolveAddForm(f5), 0);

// buildLoanPlan
const terms = { startMode: "nuovo" as const, principal: 12000, annualRate: 6, installments: 12, firstInstallmentDate: "2025-01-31", installment: null };
const strip = (p: any) => ({ ...p, rows: p.rows.map((r: any) => ({ n: r.number, d: r.dueDate, i: r.installment, int: r.interest, c: r.capital, res: r.residual, s: r.status, paid: r.payment?.amount ?? null })) });
v("buildLoanPlan.basic_noEvents", "buildLoanPlan", { terms, events: [], today: "2025-04-15" }, () => strip(buildLoanPlan(terms, [], "2025-04-15")), 0, "rows compacted: n=number d=dueDate i=installment int=interest c=capital res=residual s=status paid=payment.amount");
const ev2 = [{ type: "payment", installmentNumber: 1, date: "2025-01-31", amount: 1032.8 }, { type: "payment", installmentNumber: 2, date: "2025-03-01", amount: 1032.8 }] as any[];
const tOr = { ...terms, startMode: "origine" as const };
v("buildLoanPlan.origine_payments_statuses", "buildLoanPlan", { terms: tOr, events: ev2, today: "2025-05-31" }, () => strip(buildLoanPlan(tOr, ev2, "2025-05-31")), 0, "rows 3-4 past & unpaid → da_confermare (origine); row 5 due today → da_pagare but counted as past in totals");
const ev3 = [{ type: "rate_change", date: "2025-03-15", rate: 3 }, { type: "payment", installmentNumber: 99, date: "2025-01-01", amount: 1 }] as any[];
v("buildLoanPlan.rateChange_warning", "buildLoanPlan", { terms, events: ev3, today: "2025-02-10" }, () => strip(buildLoanPlan(terms, ev3, "2025-02-10")), 0, "nuovo: past unpaid → scaduta");
const ev4 = [{ type: "balance_correction", date: "2025-06-01", amount: 5000 }] as any[];
v("buildLoanPlan.balanceCorrection", "buildLoanPlan", { terms, events: ev4, today: "2025-06-01" }, () => strip(buildLoanPlan(terms, ev4, "2025-06-01")), 0);
const ev5 = [{ type: "early_repayment", date: "2025-04-10", amount: 20000, penalty: 50, effect: "reduce_duration" }] as any[];
v("buildLoanPlan.earlyRepayment_closes", "buildLoanPlan", { terms, events: ev5, today: "2025-05-01" }, () => strip(buildLoanPlan(terms, ev5, "2025-05-01")), 0, "amount ≥ residual closes the debt; repayment amount is clamped to the residual");

// compareEarlyRepayment
const t2 = { startMode: "nuovo" as const, principal: 20000, annualRate: 5, installments: 48, firstInstallmentDate: "2025-01-15", installment: null };
for (const [d, a, p] of [["2025-06-20", 5000, 0], ["2026-01-10", 2000, 20], ["2025-03-01", 25000, 100]] as const)
  v(`compareEarlyRepayment.${d}_${a}_${p}`, "compareEarlyRepayment", { terms: t2, events: [], today: "2025-02-01", input: { date: d, amount: a, penalty: p } }, () => { const c = compareEarlyRepayment(t2, [], "2025-02-01", { date: d, amount: a, penalty: p }); const o = (x: any) => { const { plan, ...rest } = x; return rest; }; return { ...c, reduceInstallment: o(c.reduceInstallment), reduceDuration: o(c.reduceDuration) }; }, 0, "plan omitted from expected (re-derivable via buildLoanPlan)");
// simulateRecurringExtra
for (const [x, today] of [[100, "2025-02-01"], [500, "2025-02-01"], [50, "2027-06-01"]] as const)
  v(`simulateRecurringExtra.${x}_${today}`, "simulateRecurringExtra", { terms: t2, events: [], today, monthlyExtra: x }, () => simulateRecurringExtra(t2, [], today, x), 0);

// compareRefinance
const cur = { residual: 150000, currentInstallment: 900, interestRemaining: 60000, endDate: "2045-01-01" };
for (const offer of [{ annualRate: 2.5, installments: 240, upfrontCosts: 1500, penalty: 0 }, { annualRate: 4, installments: 300, upfrontCosts: 0, penalty: 0 }, { annualRate: 0, installments: 120, upfrontCosts: 500, penalty: 500 }, { annualRate: 6, installments: 240, upfrontCosts: 2000, penalty: 1000 }])
  v(`compareRefinance.${offer.annualRate}_${offer.installments}_${offer.upfrontCosts}_${offer.penalty}`, "compareRefinance", { current: cur, today: "2025-01-31", offer }, () => compareRefinance(cur, "2025-01-31", offer), 0);
// simulatePayoff / compare
const single = [{ id: "a", name: "Auto", residual: 8000, annualRate: 7, installment: 250 }];
v("simulatePayoff.single_none", "simulatePayoff", { loans: single, monthlyExtra: 0, strategy: "none", today: "2025-01-31" }, () => simulatePayoff(single, 0, "none", "2025-01-31"), 0);
v("simulatePayoff.single_extra200", "simulatePayoff", { loans: single, monthlyExtra: 200, strategy: "avalanche", today: "2025-01-31" }, () => simulatePayoff(single, 200, "avalanche", "2025-01-31"), 0, "same call as DebtExtraSim slider default (200)");
const multi = [{ id: "a", name: "Auto", residual: 8000, annualRate: 7, installment: 250 }, { id: "c", name: "Carta", residual: 2000, annualRate: 18, installment: 100 }, { id: "m", name: "Mobili", residual: 1500, annualRate: 0, installment: 125 }];
v("comparePayoffStrategies.three_loans_extra150", "comparePayoffStrategies", { loans: multi, monthlyExtra: 150, today: "2025-01-31" }, () => comparePayoffStrategies(multi, 150, "2025-01-31"), 0);
const stuck = [{ id: "x", name: "Stuck", residual: 10000, annualRate: 12, installment: 90 }];
v("simulatePayoff.neverCloses_cap600", "simulatePayoff", { loans: stuck, monthlyExtra: 0, strategy: "none", today: "2025-01-31" }, () => simulatePayoff(stuck, 0, "none", "2025-01-31"), 0, "stops at MAX_PAYOFF_MONTHS=600");

// buildDebtsView + insights
const debtRow = (id: string, over: any) => ({ id, userId: "u", kind: "loan", name: id, startMode: "nuovo", principal: "12000.00", annualRate: "6.0000", installments: 12, firstInstallmentDate: "2025-01-31", installment: null, anchorDate: null, costs: [], createdAt: new Date(0), updatedAt: new Date(0), ...over });
const debtsIn = [debtRow("auto", {}), debtRow("tv", { principal: "1200.00", annualRate: "0", installments: 12, firstInstallmentDate: "2025-03-10", costs: [{ label: "Istruttoria", amount: 30, kind: "una_tantum" }] })];
const evIn = [{ id: "e1", debtId: "auto", userId: "u", type: "payment", date: "2025-01-31", amount: "1032.80", installmentNumber: 1, rate: null, penalty: null, effect: null, transactionId: null, note: null, createdAt: new Date(0) }];
v("buildDebtsView.overview", "buildDebtsView(overview + apr)", { debts: debtsIn, events: evIn, today: "2025-04-01" }, () => { const r = buildDebtsView(debtsIn as any, evIn as any, "2025-04-01"); return { overview: r.overview, aprs: r.debts.map((d) => ({ id: d.id, apr: d.apr })) }; }, 1e-6, "DB numeric columns arrive as strings");
v("yearlyInterestShares.basic", "yearlyInterestShares", { debts: "buildDebtsView(debts above, today 2025-04-01).debts" }, () => yearlyInterestShares(buildDebtsView(debtsIn as any, evIn as any, "2025-04-01").debts), 1e-9);
v("buildExitPlan.extra200", "buildExitPlan", { debts: "buildDebtsView(debts above, today 2025-04-01).debts", monthlyExtra: 200, today: "2025-04-01" }, () => buildExitPlan(buildDebtsView(debtsIn as any, evIn as any, "2025-04-01").debts, 200, "2025-04-01"), 1e-9);
// dates
v("addDaysIso.leap", "addDaysIso", { isoDate: "2024-02-28", days: 1 }, () => addDaysIso("2024-02-28", 1), 0);
v("addDaysIso.negative", "addDaysIso", { isoDate: "2025-03-01", days: -1 }, () => addDaysIso("2025-03-01", -1), 0);
v("todayIso.utc", "todayIso", { now: "2025-06-30T23:30:00+02:00" }, () => todayIso(new Date("2025-06-30T23:30:00+02:00")), 0, "UTC date, not local");

writeFileSync(process.argv[2], JSON.stringify({ topic: "debts", source: "lib/calc/amortization.ts, lib/calc/debt-plan.ts, lib/calc/early-repayment.ts, lib/calc/debt-simulator.ts, lib/debts/*.ts", generatedBy: "running the TypeScript sources with tsx", vectors: V }, null, 2));
console.log(V.length);
