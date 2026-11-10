import * as E from "@/lib/calc/expenses";
import * as C from "@/lib/calc/cashflow";
import * as M from "@/lib/calc/movements";
import { computeMonthPace } from "@/lib/calc/month-pace";
import * as N from "@/lib/calc/net-worth";
import * as S from "@/lib/liquidity/split";
import { buildCumulativeSpend } from "@/lib/liquidity/spend-curve";
import { buildAccountBalanceSeries } from "@/lib/liquidity/account-series";
import { groupByDay, dayLabel } from "@/lib/liquidity/day-groups";
import { computeConnectionHealth } from "@/lib/gocardless/connection-health";
import { buildVoiceLines } from "@/lib/overview/voice";
import { writeFileSync } from "node:fs";
const OUT = process.argv[2];
const d = (s: string) => E.parseDateOnly(s);
const k = (x: Date) => N.toDateKey(x);
const rk = (r: E.DateRange) => ({ from: k(r.from), to: k(r.to) });
let n = 0;
const tx = (date: string, amount: number, categoryId = "food", excluded = 0, accountId = "acc1", description = "TX", note: string | null = null): any =>
  ({ id: `t${++n}`, date, amount: amount.toFixed(2), excludedAmount: excluded.toFixed(2), categoryId, accountId, description, note });
const cats: any[] = [
  { id: "food", name: "Spesa", type: "dovuta", isFallback: false, color: "green", icon: "shopping-cart" },
  { id: "fun", name: "Svago", type: "voluta", isFallback: false, color: "violet", icon: "film" },
  { id: "save", name: "Risparmio", type: "futuro", isFallback: false, color: "blue", icon: "piggy-bank" },
  { id: "gift", name: "Regali", type: "saltuaria", isFallback: false, color: "pink", icon: "gift" },
  { id: "salary", name: "Stipendio", type: "entrata", isFallback: false, color: "emerald", icon: "briefcase" },
  { id: "xfer", name: "Giroconti", type: "trasferimento", isFallback: false, color: "slate", icon: "arrow-left-right" },
  { id: "unc", name: "Da categorizzare", type: "voluta", isFallback: true, color: "slate", icon: "help-circle" },
];
const strip = (t: any) => ({ id: t.id, date: t.date, amount: t.amount, excludedAmount: t.excludedAmount, categoryId: t.categoryId, accountId: t.accountId, description: t.description, note: t.note });
const txs = [
  tx("2026-08-03", 2500, "salary"), tx("2026-08-05", -80, "food"), tx("2026-08-12", -120, "fun", -60), tx("2026-08-20", -300, "save"),
  tx("2026-09-01", 2500, "salary"), tx("2026-09-02", -90.5, "food"), tx("2026-09-10", -40, "unc"), tx("2026-09-15", -500, "xfer", -500), tx("2026-09-28", -200, "gift"),
  tx("2026-10-01", 2600, "salary"), tx("2026-10-03", -55.25, "food"), tx("2026-10-08", -30, "fun"), tx("2026-10-10", -100, "fun", -50), tx("2026-10-14", 20, "food"),
  tx("2026-10-16", -12.3, "food"),
];
const budgets: any[] = [{ categoryId: "food", monthlyAmount: "300.00" }, { categoryId: "fun", monthlyAmount: "150.00" }];
const fixtures = { categories: cats, budgets, transactions: txs.map(strip) };
const V: any[] = [];
const add = (id: string, fn: string, input: any, expected: any, notes = "") => V.push({ id, function: fn, input, expected, tolerance: 1e-9, ...(notes ? { notes } : {}) });

// periods
for (const [p, ref] of [["settimana","2026-10-14"],["settimana","2026-11-01"],["mese","2026-02-15"],["3mesi","2026-01-31"],["anno","2026-06-30"]] as const)
  add(`expenses.periodRange.${p}.${ref}`, "getPeriodRange", { period: p, referenceDate: ref }, rk(E.getPeriodRange(p, d(ref))));
for (const [p, ref] of [["settimana","2026-10-14"],["mese","2026-03-31"],["mese","2026-03-15"],["3mesi","2026-05-31"],["anno","2024-02-29"]] as const)
  add(`expenses.previousPeriodRange.${p}.${ref}`, "getPreviousPeriodRange", { period: p, referenceDate: ref }, rk(E.getPreviousPeriodRange(p, d(ref))), ref === "2026-03-31" && p === "mese" ? "QUIRK: addMonths overflows (31 Mar - 1 month = 3 Mar) so the 'previous month' of 31 March is March itself. Port as-is or fix on web too." : "");
