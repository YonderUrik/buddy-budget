import * as P from "@/lib/calc/pension";
import { writeFileSync } from "node:fs";
const out = process.argv[2];
const vectors: any[] = [];
const v = (id: string, fn: string, input: any, expected: any, tolerance: number | null = 1e-9, notes = "") => vectors.push({ id, function: fn, input, expected, tolerance, notes });

for (const y of [0, 15, 16, 20, 35, 40]) v(`exitTaxRate-${y}`, "exitTaxRate", { years: y }, P.exitTaxRate(y));
for (const [a, b] of [["2010-03-15", "2026-03-14"], ["2010-03-15", "2026-03-15"], ["2024-02-29", "2025-02-28"], ["2030-01-01", "2026-01-01"]]) v(`wholeYearsBetween-${a}-${b}`, "wholeYearsBetween", { from: a, to: b }, P.wholeYearsBetween(a, b), 0);
for (const [k, m] of [["2024-01-31", 1], ["2023-01-31", 1], ["2026-10-18", 180], ["2026-03-31", -1]] as [string, number][]) v(`addMonths-${k}-${m}`, "addMonths", { date: k, months: m }, P.addMonths(k, m), 0);
for (const d of ["2005-06-30", "2026-01-01", "2024-02-29"]) v(`exitTaxMilestones-${d}`, "exitTaxMilestones", { adhesionDate: d }, P.exitTaxMilestones(d), 0, "min rate after 15 + round((0.15-0.09)/0.003)=35 years");

const snaps = [
  { id: "a", date: "2022-06-30", netContributions: 3000, value: 3100 },
  { id: "b", date: "2022-12-31", netContributions: 4500, value: 4650 },
  { id: "c", date: "2023-12-31", netContributions: 7500, value: 8100 },
  { id: "d", date: "2024-12-31", netContributions: 10500, value: 12000 },
  { id: "e", date: "2025-06-30", netContributions: 12000, value: 13800 },
];
v("deriveContributions-adhesion", "deriveContributions", { snapshots: snaps, adhesionDate: "2021-07-01" }, P.deriveContributions(snaps, "2021-07-01"), 1e-9, "First 3000 spread over round(round(364/30.4167)/3)=4 quarterly estimated payments");
v("deriveContributions-noAdhesion", "deriveContributions", { snapshots: snaps, adhesionDate: null }, P.deriveContributions(snaps, null));
v("deriveContributions-empty", "deriveContributions", { snapshots: [], adhesionDate: null }, P.deriveContributions([], null), 0);
v("computePensionPerformance-adhesion", "computePensionPerformance", { snapshots: snaps, adhesionDate: "2021-07-01" }, P.computePensionPerformance(snaps, "2021-07-01"), 1e-9, "annualReturn from XIRR bisection; tolerance 1e-9 absolute");
v("computePensionPerformance-null", "computePensionPerformance", { snapshots: snaps, adhesionDate: null }, P.computePensionPerformance(snaps, null), 1e-9);
v("computePensionPerformance-single", "computePensionPerformance", { snapshots: [snaps[0]], adhesionDate: null }, P.computePensionPerformance([snaps[0]], null), 1e-9, "Single snapshot, same-date flows: days=0 → annualReturn null");
v("computePensionPerformance-none", "computePensionPerformance", { snapshots: [], adhesionDate: null }, P.computePensionPerformance([], null), 0);

