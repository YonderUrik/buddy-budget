import * as F from "@/lib/calc/fire";
import * as M from "@/lib/calc/monte-carlo";
import { splitGrowth } from "@/lib/calc/growth-split";
import { computeLiquidation } from "@/lib/calc/liquidation";
import { summarizeCosts, costDrag } from "@/lib/calc/costs";
import { resolvePlan } from "@/lib/analitiche/plan";
import { scenarioSlider, yearsToFireWith, applyScenario } from "@/lib/analitiche/scenario";
import { buildSimulationInput } from "@/lib/analitiche/simulation";
import { DEFAULT_ASSUMPTIONS, resolveAssumptions, mergeAssumptions } from "@/lib/analitiche/assumptions";
import { resolveExpectedReturn } from "@/lib/analitiche/historical-return";
import { resolvePeriodRange, monthSpan } from "@/lib/analitiche/period";
import { writeFileSync } from "node:fs";
const out = process.argv[2];
const vectors: any[] = [];
const v = (id: string, fn: string, input: any, expected: any, tolerance: number | null = 1e-9, notes = "") => vectors.push({ id, function: fn, input, expected, tolerance, notes });

v("fireNumber-basic", "fireNumber", { annualSpending: 30000, withdrawalRate: 0.035 }, F.fireNumber(30000, 0.035));
v("fireNumber-4pct", "fireNumber", { annualSpending: 24000, withdrawalRate: 0.04 }, F.fireNumber(24000, 0.04));
v("fireNumber-zeroRate", "fireNumber", { annualSpending: 24000, withdrawalRate: 0 }, F.fireNumber(24000, 0), 0);
v("fireNumber-negSpend", "fireNumber", { annualSpending: -1, withdrawalRate: 0.04 }, F.fireNumber(-1, 0.04), 0);
v("fireNumberAfterTax-10pct", "fireNumberAfterTax", { grossNumber: 857142.857142857, taxShare: 0.1 }, F.fireNumberAfterTax(857142.857142857, 0.1));
v("fireNumberAfterTax-0", "fireNumberAfterTax", { grossNumber: 600000, taxShare: 0 }, F.fireNumberAfterTax(600000, 0));
v("fireNumberAfterTax-1", "fireNumberAfterTax", { grossNumber: 600000, taxShare: 1 }, F.fireNumberAfterTax(600000, 1), 0);
for (const [g, y] of [[{ current: 50000, annualSaving: 12000, realReturn: 0.04 }, 10], [{ current: 50000, annualSaving: 12000, realReturn: 0 }, 10], [{ current: 50000, annualSaving: 12000, realReturn: 0.04 }, 0], [{ current: 100000, annualSaving: -5000, realReturn: -0.02 }, 5]] as const)
  v(`wealthAfterYears-${g.realReturn}-${y}-${g.annualSaving}`, "wealthAfterYears", { input: g, years: y }, F.wealthAfterYears(g, y), 1e-6);
const ytt: [any, number, string][] = [
  [{ current: 50000, annualSaving: 12000, realReturn: 0.04 }, 857142.857142857, "closed form ln"],
  [{ current: 50000, annualSaving: 12000, realReturn: 0 }, 650000, "zero return: linear"],
  [{ current: 900000, annualSaving: 0, realReturn: 0.04 }, 857142.857142857, "already there → 0"],
  [{ current: 10000, annualSaving: 0, realReturn: 0 }, 650000, "never → null"],
  [{ current: 1000, annualSaving: 100, realReturn: 0.01 }, 10000000, "beyond 80 years → null"],
  [{ current: 100000, annualSaving: -2000, realReturn: 0.03 }, 200000, "negative saving but bottom>0"],
];
ytt.forEach(([g, t, n], i) => v(`yearsToTarget-${i}`, "yearsToTarget", { input: g, target: t }, F.yearsToTarget(g, t), 1e-9, n));
for (const [t, r, y] of [[857142.857142857, 0.04, 10], [857142.857142857, 0.04, 30], [500000, 0, 20], [500000, 0.04, 0]]) v(`coastNumber-${r}-${y}`, "coastNumber", { target: t, realReturn: r, years: y }, F.coastNumber(t, r, y), 1e-6);
v("leanSpending", "leanSpending", { dovuta: 15000, saltuaria: 2500 }, F.leanSpending({ dovuta: 15000, saltuaria: 2500 }), 0);
const sp = { annualSpending: 30000, current: 150000, annualSaving: 15000, withdrawalRates: [0.025, 0.03, 0.035, 0.04, 0.045], realReturns: [0.02, 0.03, 0.04, 0.05, 0.06] };
v("sensitivityByRateAndReturn", "sensitivityByRateAndReturn", sp, F.sensitivityByRateAndReturn(sp), 1e-9, "FIRE tab: rows = withdrawalRate + [-0.01,-0.005,0,0.005,0.01] (each max 0.01); cols = expectedReturn + [-0.02..0.02]");
const ss = { annualSpending: 30000, withdrawalRate: 0.035, realReturn: 0.04, current: 150000, annualSaving: 15000, spendingChanges: [-0.2, -0.1, 0, 0.1, 0.2], savingChanges: [-0.2, -0.1, 0, 0.1, 0.2] };
v("sensitivityBySpendingAndSaving", "sensitivityBySpendingAndSaving", ss, F.sensitivityBySpendingAndSaving(ss), 1e-9, "saving = annualSaving*(1+savingChange) - (spending - annualSpending)");
v("savingsRate", "savingsRate", { income: 40000, expenses: 30000 }, F.savingsRate(40000, 30000));
v("savingsRate-null", "savingsRate", { income: 0, expenses: 30000 }, F.savingsRate(0, 30000), 0);
v("monthsOfCoverage", "monthsOfCoverage", { amount: 15000, monthlySpending: 2500 }, F.monthsOfCoverage(15000, 2500));

