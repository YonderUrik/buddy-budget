import { describe, expect, it } from "vitest";
import { defaultCategoryRows } from "@/lib/categories/seed";
import { computeMonthPace } from "@/lib/calc/month-pace";
import type { Account } from "@/lib/db/schema/accounts";
import type { Budget } from "@/lib/db/schema/budgets";
import type { Category } from "@/lib/db/schema/categories";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { DebtsViewData } from "@/lib/debts/view";
import { localizeCategory } from "@/lib/localization/categories";
import { buildAccountExtras } from "./accounts";
import { buildLiquidityAnalysis } from "./liquidity-analysis";
import { buildLiquidityMonth } from "./liquidity-month";
import { buildOverviewView } from "./overview";
import { sampleIndexes } from "./investments";
import { buildWhatsNew } from "./meta";
import { accountExtrasSchema, liquidityAnalysisSchema, liquidityMonthSchema, overviewViewSchema } from "./schemas";

const TODAY = new Date(2026, 9, 18);
const NOW = new Date(2026, 9, 18, 12, 0, 0);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const categories: Category[] = defaultCategoryRows("u").map((row, i) => ({ ...row, id: uuid(200 + i), createdAt: NOW, updatedAt: NOW }) as Category);
const byKey = (key: string) => categories.find((c) => c.defaultKey === key)!;
const groceries = byKey("spesa");
const fallback = categories.find((c) => c.isFallback)!;
const salary = categories.find((c) => c.type === "entrata")!;

const account = (n: number, extra: Partial<Account>): Account =>
  ({ id: uuid(n), userId: "u", name: `Conto ${n}`, type: "Conto corrente", balance: "1000.00", color: "blue", icon: "landmark", source: "manuale", isDemo: false, createdAt: NOW, updatedAt: NOW, ...extra }) as Account;
const accounts = [account(1, { source: "auto", balance: "2500.00" }), account(2, { balance: "300.00" })];

let seq = 0;
const tx = (date: string, amount: number, categoryId: string, accountId = uuid(1)): Transaction =>
  ({ id: uuid(1000 + seq++), userId: "u", accountId, categoryId, description: "x", rawDescription: null, merchantCategoryCode: null, note: null, amount: amount.toFixed(2), excludedAmount: "0", categorySource: null, categoryConfidence: null, categorizedAt: null, date, source: "auto", externalId: null, createdAt: NOW, updatedAt: NOW }) as Transaction;
const transactions = [
  tx("2026-10-02", -120, groceries.id),
  tx("2026-10-10", -30, groceries.id, uuid(2)),
  tx("2026-10-12", -15, fallback.id),
  tx("2026-10-01", 2000, salary.id),
  tx("2026-09-05", -100, groceries.id),
  tx("2026-08-07", -80, groceries.id),
];
const budgets: Budget[] = [{ id: uuid(300), userId: "u", categoryId: groceries.id, monthlyAmount: "200.00", createdAt: NOW, updatedAt: NOW } as Budget];
const connections = [
  { accountId: uuid(1), connectionId: uuid(400), institutionName: "Banca Demo", status: "linked" as const, consentExpiresAt: "2026-10-22T10:00:00.000Z", lastSyncedAt: "2026-10-18T09:00:00.000Z", eligible: true, nextEligibleAt: null, syncsRemainingToday: 4 },
];

describe("buildOverviewView", () => {
  const debts = { debts: [], overview: { totalResidual: 5000, totalDebt: 5000, monthlyPayment: 200, interestToDate: 0, interestRemaining: 0, debtFreeDate: "2028-10-01", openCount: 1, weightedApr: null, nextDue: [{ debtId: "d1", name: "Auto", date: "2026-10-25", amount: 200, overdue: false }], residualSeries: [] } } as unknown as DebtsViewData;
  const input = {
    today: TODAY, period: "3mesi" as const, includePension: true, currency: "EUR", language: "en" as const, accounts,
    snapshots: [{ date: "2026-09-01", assetClass: "liquidita", amount: "2500.00", source: "manuale" }],
    monthTransactions: transactions, budgets, investments: null, debts, pensionFunds: [], connections,
  };

  it("matches the contract and uses the web's calculations", () => {
    const view = overviewViewSchema.parse(buildOverviewView(input));
    expect(view.todayByClass).toEqual({ liquidita: 2800, debiti: -5000 });
    expect(view.series.at(-1)).toMatchObject({ date: "2026-10-18", value: -2200, isEstimated: false });
    expect(view.monthPace).toEqual(computeMonthPace(transactions, budgets, TODAY));
    expect(view.composition.map((c) => [c.key, c.label, c.detail])).toEqual([["liquidita", "Cash", "2 accounts"], ["debiti", "Debts", "1 debt"]]);
    expect(view.debts).toMatchObject({ total: 5000, count: 1, debtFreeDate: "2028-10-01" });
    expect(view.voice.map((line) => line.key)).toEqual(["pace", "due"]);
    expect(view.renewalAlerts).toEqual([{ connectionId: uuid(400), institutionName: "Banca Demo", state: "expiring", daysLeft: 5, message: "The connection with Banca Demo expires in 5 days." }]);
    expect(view.isEmpty).toBe(false);
  });

  it("is empty without accounts, investments or pension", () => {
    expect(buildOverviewView({ ...input, accounts: [], debts: null, connections: [] })).toMatchObject({ isEmpty: true, composition: [], debts: null });
  });
});