for (const [p, ref, dir] of [["mese","2026-01-31",1],["settimana","2026-10-14",-1],["3mesi","2026-11-30",1],["anno","2024-02-29",1]] as const)
  add(`expenses.shiftReference.${p}.${ref}.${dir}`, "shiftReferenceDate", { period: p, referenceDate: ref, direction: dir }, k(E.shiftReferenceDate(p, d(ref), dir as 1|-1)));
for (const loc of ["it-IT","en-GB","de-DE"]) for (const [p, ref] of [["mese","2026-10-14"],["settimana","2026-10-14"],["settimana","2026-09-30"],["settimana","2025-12-31"],["3mesi","2026-01-15"],["3mesi","2026-10-15"],["anno","2026-10-14"]] as const)
  add(`expenses.periodLabel.${loc}.${p}.${ref}`, "formatPeriodLabel", { period: p, referenceDate: ref, locale: loc }, E.formatPeriodLabel(p, E.getPeriodRange(p, d(ref)), loc), "range = getPeriodRange(period, referenceDate); en dash U+2013");
for (const [p] of [["settimana"],["mese"],["3mesi"],["anno"]] as const) add(`expenses.scaleBudget.${p}`, "scaleBudgetForPeriod", { monthlyTotal: 450, period: p }, E.scaleBudgetForPeriod(450, p));
add("expenses.summary.oct", "computeSummary", { fixture: "transactions", range: { from: "2026-10-01", to: "2026-10-31" } }, E.computeSummary(txs, { from: d("2026-10-01"), to: d("2026-10-31") }));
add("expenses.summary.sep", "computeSummary", { fixture: "transactions", range: { from: "2026-09-01", to: "2026-09-30" } }, E.computeSummary(txs, { from: d("2026-09-01"), to: d("2026-09-30") }), "transfer (xfer) has excludedAmount = amount so it nets to 0");
add("expenses.incomeSummary.oct", "computeIncomeSummary", { fixture: "transactions", range: { from: "2026-10-01", to: "2026-10-31" } }, E.computeIncomeSummary(txs, { from: d("2026-10-01"), to: d("2026-10-31") }), "refund +20 on 'food' counts as income");
for (const [p, ref, today] of [["mese","2026-10-16","2026-10-16"],["mese","2026-09-10","2026-10-16"],["settimana","2026-10-14","2026-10-14"],["3mesi","2026-10-16","2026-10-16"],["anno","2026-10-16","2026-10-16"]] as const)
  add(`expenses.kpis.${p}.${ref}.${today}`, "computeKpis", { fixture: "transactions+budgets", period: p, referenceDate: ref, today }, E.computeKpis(txs, budgets, p, d(ref), d(today)));
add("expenses.kpis.noBudgets", "computeKpis", { fixture: "transactions", budgets: [], period: "mese", referenceDate: "2026-10-16", today: "2026-10-16" }, E.computeKpis(txs, [], "mese", d("2026-10-16"), d("2026-10-16")));
add("expenses.incomeKpis.mese", "computeIncomeKpis", { fixture: "transactions", period: "mese", referenceDate: "2026-10-16", today: "2026-10-16" }, E.computeIncomeKpis(txs, "mese", d("2026-10-16"), d("2026-10-16")));
add("expenses.categoryBreakdown.oct", "computeCategoryBreakdown", { fixture: "transactions+categories", period: "mese", referenceDate: "2026-10-16", today: "2026-10-16" }, E.computeCategoryBreakdown(txs, cats, "mese", d("2026-10-16"), d("2026-10-16")));
add("expenses.groupTotals.sep", "computeGroupTotals", { fixture: "transactions+categories", period: "mese", referenceDate: "2026-09-15", today: "2026-10-16" }, E.computeGroupTotals(txs, cats, "mese", d("2026-09-15"), d("2026-10-16")));
add("expenses.trend6", "compute6MonthTrend", { fixture: "transactions", referenceDate: "2026-10-16" }, E.compute6MonthTrend(txs, d("2026-10-16")), "month is 0-based (JS getMonth)");
add("expenses.monthlyStacks.top1", "computeCategoryMonthlyStacks", { fixture: "transactions+categories", referenceDate: "2026-10-16", topCount: 1, monthCount: 3 }, E.computeCategoryMonthlyStacks(txs, cats, d("2026-10-16"), 1, 3));
add("expenses.filter.search", "filterTransactions", { fixture: "transactions", filter: { categoryId: null, searchText: "  tx ", accountId: null } }, E.filterTransactions(txs, { categoryId: null, searchText: "  tx ", accountId: null }).length, "expected = count");
add("expenses.filter.category", "filterTransactions", { fixture: "transactions", filter: { categoryId: "fun", searchText: "" } }, E.filterTransactions(txs, { categoryId: "fun", searchText: "" }).map(t=>t.id));
writeFileSync(`${OUT}/expenses.json`, JSON.stringify({ topic: "expenses", source: "lib/calc/expenses.ts", fixtures, conventions: "Dates are local calendar dates YYYY-MM-DD. Amounts in transactions are decimal strings, signed (negative = outflow). month fields are 0-based.", vectors: V.splice(0) }, null, 2));

