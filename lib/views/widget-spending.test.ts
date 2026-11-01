import { describe, expect, it } from "vitest";
import { defaultCategoryRows } from "@/lib/categories/seed";
import type { Budget, BudgetMonth } from "@/lib/db/schema/budgets";
import type { Category } from "@/lib/db/schema/categories";
import type { Transaction } from "@/lib/db/schema/transactions";
import { widgetSpendingSchema } from "./schemas";
import { buildWidgetSpending, type WidgetSpendingInputs } from "./widget-spending";

const NOW = new Date("2026-10-14T10:30:00.000Z");
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const categories: Category[] = defaultCategoryRows("u").map((row, i) => ({ ...row, id: uuid(200 + i), createdAt: NOW, updatedAt: NOW }) as Category);
const groceries = categories.find((c) => c.defaultKey === "spesa")!;
const transfer = categories.find((c) => c.type === "trasferimento")!;
const salary = categories.find((c) => c.type === "entrata")!;

let seq = 0;
const tx = (date: string, amount: number, categoryId = groceries.id, excludedAmount = 0): Transaction =>
  ({ id: uuid(1000 + seq++), userId: "u", accountId: uuid(1), categoryId, description: "x", rawDescription: null, note: null, amount: amount.toFixed(2), excludedAmount: excludedAmount.toFixed(2), date, source: "manuale", createdAt: NOW, updatedAt: NOW }) as Transaction;
const budget = (amount: number, extra: Partial<Budget> = {}): Budget =>
  ({ id: uuid(300), userId: "u", categoryId: groceries.id, monthlyAmount: amount.toFixed(2), rollover: false, rolloverFrom: null, createdAt: NOW, updatedAt: NOW, ...extra }) as Budget;

/** Three months before October with 100 spent by the 5th: the usual at mid-month is 100. */
const history = [tx("2026-09-05", -100), tx("2026-08-05", -100), tx("2026-07-05", -100)];

const build = (extra: Partial<WidgetSpendingInputs>) =>
  widgetSpendingSchema.parse(
    buildWidgetSpending({
      today: new Date(2026, 9, 14),
      now: NOW,
      currency: "EUR",
      language: "it",
      hideAmounts: false,
      transactions: [],
      categories,
      budgets: [],
      budgetMonths: [],
      lastMovement: null,
      ...extra,
    }),
  );