// PRNG
const r1 = M.mulberry32(1); v("mulberry32-seed1-first10", "mulberry32", { seed: 1, draws: 10 }, Array.from({ length: 10 }, () => r1()), 0, "Exact: pure 32-bit integer arithmetic then /2^32. Must match bit-for-bit.");
const r2 = M.mulberry32(42); v("mulberry32-seed42-first5", "mulberry32", { seed: 42, draws: 5 }, Array.from({ length: 5 }, () => r2()), 0);
const r3 = M.mulberry32(0xffffffff); v("mulberry32-seedMax-first3", "mulberry32", { seed: 4294967295, draws: 3 }, Array.from({ length: 3 }, () => r3()), 0);
const pathSeeds = [0, 1, 2, 2999].map((i) => (Math.imul(1 ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(i + 1, 0xc2b2ae35)) >>> 0);
v("pathSeed-seed1", "pathSeed (private)", { seed: 1, indices: [0, 1, 2, 2999] }, pathSeeds, 0, "pathSeed(seed,i) = (imul(seed ^ 0x9e3779b9, 0x85ebca6b) + imul(i+1, 0xc2b2ae35)) >>> 0. Note: the + of two signed int32 happens in double precision, then >>> 0 (ToUint32 of the double sum, i.e. modulo 2^32).");
const g1 = M.mulberry32(pathSeeds[0]); v("gaussian-path0-first6", "gaussian", { generator: "mulberry32(pathSeed(1,0))", draws: 6 }, Array.from({ length: 6 }, () => M.gaussian(g1)), 1e-15, "Box-Muller cos branch, consumes 2 uniforms per normal; log/cos may differ by 1 ulp across libm");
v("lognormalParams-4-15", "lognormalParams", { expectedReturn: 0.04, volatility: 0.15 }, M.lognormalParams(0.04, 0.15));
v("lognormalParams-4-12", "lognormalParams", { expectedReturn: 0.04, volatility: 0.12 }, M.lognormalParams(0.04, 0.12));
v("lognormalParams-0vol", "lognormalParams", { expectedReturn: 0.03, volatility: 0 }, M.lognormalParams(0.03, 0));
v("percentile", "percentile", { sorted: [1, 2, 3, 4, 10], p: [0, 10, 25, 50, 90, 100, 150] }, [0, 10, 25, 50, 90, 100, 150].map((p) => M.percentile([1, 2, 3, 4, 10], p)), 1e-12);
v("percentile-empty", "percentile", { sorted: [], p: 50 }, M.percentile([], 50), 0);

const mcBase = { startingWealth: 500000, annualSavings: 0, accumulationYears: 0, retirementYears: 30, annualSpending: 20000, expectedReturn: 0.04, volatility: 0.12, inflation: 0.02, paths: 200, seed: 1 };
for (const rule of M.WITHDRAWAL_RULES) {
  const r = M.runMonteCarlo({ ...mcBase, rule });
  v(`runMonteCarlo-${rule}-200p`, "runMonteCarlo", { ...mcBase, rule }, { successRate: r.successRate, endingWealth: r.endingWealth, maxCut: r.maxCut, wealthYear0: r.wealth[0], wealthYear10: r.wealth[10], wealthYear30: r.wealth[30], ruinByYear: r.ruinByYear, spendingYear0: r.spending[0], spendingYear29: r.spending[29] }, 1e-6, "Relative tolerance 1e-9 recommended on money values; successRate/ruinByYear must match exactly (counts/200).");
}
const acc = { startingWealth: 100000, annualSavings: 20000, accumulationYears: 10, retirementYears: 25, annualSpending: 30000, expectedReturn: 0.05, volatility: 0.15, inflation: 0.02, rule: "fissa" as const, publicPension: { annual: 10000, startsAfterYears: 5 }, paths: 100, seed: 7 };
const ra = M.runMonteCarlo(acc);
v("runMonteCarlo-accum-pension", "runMonteCarlo", acc, { successRate: ra.successRate, endingWealth: ra.endingWealth, maxCut: ra.maxCut, wealthYear10: ra.wealth[10], wealthYear35: ra.wealth[35], spendingYear4: ra.spending[4], spendingYear5: ra.spending[5] }, 1e-6);
const tiny = { startingWealth: 1000, annualSavings: 0, accumulationYears: 0, retirementYears: 3, annualSpending: 400, expectedReturn: 0.0, volatility: 0.2, rule: "fissa" as const, paths: 3, seed: 1 };
v("runMonteCarlo-tiny-full", "runMonteCarlo", tiny, M.runMonteCarlo(tiny), 1e-9, "3 paths × 3 years: full result for step-by-step debugging");
const gk = { ...tiny, rule: "guyton-klinger" as const, retirementYears: 20, annualSpending: 60, paths: 3 };
v("runMonteCarlo-gk-tiny", "runMonteCarlo", gk, { successRate: M.runMonteCarlo(gk).successRate, spending: M.runMonteCarlo(gk).spending.slice(0, 5), endingWealth: M.runMonteCarlo(gk).endingWealth }, 1e-9);
v("runMonteCarlo-clamps", "runMonteCarlo", { ...mcBase, paths: 0, retirementYears: 0.4, accumulationYears: -3, rule: "fissa" }, (() => { const r = M.runMonteCarlo({ ...mcBase, paths: 0, retirementYears: 0.4, accumulationYears: -3, rule: "fissa" }); return { paths: r.paths, wealthLen: r.wealth.length, spendingLen: r.spending.length, successRate: r.successRate }; })(), 0, "paths clamped to [1,10000]; retirementYears max(1, round); accumulation max(0, round)");
const def = M.runMonteCarlo({ ...mcBase, paths: undefined, rule: "fissa" } as any);
v("runMonteCarlo-default3000", "runMonteCarlo", { ...mcBase, paths: "default(3000)", rule: "fissa" }, { paths: def.paths, successRate: def.successRate, endingWealth: def.endingWealth }, 1e-6, "Production default path count; use as a perf + determinism check");

// growth-split, liquidation, costs
const gp = [{ month: "2025-01", netWorth: 100000, savings: 1000 }, { month: "2025-02", netWorth: 102500, savings: 1500 }, { month: "2025-03", netWorth: 101000, savings: 1200 }, { month: "2025-04", netWorth: 105000, savings: 800 }];
v("splitGrowth", "splitGrowth", { points: gp }, splitGrowth(gp));
v("splitGrowth-negative", "splitGrowth", { points: [gp[1], gp[2]] }, splitGrowth([gp[1], gp[2]]), 1e-9, "totalDelta<=0 → savingsShare null");
v("splitGrowth-single", "splitGrowth", { points: [gp[0]] }, splitGrowth([gp[0]]));
const lp = [{ id: "a", name: "ETF World", value: 50000, unrealizedGain: 10000, taxRate: 0.26 }, { id: "b", name: "BTP", value: 20000, unrealizedGain: 2000, taxRate: 0.125 }, { id: "c", name: "Stock", value: 5000, unrealizedGain: -1500, taxRate: 0.26 }];
v("computeLiquidation", "computeLiquidation", { positions: lp }, computeLiquidation(lp));
v("computeLiquidation-empty", "computeLiquidation", { positions: [] }, computeLiquidation([]));
const cp = [{ id: "a", name: "ETF", value: 50000, ter: 0.002, subjectToBollo: true }, { id: "b", name: "BTC", value: 10000, ter: null, subjectToBollo: false }, { id: "c", name: "Zero", value: 0, ter: 0.01, subjectToBollo: true }];
v("summarizeCosts-IT", "summarizeCosts", { positions: cp, productCountry: "IT" }, summarizeCosts(cp, "IT"), 1e-9, "IT bollo 0.2%/yr");
v("summarizeCosts-DE", "summarizeCosts", { positions: cp, productCountry: "DE" }, summarizeCosts(cp, "DE"), 1e-9, "DE no stamp duty");
v("costDrag", "costDrag", { value: 10000, grossReturn: 0.05, annualCostPct: 0.004, years: 3 }, costDrag(10000, 0.05, 0.004, 3), 1e-6);

// analitiche
const base: any = { currency: "EUR", wealth: { liquidity: 30000, investments: 120000, pension: 15000, debts: 0 }, cashflow: { months: [], fromKey: "2025-10-01", toKey: "2026-09-30", coveredMonths: 12, annualIncome: 45000, annualSpending: 30000, annualSavings: 15000, savingsRate: 1 / 3, leanSpending: 20000, monthsWithData: 12 }, positions: lp.map((p) => ({ ...p, ter: null, subjectToBollo: true })), growthPoints: [], risk: null, riskContribution: null, names: {}, historicalReturn: { status: "manca", reason: "nessun-investimento" } };
const plan = resolvePlan(base, DEFAULT_ASSUMPTIONS);
v("resolvePlan-defaults", "resolvePlan", { base: { wealth: base.wealth, cashflow: { annualSpending: 30000, annualSavings: 15000, monthsWithData: 12 }, positions: lp }, assumptions: "DEFAULT_ASSUMPTIONS" }, plan, 1e-6, "includeLatentTax=true → taxShare = latentTax / wealth (cap 0.99); pension excluded by default");
const a2 = { ...DEFAULT_ASSUMPTIONS, includeLatentTax: false, includePensionFunds: true, annualSpending: 24000, withdrawalRate: 0.04 };
v("resolvePlan-manual", "resolvePlan", { base: "same as resolvePlan-defaults", assumptions: { includeLatentTax: false, includePensionFunds: true, annualSpending: 24000, withdrawalRate: 0.04, expectedReturn: 0.04 } }, resolvePlan(base, a2), 1e-6);
const few = { ...base, cashflow: { ...base.cashflow, monthsWithData: 2 } };
v("resolvePlan-fewMonths", "resolvePlan", { base: "monthsWithData=2", assumptions: "DEFAULT_ASSUMPTIONS" }, (() => { const p = resolvePlan(few, DEFAULT_ASSUMPTIONS); return { spending: p.spending, spendingSource: p.spendingSource, savings: p.savings, target: p.target, yearsToFire: p.yearsToFire, coast: p.coast }; })(), 0, "Fewer than MIN_MONTHS_FOR_CASHFLOW=3 → spending/savings null ('manca')");
for (const [f, b] of [["expectedReturn", null], ["withdrawalRate", null], ["annualSpending", 30000], ["annualSpending", 3000], ["annualSavings", 15000], ["annualSavings", -4300], ["annualSavings", null]] as const)
  v(`scenarioSlider-${f}-${b}`, "scenarioSlider", { field: f, baseline: b }, scenarioSlider(f as any, b as any), 0);
v("yearsToFireWith-none", "yearsToFireWith", { plan: "resolvePlan-defaults", overrides: {} }, yearsToFireWith(plan, DEFAULT_ASSUMPTIONS, {}), 1e-9, "Equals plan.yearsToFire");
v("yearsToFireWith-savings", "yearsToFireWith", { plan: "resolvePlan-defaults", overrides: { annualSavings: 25000 } }, yearsToFireWith(plan, DEFAULT_ASSUMPTIONS, { annualSavings: 25000 }), 1e-9);
v("yearsToFireWith-all", "yearsToFireWith", { plan: "resolvePlan-defaults", overrides: { annualSavings: 20000, annualSpending: 25000, expectedReturn: 0.05, withdrawalRate: 0.04 } }, yearsToFireWith(plan, DEFAULT_ASSUMPTIONS, { annualSavings: 20000, annualSpending: 25000, expectedReturn: 0.05, withdrawalRate: 0.04 }), 1e-9, "taxShare stays from plan (not recomputed)");
v("buildSimulationInput-oggi", "buildSimulationInput", { plan: "resolvePlan-defaults", assumptions: "DEFAULT_ASSUMPTIONS", retireAt: "oggi" }, buildSimulationInput(plan, DEFAULT_ASSUMPTIONS, "oggi"), 1e-9);
v("buildSimulationInput-fire", "buildSimulationInput", { plan: "resolvePlan-defaults", assumptions: "DEFAULT_ASSUMPTIONS", retireAt: "fire" }, buildSimulationInput(plan, DEFAULT_ASSUMPTIONS, "fire"), 1e-9, "accumulationYears = min(ceil(yearsToFire), 40)");
const scen = applyScenario(DEFAULT_ASSUMPTIONS, { annualSavings: 20000 });
v("applyScenario+resolvePlan", "resolvePlan(applyScenario)", { overrides: { annualSavings: 20000 } }, (() => { const p = resolvePlan(base, scen); return { savings: p.savings, savingsSource: p.savingsSource, yearsToFire: p.yearsToFire }; })(), 1e-9);
v("resolveAssumptions-invalidField", "resolveAssumptions", { stored: { withdrawalRate: 0.5, expectedReturn: 0.05, retirementYears: 30 } }, resolveAssumptions({ withdrawalRate: 0.5, expectedReturn: 0.05, retirementYears: 30 }), 0, "invalid withdrawalRate (>0.1) falls back to default; missing expectedReturnAuto → (expectedReturn === 0.04) → false");
v("mergeAssumptions-manualReturn", "mergeAssumptions", { current: "DEFAULT_ASSUMPTIONS", update: { expectedReturn: 0.06 } }, mergeAssumptions(DEFAULT_ASSUMPTIONS, { expectedReturn: 0.06 }), 0, "Writing a return without expectedReturnAuto switches auto off");
const hist: any = { status: "ok", months: 24, shorterThanPeriod: false, fromKey: "2024-10-18", toKey: "2026-10-18", nominal: 0.09, real: null };
v("resolveExpectedReturn-history", "resolveExpectedReturn", { assumptions: "DEFAULT (auto, inflation 0.02)", history: hist }, resolveExpectedReturn(DEFAULT_ASSUMPTIONS, hist), 1e-12, "real = (1.09/1.02)-1 = 0.0686… → rounded to 3 decimals 0.069 ; high = value > 0.08");
v("resolveExpectedReturn-clamped", "resolveExpectedReturn", { assumptions: "DEFAULT", history: { ...hist, real: 0.7 } }, resolveExpectedReturn(DEFAULT_ASSUMPTIONS, { ...hist, real: 0.7 }), 1e-12);
v("resolveExpectedReturn-missing", "resolveExpectedReturn", { assumptions: "DEFAULT", history: { status: "manca", reason: "storico-breve" } }, resolveExpectedReturn(DEFAULT_ASSUMPTIONS, { status: "manca", reason: "storico-breve" }), 0);
v("resolveExpectedReturn-manual", "resolveExpectedReturn", { assumptions: { expectedReturnAuto: false, expectedReturn: 0.03 }, history: hist }, resolveExpectedReturn({ ...DEFAULT_ASSUMPTIONS, expectedReturnAuto: false, expectedReturn: 0.03 }, hist), 1e-12);
const today = new Date(2026, 9, 18);
const pr = (p: any) => { const r = resolvePeriodRange(p, today); return { from: r.from.toISOString().slice(0, 10), to: r.to.toISOString().slice(0, 10), months: r.months }; };
// toISOString can shift in local tz; use local formatting instead
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const pr2 = (p: any) => { const r = resolvePeriodRange(p, today); return { from: fmt(r.from), to: fmt(r.to), months: r.months }; };
v("resolvePeriodRange-12", "resolvePeriodRange", { period: { kind: "ultimi", months: 12 }, today: "2026-10-18" }, pr2({ kind: "ultimi", months: 12 }), 0, "Local dates; current month never counts");
v("resolvePeriodRange-24", "resolvePeriodRange", { period: { kind: "ultimi", months: 24 }, today: "2026-10-18" }, pr2({ kind: "ultimi", months: 24 }), 0);
v("resolvePeriodRange-custom-clip", "resolvePeriodRange", { period: { kind: "personalizzato", from: "2026-01", to: "2026-12" }, today: "2026-10-18" }, pr2({ kind: "personalizzato", from: "2026-01", to: "2026-12" }), 0, "to clipped at end of last full month");
v("monthSpan", "monthSpan", { from: "2025-11", to: "2026-02" }, monthSpan("2025-11", "2026-02"), 0);
writeFileSync(out, JSON.stringify({ topic: "fire-and-simulations", source: "lib/calc/fire.ts, lib/calc/monte-carlo.ts, lib/calc/growth-split.ts, lib/calc/liquidation.ts, lib/calc/costs.ts, lib/analitiche/*", generatedWith: "npx tsx (Node, V8 doubles)", vectors }, null, 2));
console.log(vectors.length);