// cashflow
for (const [p, ref] of [["3mesi","2026-05-31"],["6mesi","2026-10-16"],["12mesi","2026-02-28"],["24mesi","2026-10-16"]] as const)
  add(`cashflow.periodRange.${p}.${ref}`, "getCashflowPeriodRange", { period: p, referenceDate: ref }, rk(C.getCashflowPeriodRange(p, d(ref))));
add("cashflow.previousRange.3mesi", "getPreviousCashflowPeriodRange", { period: "3mesi", referenceDate: "2026-05-31" }, rk(C.getPreviousCashflowPeriodRange("3mesi", d("2026-05-31"))));
add("cashflow.shift.31jan.back", "shiftCashflowReferenceDate", { period: "3mesi", referenceDate: "2026-05-31", direction: -1 }, k(C.shiftCashflowReferenceDate("3mesi", d("2026-05-31"), -1)), "day clamped to last day of target month (28 Feb)");
add("cashflow.periodLabel.sameYear", "formatCashflowPeriodLabel", { range: { from: "2026-08-01", to: "2026-10-31" } }, C.formatCashflowPeriodLabel({ from: d("2026-08-01"), to: d("2026-10-31") }), "Always it-IT in web (not localized)");
add("cashflow.periodLabel.crossYear", "formatCashflowPeriodLabel", { range: { from: "2025-11-01", to: "2026-10-31" } }, C.formatCashflowPeriodLabel({ from: d("2025-11-01"), to: d("2026-10-31") }));
add("cashflow.kpis.3m.partial", "computeCashflowKpis", { fixture: "transactions", range: { from: "2026-08-01", to: "2026-10-31" }, today: "2026-10-16" }, C.computeCashflowKpis(txs, { from: d("2026-08-01"), to: d("2026-10-31") }, d("2026-10-16")), "elapsed months = 1 + 1 + 16/31");
add("cashflow.kpis.past", "computeCashflowKpis", { fixture: "transactions", range: { from: "2026-08-01", to: "2026-09-30" }, today: "2026-10-16" }, C.computeCashflowKpis(txs, { from: d("2026-08-01"), to: d("2026-09-30") }, d("2026-10-16")));
add("cashflow.kpis.future", "computeCashflowKpis", { fixture: "transactions", range: { from: "2026-11-01", to: "2026-12-31" }, today: "2026-10-16" }, C.computeCashflowKpis(txs, { from: d("2026-11-01"), to: d("2026-12-31") }, d("2026-10-16")), "no elapsed months -> divides by month count; no income -> tassoRisparmio null");
add("cashflow.monthlySeries.crossYear", "computeMonthlySeries", { fixture: "transactions", range: { from: "2025-12-01", to: "2026-02-28" } }, C.computeMonthlySeries(txs, { from: d("2025-12-01"), to: d("2026-02-28") }), "labels get \" 'YY\" suffix when range spans 2 calendar years");
add("cashflow.monthlySeries.aug-oct", "computeMonthlySeries", { fixture: "transactions", range: { from: "2026-08-01", to: "2026-10-31" } }, C.computeMonthlySeries(txs, { from: d("2026-08-01"), to: d("2026-10-31") }));
add("cashflow.incomeSources.oct", "computeIncomeSources", { fixture: "transactions+categories", range: { from: "2026-10-01", to: "2026-10-31" } }, C.computeIncomeSources(txs, cats, { from: d("2026-10-01"), to: d("2026-10-31") }), "quotaPct is 0-100 (percent), not ratio");
add("cashflow.whereItGoes.sep", "computeWhereItGoes", { fixture: "transactions+categories", referenceDate: "2026-09-15" }, C.computeWhereItGoes(txs, cats, d("2026-09-15")));
add("cashflow.whereItGoes.oct", "computeWhereItGoes", { fixture: "transactions+categories", referenceDate: "2026-10-16" }, C.computeWhereItGoes(txs, cats, d("2026-10-16")));
add("cashflow.accumulated", "computeAccumulatedSavings", { fixture: "transactions", range: { from: "2026-08-01", to: "2026-10-31" } }, C.computeAccumulatedSavings(txs, { from: d("2026-08-01"), to: d("2026-10-31") }));
for (const [i, e] of [[1000, 700],[1000,1300],[0,50],[-10,0]]) add(`movements.savingsRate.${i}.${e}`, "computeSavingsRate", { income: i, expenses: e }, M.computeSavingsRate(i, e));
for (const [p, ref] of [["mese","2026-10-16"],["anno","2026-10-16"]] as const) add(`movements.trendRange.${p}`, "getTrendRange", { period: p, referenceDate: ref }, rk(M.getTrendRange(p, d(ref))));
writeFileSync(`${OUT}/cashflow.json`, JSON.stringify({ topic: "cashflow", source: "lib/calc/cashflow.ts, lib/calc/movements.ts", fixtures: "same as expenses.json fixtures", vectors: V.splice(0) }, null, 2));