v("withdrawalScenarios-gain", "withdrawalScenarios", { value: 13800, netContributions: 12000, adhesionDate: "2005-06-30", today: "2026-10-18" }, P.withdrawalScenarios(13800, 12000, "2005-06-30", "2026-10-18"));
v("withdrawalScenarios-loss", "withdrawalScenarios", { value: 9000, netContributions: 10000, adhesionDate: "2020-01-01", today: "2026-10-18" }, P.withdrawalScenarios(9000, 10000, "2020-01-01", "2026-10-18"), 1e-9, "base capped at value when value < contributions");
v("withdrawalScenarios-override", "withdrawalScenarios", { value: 13800, netContributions: 12000, adhesionDate: "2020-01-01", today: "2026-10-18", yearsOverride: 30 }, P.withdrawalScenarios(13800, 12000, "2020-01-01", "2026-10-18", 30), 1e-9, "Rate-simulation slider path");
v("withdrawalScenarios-noAdhesion", "withdrawalScenarios", { value: 5000, netContributions: 0, adhesionDate: null, today: "2026-10-18" }, P.withdrawalScenarios(5000, 0, null, "2026-10-18"));

const contribs = P.deriveContributions(snaps, "2021-07-01");
v("companyTfrValue-2pct", "companyTfrValue", { contributions: contribs, asOf: "2025-06-30", inflationRate: 0.02 }, P.companyTfrValue(contribs, "2025-06-30", 0.02), 1e-9, "annualRate = 0.015 + 0.75*0.02 = 0.03");
v("companyTfrValue-0", "companyTfrValue", { contributions: [{ date: "2020-01-01", amount: 1000, estimated: false }], asOf: "2025-01-01", inflationRate: 0 }, P.companyTfrValue([{ date: "2020-01-01", amount: 1000, estimated: false }], "2025-01-01", 0), 1e-9, "years = 1827/365");
v("companyTfrValue-empty", "companyTfrValue", { contributions: [], asOf: "2025-01-01", inflationRate: 0.02 }, P.companyTfrValue([], "2025-01-01", 0.02));

v("recentQuarterlyContribution-ok", "recentQuarterlyContribution", { snapshots: snaps }, P.recentQuarterlyContribution(snaps));
const short = [snaps[3], snaps[4]];
v("recentQuarterlyContribution-short", "recentQuarterlyContribution", { snapshots: short }, P.recentQuarterlyContribution(short), 0, "181 days < 270 → null");
v("recentQuarterlyContribution-one", "recentQuarterlyContribution", { snapshots: [snaps[0]] }, P.recentQuarterlyContribution([snaps[0]]), 0);

const rates = { prudent: 0, base: 0.02, optimistic: 0.04 };
v("projectPension-3y", "projectPension", { startValue: 10000, quarterlyContribution: 500, years: 3, rates }, P.projectPension({ startValue: 10000, quarterlyContribution: 500, years: 3, rates }));
v("projectPension-0y", "projectPension", { startValue: 10000, quarterlyContribution: 500, years: 0, rates }, P.projectPension({ startValue: 10000, quarterlyContribution: 500, years: 0, rates }));
v("projectPension-roundYears", "projectPension", { startValue: 0, quarterlyContribution: 100, years: 1.6, rates }, P.projectPension({ startValue: 0, quarterlyContribution: 100, years: 1.6, rates }), 1e-9, "years rounded with Math.round (1.6 → 2)");
const p25 = P.projectPension({ startValue: 13800, quarterlyContribution: 500, years: 25, rates });
v("projectPension-25y-last", "projectPension(last point)", { startValue: 13800, quarterlyContribution: 500, years: 25, rates }, p25.at(-1), 1e-6, "Default slider position (25y); only last point listed");

v("yearlyBreakdown", "yearlyBreakdown", { snapshots: snaps }, P.yearlyBreakdown(snaps));
v("yearlyBreakdown-partialDec31", "yearlyBreakdown", { snapshots: snaps.slice(0, 4) }, P.yearlyBreakdown(snaps.slice(0, 4)), 1e-9, "last snapshot on 12-31 → partial=false");
writeFileSync(out, JSON.stringify({ topic: "pension", source: "lib/calc/pension.ts (+ lib/calc/returns.ts xirrDaily/daysBetween)", generatedWith: "npx tsx (Node, V8 doubles)", vectors }, null, 2));
console.log(vectors.length);
