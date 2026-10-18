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
import { buildLiquidityMonth } from "./liquidity-month";
import { buildOverviewView } from "./overview";
import { accountExtrasSchema, liquidityMonthSchema, overviewViewSchema } from "./schemas";

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
