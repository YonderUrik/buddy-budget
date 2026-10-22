import { monthsBetween, addMonthsKey, monthsToFire, buildGoalsPlan } from "@/lib/goals/plan";
import { buildGoalsView } from "@/lib/goals/view";
import { emergencyTarget, requiredMonthly } from "@/components/domain/goals/goal-form-state";
import { writeFileSync } from "node:fs";
const out = process.argv[2];
const vectors: any[] = [];
const v = (id: string, fn: string, input: any, expected: any, tolerance: number | null = 1e-9, notes = "") => vectors.push({ id, function: fn, input, expected, tolerance, notes });
for (const [a, b] of [["2026-10-18", "2027-03-01"], ["2026-10-18", "2026-10-31"], ["2026-10", "2025-12"]]) v(`monthsBetween-${a}-${b}`, "monthsBetween", { from: a, to: b }, monthsBetween(a, b), 0, "Day ignored");
for (const [a, m] of [["2026-10-18", 3], ["2026-11-01", 2], ["2026-01", -1], ["2026-10-18", 0]] as [string, number][]) v(`addMonthsKey-${a}-${m}`, "addMonthsKey", { from: a, months: m }, addMonthsKey(a, m), 0);
const fire = { wealth: 150000, annualSavings: 15000, realReturn: 0.04, target: 873743.9930100479 };
v("monthsToFire-base", "monthsToFire", { fire, withdrawals: [] }, monthsToFire(fire), 0, "monthly compounding (1+r)^(1/12)−1, saving/12 at month end; first month where wealth ≥ target");
v("monthsToFire-withdrawal", "monthsToFire", { fire, withdrawals: [[12, 20000]] }, monthsToFire(fire, new Map([[12, 20000]])), 0);
v("monthsToFire-already", "monthsToFire", { fire: { ...fire, wealth: 900000 }, withdrawals: [] }, monthsToFire({ ...fire, wealth: 900000 }), 0);
v("monthsToFire-never", "monthsToFire", { fire: { ...fire, annualSavings: 0, realReturn: 0 }, withdrawals: [] }, monthsToFire({ ...fire, annualSavings: 0, realReturn: 0 }), 0, "> 600 months → null");
const goals = [
  { id: "e", kind: "emergenza", target: 12000, targetDate: null, monthly: 300, current: 9000, achieved: false },
  { id: "v", kind: "viaggio", target: 3000, targetDate: "2027-06-01", monthly: 400, current: 500, achieved: false },
  { id: "c", kind: "casa", target: 40000, targetDate: "2028-01-01", monthly: 800, current: 5000, achieved: false },
  { id: "a", kind: "acquisto", target: 1000, targetDate: null, monthly: 100, current: 1000, achieved: false },
] as any;
v("buildGoalsPlan-capacity1000", "buildGoalsPlan", { goals, capacity: 1000, today: "2026-10-18", fire }, buildGoalsPlan({ goals, capacity: 1000, today: "2026-10-18", fire }), 1e-9, "priority order: e gets 300, v 400, c only 300 of 800 → gap 500; a already reached");
v("buildGoalsPlan-noCapacity", "buildGoalsPlan", { goals, capacity: null, today: "2026-10-18", fire: null }, buildGoalsPlan({ goals, capacity: null, today: "2026-10-18", fire: null }), 1e-9, "capacity null = unlimited; gap 0");
v("buildGoalsPlan-zeroCapacity", "buildGoalsPlan", { goals: goals.slice(0, 2), capacity: -200, today: "2026-10-18", fire }, buildGoalsPlan({ goals: goals.slice(0, 2), capacity: -200, today: "2026-10-18", fire }), 1e-9, "negative capacity treated as 0 → all 'fermo'");
const view = buildGoalsView({
  currency: "EUR", todayKey: "2026-10-18",
  goals: [
    { id: "g2", name: "Viaggio", kind: "viaggio", target: 3000, targetDate: "2027-06-01", monthly: 400, priority: 1, achievedAt: null, createdAt: "2026-09-01T00:00:00Z" },
    { id: "g1", name: "Emergenza", kind: "emergenza", target: 12000, targetDate: null, monthly: 300, priority: 0, achievedAt: null, createdAt: "2026-08-01T00:00:00Z" },
  ],
  sources: [
    { id: "s1", goalId: "g1", accountId: "acc1", instrumentId: null, amount: 8000 },
    { id: "s2", goalId: "g2", accountId: "acc1", instrumentId: null, amount: 3000 },
    { id: "s3", goalId: "g2", accountId: null, instrumentId: "etf", amount: 1000 },
  ],
  accounts: [{ id: "acc1", name: "Conto", type: "corrente", balance: 10000 }],
  positions: [{ id: "etf", name: "ETF World", value: 50000, unrealizedGain: 10000, taxRate: 0.26 }],
  capacity: 1250, fire, essentialMonthly: 1500, debtsTotal: 0,
});
v("buildGoalsView", "buildGoalsView", "see input in notes", view, 1e-9, "Inputs: goals g1 (prio0, emergenza 12000, monthly 300, source acc1 8000), g2 (prio1, viaggio 3000 by 2027-06, monthly 400, sources acc1 3000 + etf 1000); account acc1 balance 10000; etf value 50000 gain 10000 rate 0.26; capacity 1250; fire as monthsToFire-base. acc1 is over-assigned → g2 gets 2000 (short=true). ETF tax per euro = 10000/50000×0.26 = 0.052 → tax 52, counted 948.");
v("emergencyTarget", "emergencyTarget", { essentialMonthly: 1537, months: 6 }, emergencyTarget(1537, 6), 0, "round to hundreds");
v("requiredMonthly", "requiredMonthly", { draft: { target: 3000, targetMonth: "2027-06", sources: { "account:a": 500 } }, today: "2026-10-18" }, requiredMonthly({ kind: "viaggio", name: "x", target: 3000, emergencyMonths: null, targetMonth: "2027-06", monthly: null, sources: { "account:a": 500 }, priority: 0 }, "2026-10-18"), 0, "ceil(2500 / 8)");
writeFileSync(out, JSON.stringify({ topic: "goals", source: "lib/goals/plan.ts, lib/goals/view.ts, components/domain/goals/goal-form-state.ts", generatedWith: "npx tsx (Node, V8 doubles)", vectors }, null, 2));
console.log(vectors.length);