describe("buildWidgetSpending", () => {
  it("splits today, the week from Monday and the month, with split amounts and transfers left out", () => {
    const view = build({
      transactions: [
        tx("2026-10-14", -20),
        tx("2026-10-14", -40, groceries.id, -10), // «Dividi»: 30 is the user's
        tx("2026-10-14", -500, transfer.id, -500), // transfer: excluded in full
        tx("2026-10-12", -15), // Monday
        tx("2026-10-11", -7), // Sunday before: not this week
        tx("2026-10-01", -100),
        tx("2026-10-14", 2000, salary.id), // income is not spending
        tx("2026-10-20", -60), // after today: not spent yet
        ...history,
      ],
    });
    expect(view.today).toEqual({ date: "2026-10-14", spent: 50 });
    expect(view.week).toEqual({ from: "2026-10-12", spent: 65 });
    expect(view.month).toMatchObject({ key: "2026-10", label: "ottobre", spent: 172, typicalSoFar: 100, gap: 72, tone: "neg" });
    expect(view.generatedAt).toBe("2026-10-14T10:30:00.000Z");
  });

  it("starts the week on Monday, also across the month boundary and on Sundays", () => {
    const transactions = [tx("2026-09-28", -10), tx("2026-09-30", -5), tx("2026-10-01", -1)];
    const thursday = build({ today: new Date(2026, 9, 1), transactions });
    expect(thursday.week).toEqual({ from: "2026-09-28", spent: 16 });
    expect(thursday.month).toMatchObject({ key: "2026-10", spent: 1 });
    expect(thursday.today.spent).toBe(1);
    expect(build({ today: new Date(2026, 9, 18) }).week.from).toBe("2026-10-12");
    expect(build({ today: new Date(2026, 9, 12) }).week.from).toBe("2026-10-12");
  });

  it("localizes the month name in lower case", () => {
    expect(build({ language: "en" }).month.label).toBe("october");
    expect(build({ language: "de" }).month.label).toBe("oktober");
  });

  it("tone: null within ±5% of the usual (at least 1 unit), neg above, pos below", () => {
    const month = (spent: number, past = history) => build({ transactions: [tx("2026-10-02", -spent), ...past] }).month;
    expect(month(104)).toMatchObject({ gap: 4, tone: null });
    expect(month(106)).toMatchObject({ gap: 6, tone: "neg" });
    expect(month(80)).toMatchObject({ gap: -20, tone: "pos" });
    const small = [tx("2026-09-05", -10)];
    expect(month(10.9, small)).toMatchObject({ typicalSoFar: 10, tone: null });
    expect(month(11.5, small)).toMatchObject({ tone: "neg" });
  });

  it("without history: no typical, gap or tone", () => {
    expect(build({ transactions: [tx("2026-10-02", -30)] }).month).toMatchObject({ spent: 30, typicalSoFar: null, gap: null, tone: null });
  });

  it("no movements at all: zeros, no budget, no last movement", () => {
    const view = build({});
    expect(view).toMatchObject({ today: { spent: 0 }, week: { spent: 0 }, month: { spent: 0, typicalSoFar: null, gap: null, tone: null }, budget: null, lastMovement: null });
  });

  it("budget: available, left, per day to the month's end and progress", () => {
    const view = build({ transactions: [tx("2026-10-02", -120)], budgets: [budget(200)] });
    // 14 October: 18 days left, today included.
    expect(view.budget).toEqual({ available: 200, spent: 120, left: 80, perDay: 4.44, progress: 0.6 });
  });

  it("budget: carried leftover and one-month amounts, as Liquidità · Budget", () => {
    const months: BudgetMonth[] = [{ id: uuid(400), userId: "u", categoryId: groceries.id, month: "2026-10", amount: "250.00", singleMonth: true, createdAt: NOW }];
    const view = build({ transactions: [tx("2026-09-05", -150), tx("2026-10-02", -100)], budgets: [budget(200, { rollover: true, rolloverFrom: "2026-09" })], budgetMonths: months });
    // 250 this month only + 50 left in September.
    expect(view.budget).toMatchObject({ available: 300, spent: 100, left: 200 });
  });

  it("budget: over budget has a negative left, no per-day amount and progress above 1", () => {
    expect(build({ transactions: [tx("2026-10-02", -250)], budgets: [budget(200)] }).budget).toEqual({ available: 200, spent: 250, left: -50, perDay: null, progress: 1.25 });
    expect(build({ transactions: [tx("2026-10-02", -200)], budgets: [budget(200)] }).budget).toMatchObject({ left: 0, perDay: null, progress: 1 });
  });

  it("budget: null when the only budget is on a category that no longer counts", () => {
    expect(build({ budgets: [budget(200, { categoryId: uuid(999) })] }).budget).toBeNull();
  });

  it("passes hideAmounts and the currency through", () => {
    expect(build({ hideAmounts: true, currency: "CHF" })).toMatchObject({ hideAmounts: true, currency: "CHF" });
  });

  it("last movement: signed amount, cleaned name or null, logo path", () => {
    const row = { id: uuid(5), date: "2026-10-13", amount: "-18.40", description: "Esselunga", logoPath: "/api/merchant-logos/esselunga.it" };
    expect(build({ lastMovement: row }).lastMovement).toEqual({ id: uuid(5), date: "2026-10-13", amount: -18.4, merchant: "Esselunga", logoUrl: "/api/merchant-logos/esselunga.it" });
    expect(build({ lastMovement: { ...row, amount: "2000.00", description: "  ", logoPath: null } }).lastMovement).toMatchObject({ amount: 2000, merchant: null, logoUrl: null });
  });
});