// month pace
const pace = (today: string, t = txs, b = budgets) => computeMonthPace(t as any, b as any, d(today));
add("monthPace.oct16", "computeMonthPace", { fixture: "transactions+budgets", today: "2026-10-16" }, pace("2026-10-16"));
add("monthPace.oct02", "computeMonthPace", { fixture: "transactions+budgets", today: "2026-10-02" }, pace("2026-10-02"));
add("monthPace.noHistory", "computeMonthPace", { transactions: [strip(tx("2026-10-03", -10, "food"))], budgets: [], today: "2026-10-05" }, computeMonthPace([tx("2026-10-03", -10, "food")], [], d("2026-10-05")));
const shortMonth = [tx("2026-02-27", -28, "food"), tx("2026-01-31", -31, "food"), tx("2026-03-30", -5, "food")];
add("monthPace.clampShortMonth", "computeMonthPace", { transactions: shortMonth.map(strip), budgets: [], today: "2026-03-30" }, computeMonthPace(shortMonth, [], d("2026-03-30")), "Feb has 28 days: Feb curve is extended with its last value up to 31 points; Feb 'so far' is clamped to Feb 28");
writeFileSync(`${OUT}/month-pace.json`, JSON.stringify({ topic: "month-pace", source: "lib/calc/month-pace.ts", fixtures: "same as expenses.json fixtures", vectors: V.splice(0) }, null, 2));

// voice
for (const [lang, today, nd] of [["it","2026-10-16",{ name: "Auto", date: "2026-10-20", amount: 250 }],["en","2026-10-16",null],["de","2026-10-02",{ name: "Mutuo", date: "2026-10-02", amount: 800 }]] as const) {
  const p = pace(today);
  add(`voice.${lang}.${today}`, "buildVoiceLines", { language: lang, pace: `computeMonthPace(fixture, ${today})`, monthLabel: lang === "it" ? "ottobre" : lang === "en" ? "October" : "Oktober", currency: "EUR", nextDue: nd, today }, buildVoiceLines({ language: lang as any, pace: p, monthLabel: lang === "it" ? "ottobre" : lang === "en" ? "October" : "Oktober", currency: "EUR", nextDue: nd as any, today: d(today) }));
}
add("voice.inline", "buildVoiceLines", { language: "it", pace: { spentSoFar: 102, typicalSoFar: 100 }, monthLabel: "ottobre", currency: "EUR", nextDue: { name: "Prestito", date: "2026-10-10", amount: 99.5 }, today: "2026-10-16" }, buildVoiceLines({ language: "it", pace: { spentSoFar: 102, typicalSoFar: 100 } as any, monthLabel: "ottobre", currency: "EUR", nextDue: { name: "Prestito", date: "2026-10-10", amount: 99.5 }, today: d("2026-10-16") }), "within 5% tolerance -> 'in linea'; overdue rata -> 'è scaduta'");
writeFileSync(`${OUT}/overview-voice.json`, JSON.stringify({ topic: "overview-voice", source: "lib/overview/voice.ts", vectors: V.splice(0) }, null, 2));

