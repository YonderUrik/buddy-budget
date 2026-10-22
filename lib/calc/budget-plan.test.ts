import { describe, expect, it } from "vitest";
import type { Category } from "@/lib/db/schema/categories";
import type { Transaction } from "@/lib/db/schema/transactions";
import { budgetAmountFor, buildBudgetMonth, carriedInto, indexSpending, proposeBudgets, roundProposal, shiftMonth, type BudgetMonthAmount, type BudgetSetting } from "./budget-plan";

function tx(date: string, amount: string, categoryId: string | null = "spesa", excludedAmount = "0.00"): Transaction {
  return { id: crypto.randomUUID(), userId: "u", accountId: "a", categoryId, amount, excludedAmount, date } as Transaction;
}

function category(id: string, type: Category["type"], isFallback = false): Category {
  return { id, userId: "u", name: id, defaultKey: null, type, color: "slate", icon: "package", description: null, isFallback, createdAt: new Date() };
}

const categories = [
  category("spesa", "dovuta"),
  category("affitto", "dovuta"),
  category("ristoranti", "voluta"),
  category("regali", "saltuaria"),
  category("risparmio", "futuro"),
  category("altro", "dovuta", true),
  category("stipendio", "entrata"),
  category("giroconto", "trasferimento"),
];
const today = new Date(2026, 9, 22); // 22 October 2026

describe("months", () => {
  it("shifts across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
  it("rounds proposals to round figures", () => {
    expect(roundProposal(41)).toBe(45);
    expect(roundProposal(401)).toBe(410);
  });
});

describe("budgetAmountFor", () => {
  const budget: BudgetSetting = { categoryId: "spesa", monthlyAmount: "450", rollover: false, rolloverFrom: null };
  const months: BudgetMonthAmount[] = [
    { categoryId: "spesa", month: "2026-05", amount: "400", singleMonth: false },
    { categoryId: "spesa", month: "2026-10", amount: "450", singleMonth: false },
    { categoryId: "spesa", month: "2026-12", amount: "600", singleMonth: true },
  ];
  it("keeps past months on the amount they had", () => {
    expect(budgetAmountFor(budget, months, "2026-07").amount).toBe(400);
    expect(budgetAmountFor(budget, months, "2026-11").amount).toBe(450);
  });
  it("uses the earliest amount before the first change and the current one without history", () => {
    expect(budgetAmountFor(budget, months, "2026-01").amount).toBe(400);
    expect(budgetAmountFor(budget, [], "2026-01").amount).toBe(450);
  });
  it("replaces only the month with a single-month amount", () => {
    expect(budgetAmountFor(budget, months, "2026-12")).toEqual({ amount: 600, singleMonth: true });
    expect(budgetAmountFor(budget, months, "2027-01").amount).toBe(450);
  });
});

describe("carriedInto", () => {
  const budget: BudgetSetting = { categoryId: "regali", monthlyAmount: "50", rollover: true, rolloverFrom: "2026-07" };
  const spending = indexSpending([tx("2026-07-10", "-20.00", "regali"), tx("2026-08-03", "-110.00", "regali"), tx("2026-06-01", "-500.00", "regali")]);
  it("adds what was left (and takes what went over) from rolloverFrom to the month before", () => {
    // July +30, August −60, September +50
    expect(carriedInto(budget, [], spending, "2026-10")).toBe(20);
  });
  it("is 0 without rollover or from its first month", () => {
    expect(carriedInto({ ...budget, rollover: false }, [], spending, "2026-10")).toBe(0);
    expect(carriedInto(budget, [], spending, "2026-07")).toBe(0);
  });
});

describe("buildBudgetMonth", () => {
  const transactions = [
    // three complete months: rent on the 1st, groceries spread, salary
    ...["2026-07", "2026-08", "2026-09"].flatMap((m) => [
      tx(`${m}-01`, "-700.00", "affitto"),
      tx(`${m}-05`, "-150.00", "spesa"),
      tx(`${m}-25`, "-250.00", "spesa"),
      tx(`${m}-27`, "2000.00", "stipendio"),
      tx(`${m}-28`, "500.00", "giroconto"),
    ]),
    tx("2026-10-01", "-700.00", "affitto"),
    tx("2026-10-04", "-300.00", "spesa"),
    tx("2026-10-10", "-40.00", "ristoranti"),
    tx("2026-10-12", "-30.00", "regali"),
  ];
  const budgets: BudgetSetting[] = [
    { categoryId: "affitto", monthlyAmount: "700", rollover: false, rolloverFrom: null },
    { categoryId: "spesa", monthlyAmount: "420", rollover: false, rolloverFrom: null },
    { categoryId: "regali", monthlyAmount: "50", rollover: true, rolloverFrom: "2026-08" },
  ];
  const plan = buildBudgetMonth({ transactions, categories, budgets, months: [], month: "2026-10", today });

  it("projects with the usual rest of the month, so a rent paid on the 1st stays at its amount", () => {
    const rent = plan.categories.find((c) => c.categoryId === "affitto")!;
    expect(rent.projected).toBe(700);
    const groceries = plan.categories.find((c) => c.categoryId === "spesa")!;
    expect(groceries.projected).toBe(550);
    expect(groceries.left).toBe(120);
  });
  it("adds the carried leftover to an occasional budget and gives no projection", () => {
    const gifts = plan.categories.find((c) => c.categoryId === "regali")!;
    expect(gifts.carried).toBe(100);
    expect(gifts.available).toBe(150);
    expect(gifts.left).toBe(120);
    expect(gifts.projected).toBeNull();
  });
  it("sums the month, the money per day and the usual income without transfers", () => {
    expect(plan.total).toMatchObject({ available: 1270, spent: 1030, left: 240 });
    expect(plan.total.perDay).toBeCloseTo(240 / 10);
    expect(plan.income).toEqual({ amount: 2000, kind: "usual" });
    expect(plan.expectedShare).toBeCloseTo(22 / 31);
  });
  it("lists spending without a budget apart", () => {
    expect(plan.unbudgeted.map((u) => u.categoryId)).toEqual(["ristoranti"]);
  });
  it("shows a past month with its real income and no pace", () => {
    const past = buildBudgetMonth({ transactions, categories, budgets, months: [], month: "2026-09", today });
    expect(past.when).toBe("past");
    expect(past.income).toEqual({ amount: 2000, kind: "actual" });
    expect(past.total.perDay).toBeNull();
    expect(past.categories.every((c) => c.projected === null)).toBe(true);
  });

  it("proposes the median month for monthly groups and a twelfth of the year for occasional ones", () => {
    const proposals = proposeBudgets({
      transactions: [...transactions, tx("2026-03-10", "-240.00", "regali"), tx("2026-08-10", "-120.00", "ristoranti"), tx("2026-09-10", "-90.00", "risparmio")],
      categories,
      budgets: [{ categoryId: "affitto" }],
      today,
    });
    expect(proposals).toEqual([
      { categoryId: "spesa", amount: 400, rollover: false, basis: { kind: "monthly", usual: 400 } },
      { categoryId: "regali", amount: 60, rollover: true, basis: { kind: "yearly", total: 240, months: 4 } },
    ]);
  });
  it("proposes nothing without a complete month", () => {
    expect(proposeBudgets({ transactions: [tx("2026-10-04", "-300.00")], categories, budgets: [], today })).toEqual([]);
  });
});