describe("buildLiquidityMonth", () => {
  const input = { today: TODAY, accountId: null, currency: "EUR", language: "it" as const, accounts, transactions, categories, budgets, toFix: 3 };

  it("matches the contract: month figures, groups, budgets", () => {
    const month = liquidityMonthSchema.parse(buildLiquidityMonth(input));
    expect(month).toMatchObject({ month: { from: "2026-10-01", to: "2026-10-31", label: "ottobre" }, spent: 165, income: 2000, uncategorizedSpent: 15, toFix: 3, accounts: { total: 2800, count: 2 } });
    expect(month.groups.find((g) => g.key === "dovuta")).toEqual({ key: "dovuta", label: "Dovute", amount: 150 });
    expect(month.budget).toEqual({ total: 200, spent: 150, remaining: 50 });
    expect(month.budgets).toEqual([expect.objectContaining({ categoryId: groceries.id, budget: 200, spent: 150, remaining: 50, progress: 0.75 })]);
    expect(month.pace.typicalSoFar).toBe(90);
  });

  it("scopes the figures to one account, the sentence stays on all accounts", () => {
    const scoped = buildLiquidityMonth({ ...input, accountId: uuid(2) });
    expect(scoped.spent).toBe(30);
    expect(scoped.voice[0]?.segments.some((s) => s.text.includes("165"))).toBe(true);
  });

  it("uses the localized category names it is given", () => {
    const english = categories.map((c) => localizeCategory(c, { productCountry: "IT", language: "en" }));
    const month = buildLiquidityMonth({ ...input, language: "en", categories: english });
    expect(month.budgets[0]?.name).toBe("Groceries");
    expect(month.groups[0]?.label).toBe("Needs");
  });
});

describe("buildLiquidityAnalysis", () => {
  const input = { today: TODAY, period: "mese" as const, referenceDate: TODAY, accountId: null, currency: "EUR", language: "it" as const, transactions, categories, budgets };

  it("matches the contract: spend against the period before, groups, income, savings, sentence", () => {
    const view = liquidityAnalysisSchema.parse(buildLiquidityAnalysis(input));
    expect(view).toMatchObject({ range: { from: "2026-10-01", to: "2026-10-31" }, previousRange: { from: "2026-09-01", to: "2026-09-30" }, isCurrentMonth: true, spent: 165, spentBefore: 100, delta: 65, hasBudgets: true });
    expect(view.curve).toHaveLength(18);
    expect(view.curve.at(-1)).toEqual({ date: "2026-10-18", value: 165 });
    expect(view.typical).toEqual(computeMonthPace(transactions, budgets, TODAY).typical);
    expect(view.groups.map((g) => [g.key, g.label, g.amount])).toEqual([["dovuta", "Dovute", 150], ["daCategorizzare", "Da categorizzare", 15]]);
    expect(view.groups[0]?.categories).toEqual([expect.objectContaining({ id: groceries.id, amount: 150, budget: 200 })]);
    expect(view.incomeSources).toEqual([expect.objectContaining({ categoryId: salary.id, amount: 2000, quotaPct: 100 })]);
    expect(view.savings.map((s) => s.month)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(view.saved).toBe(2000 - 165 - 100 - 80);
    expect(view.sentence.replace(/\s/g, " ")).toBe("Finora hai speso 165 €, 65 € in più del periodo prima. La voce che pesa di più è «Spesa», il 91%.");
  });

  it("past periods: no typical line, «Hai speso», budgets scaled to the period", () => {
    const view = buildLiquidityAnalysis({ ...input, period: "3mesi", referenceDate: new Date(2026, 8, 15), language: "en" });
    expect(view).toMatchObject({ isCurrentMonth: false, typical: null, range: { from: "2026-07-01", to: "2026-09-30" }, spent: 180 });
    expect(view.groups[0]?.categories[0]?.budget).toBe(600);
    expect(view.sentence.startsWith("You spent")).toBe(true);
  });

  it("an account scope keeps only its movements", () => {
    expect(buildLiquidityAnalysis({ ...input, accountId: uuid(2) }).spent).toBe(30);
  });
});

describe("buildAccountExtras", () => {
  it("adds bank, trend, health and status to each account", () => {
    const rows = buildAccountExtras({ accounts, transactions, connections, syncJobs: [], today: TODAY, now: NOW, language: "en" });
    for (const row of rows) accountExtrasSchema.parse(row);
    const [linked, manual] = rows;
    expect(linked).toMatchObject({ bankName: "Banca Demo", health: { state: "expiring", needsRenewal: true, daysLeft: 5 }, status: { tone: "warning", label: "Reconnect needed" } });
    expect(linked?.trend).toHaveLength(31);
    expect(linked?.trend?.at(-1)).toBe(2500);
    expect(manual).toMatchObject({ bankName: null, trend: null, health: null, status: { tone: "neutral" } });
  });
});

describe("sampleIndexes", () => {
  it("keeps every point up to the cap, then samples evenly with the last one", () => {
    expect(sampleIndexes(3, 5)).toEqual([0, 1, 2]);
    const sampled = sampleIndexes(1000, 160);
    expect(sampled).toHaveLength(160);
    expect(sampled[0]).toBe(0);
    expect(sampled.at(-1)).toBe(999);
  });
});

describe("buildWhatsNew", () => {
  it("leaves out the entries released before the user's sign-up (web #444)", () => {
    const now = new Date("2026-10-20T12:00:00Z");
    const all = buildWhatsNew({ language: "it", productCountry: "IT", dismissed: [], now });
    const fresh = buildWhatsNew({ language: "it", productCountry: "IT", dismissed: [], now, since: new Date("2026-10-19T08:00:00Z") });
    expect(fresh.entries.every((entry) => entry.date > "2026-10-19")).toBe(true);
    expect(fresh.entries.length).toBeLessThanOrEqual(all.entries.length);
    if (fresh.current) expect(fresh.current.date > "2026-10-19").toBe(true);
  });
});