// net worth
const accounts: any[] = [{ id: "acc1", source: "auto", balance: "1500.00" }, { id: "acc2", source: "manual", balance: "500.00" }];
const nwTx = [tx("2026-10-14", -100, "food"), tx("2026-10-15", 50, "salary"), tx("2026-10-16", -20, "food"), tx("2026-10-12", -30, "food", 0, "acc2")];
add("netWorth.deriveLiquidity", "deriveLiquidityHistory", { accounts, transactions: nwTx.map(strip), today: "2026-10-16" }, N.deriveLiquidityHistory(accounts, nwTx, d("2026-10-16")), "manual accounts constant; today's tx subtracted from 'after'; points end yesterday");
add("netWorth.deriveLiquidity.noAuto", "deriveLiquidityHistory", { accounts: [accounts[1]], transactions: [], today: "2026-10-16" }, N.deriveLiquidityHistory([accounts[1]], [], d("2026-10-16")));
for (const [p, today, earliest] of [["1mese","2026-03-31",null],["3mesi","2026-05-31",null],["1anno","2024-02-29",null],["max","2026-10-16","2025-01-05"],["max","2026-10-16",null]] as const)
  add(`netWorth.periodRange.${p}.${today}.${earliest ?? "none"}`, "getNetWorthPeriodRange", { period: p, today, earliestDate: earliest }, rk(N.getNetWorthPeriodRange(p, d(today), earliest)));
const snaps = [
  { date: "2026-10-10", amount: "1000.00", source: "auto", assetClass: "liquidita" },
  { date: "2026-10-10", amount: "5000.00", source: "auto", assetClass: "investimenti" },
  { date: "2026-10-12", amount: "1100.00", source: "derivato", assetClass: "liquidita" },
  { date: "2026-10-14", amount: "5200.50", source: "auto", assetClass: "investimenti" },
  { date: "2026-10-16", amount: "9999.00", source: "auto", assetClass: "liquidita" },
];
const todayByClass = { liquidita: 1200, investimenti: 5300.25 };
add("netWorth.series.1mese", "buildNetWorthSeries", { snapshots: snaps, todayByClass, period: "1mese", today: "2026-10-16" }, N.buildNetWorthSeries(snaps, todayByClass, "1mese", d("2026-10-16")), "labels are it-IT 'd MMM' (web hardcodes it-IT); rows dated >= today ignored");
const snaps2 = [{ date: "2026-08-30", amount: "100", source: "auto", assetClass: "liquidita" }, { date: "2026-09-15", amount: "200", source: "auto", assetClass: "liquidita" }];
add("netWorth.series.max.monthly", "buildNetWorthSeries", { snapshots: snaps2, todayByClass: { liquidita: 300 }, period: "max", today: "2026-10-02" }, N.buildNetWorthSeries(snaps2, { liquidita: 300 }, "max", d("2026-10-02")), "one point per month = last daily point of the month; label 'MMM yy' it-IT");
const s3 = N.buildNetWorthSeries(snaps, todayByClass, "1mese", d("2026-10-16"));
add("netWorth.change", "computeNetWorthChange", { series: "netWorth.series.1mese.expected" }, N.computeNetWorthChange(s3));
add("netWorth.change.empty", "computeNetWorthChange", { series: [] }, N.computeNetWorthChange([]));
add("netWorth.change.zeroStart", "computeNetWorthChange", { series: [{ value: 0 }, { value: 100 }] }, N.computeNetWorthChange([{ value: 0 }, { value: 100 }] as any));
add("netWorth.change.negStart", "computeNetWorthChange", { series: [{ value: -200 }, { value: 100 }] }, N.computeNetWorthChange([{ value: -200 }, { value: 100 }] as any), "divides by |start|");
add("netWorth.excludeClass", "excludeClassFromSeries", { series: [{ value: 10, byClass: { a: 4, b: 6 } }], classKey: "a" }, N.excludeClassFromSeries([{ value: 10, byClass: { a: 4, b: 6 } }] as any, "a"));
add("netWorth.restrictClasses", "restrictSeriesToClasses", { series: [{ value: 10, byClass: { a: 4, b: 6, c: 1 } }], classKeys: ["a","c","z"] }, N.restrictSeriesToClasses([{ value: 10, byClass: { a: 4, b: 6, c: 1 } }] as any, ["a","c","z"]));
writeFileSync(`${OUT}/net-worth.json`, JSON.stringify({ topic: "net-worth", source: "lib/calc/net-worth.ts", vectors: V.splice(0) }, null, 2));

// liquidity
for (const [total, parts] of [[100,2],[100,3],[10.01,4],[0.01,2]]) add(`split.ownShareForPreset.${total}.${parts}`, "ownShareForPreset", { total, parts }, S.ownShareForPreset(total, parts));
for (const [share, total] of [[150,100],[-5,100],[NaN,100],[33.335,100]]) add(`split.clampOwnShare.${share}.${total}`, "clampOwnShare", { share: Number.isNaN(share) ? "NaN" : share, total }, S.clampOwnShare(share, total));
for (const [total, own] of [[100,33.33],[59.99,20],[100,120]]) add(`split.excludedFromOwnShare.${total}.${own}`, "excludedFromOwnShare", { total, ownShare: own }, S.excludedFromOwnShare(total, own));
for (const [total, own] of [[100,33.33],[100,33.34],[100,50],[100,40]]) add(`split.matchPreset.${total}.${own}`, "matchPreset", { total, ownShare: own }, S.matchPreset(total, own)?.key ?? null);
add("liquidity.cumulativeSpend", "buildCumulativeSpend", { fixture: "transactions", range: { from: "2026-10-01", to: "2026-10-31" }, today: "2026-10-05" }, buildCumulativeSpend(txs, { from: d("2026-10-01"), to: d("2026-10-31") }, d("2026-10-05")));
add("liquidity.accountSeries.auto", "buildAccountBalanceSeries", { account: accounts[0], transactions: nwTx.map(strip), from: "2026-10-12", today: "2026-10-16" }, buildAccountBalanceSeries(accounts[0], nwTx, d("2026-10-12"), d("2026-10-16")), "includes today; today's movements are part of the current balance");
add("liquidity.accountSeries.manual", "buildAccountBalanceSeries", { account: accounts[1], transactions: nwTx.map(strip), from: "2026-10-14", today: "2026-10-16" }, buildAccountBalanceSeries(accounts[1], nwTx, d("2026-10-14"), d("2026-10-16")));
for (const loc of ["it-IT","en-GB","de-DE"]) for (const date of ["2026-10-16","2026-10-15","2026-10-05","2025-12-24"]) add(`liquidity.dayLabel.${loc}.${date}`, "dayLabel", { date, today: "2026-10-16", locale: loc }, dayLabel(date, d("2026-10-16"), loc), "'Oggi'/'Ieri' are Italian source strings, translated by the UI layer via t()");
add("liquidity.groupByDay", "groupByDay", { fixture: "transactions (only 2026-10-*)", today: "2026-10-16", locale: "it-IT" }, groupByDay(txs.filter(t=>t.date.startsWith("2026-10")), d("2026-10-16")).map(g => ({ date: g.date, label: g.label, total: g.total, itemIds: g.items.map((i:any)=>i.id) })));
const now = new Date("2026-10-16T10:00:00Z");
for (const [status, exp] of [["linked","2026-10-20T10:00:00Z"],["linked","2026-10-23T10:00:01Z"],["linked","2026-10-16T09:00:00Z"],["linked",null],["error","2026-12-01T00:00:00Z"],["pending",null],["expired",null]] as const)
  add(`connectionHealth.${status}.${exp}`, "computeConnectionHealth", { input: { status, consentExpiresAt: exp }, now: now.toISOString() }, computeConnectionHealth({ status: status as any, consentExpiresAt: exp }, now));
writeFileSync(`${OUT}/liquidity.json`, JSON.stringify({ topic: "liquidity", source: "lib/liquidity/*, lib/gocardless/connection-health.ts", fixtures: "same as expenses.json fixtures", vectors: V.splice(0) }, null, 2));
console.log("ok");
