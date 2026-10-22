import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { budgetMonths, budgets, type Budget, type BudgetMonth } from "@/lib/db/schema/budgets";
import type { Category } from "@/lib/db/schema/categories";
import { defaultRollover, monthKey } from "@/lib/calc/budget-plan";

type Writer = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** What a save may change: the standing amount, rollover, and the amount of one month only (null removes it). */
export interface BudgetChange {
  monthlyAmount?: number;
  rollover?: boolean;
  singleMonth?: { month: string; amount: number | null };
}

export type SaveBudgetResult =
  | { ok: true; budget: Budget; created: boolean }
  | { ok: false; reason: "budget_not_found" | "past_month" };

/** Month amounts of all the user's budgets (history and single months). */
export function loadBudgetMonths(userId: string): Promise<BudgetMonth[]> {
  return db.select().from(budgetMonths).where(eq(budgetMonths.userId, userId));
}

/**
 * Changes the standing amount from the current month on. The first change of a budget also writes the amount it had
 * since it was created, so past months (and the leftover carried from them) keep their own amount.
 */
async function changeStandingAmount(tx: Writer, existing: Budget, amount: number, current: string) {
  const rows = await tx
    .select({ month: budgetMonths.month })
    .from(budgetMonths)
    .where(and(eq(budgetMonths.userId, existing.userId), eq(budgetMonths.categoryId, existing.categoryId), eq(budgetMonths.singleMonth, false)));
  const createdMonth = monthKey(existing.createdAt);
  if (rows.length === 0 && createdMonth < current) {
    await tx.insert(budgetMonths).values({ userId: existing.userId, categoryId: existing.categoryId, month: createdMonth, amount: existing.monthlyAmount, singleMonth: false }).onConflictDoNothing();
  }
  if (rows.length > 0 || createdMonth < current) {
    await tx
      .insert(budgetMonths)
      .values({ userId: existing.userId, categoryId: existing.categoryId, month: current, amount: amount.toFixed(2), singleMonth: false })
      .onConflictDoUpdate({ target: [budgetMonths.userId, budgetMonths.categoryId, budgetMonths.month, budgetMonths.singleMonth], set: { amount: amount.toFixed(2) } });
  }
}

/**
 * Creates or changes the budget of one of the user's categories (ownership checked by the caller). A new budget takes
 * the rollover the app proposes for its group (on for Saltuarie) unless the change says otherwise; switching rollover
 * on starts carrying from the current month, so it never rewrites the past. Single-month amounts are only for the
 * current month or later.
 */
export async function saveBudget(userId: string, category: Pick<Category, "id" | "type">, change: BudgetChange, today: Date): Promise<SaveBudgetResult> {
  const current = monthKey(today);
  if (change.singleMonth && change.singleMonth.month < current) return { ok: false, reason: "past_month" };
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(budgets).where(and(eq(budgets.userId, userId), eq(budgets.categoryId, category.id))).for("update");
    let budget = existing;
    let created = false;
    if (!existing) {
      if (change.monthlyAmount === undefined) return { ok: false, reason: "budget_not_found" } as const;
      const rollover = change.rollover ?? defaultRollover(category);
      [budget] = await tx
        .insert(budgets)
        .values({ userId, categoryId: category.id, monthlyAmount: change.monthlyAmount.toFixed(2), rollover, rolloverFrom: rollover ? current : null })
        .returning();
      created = true;
    } else {
      const set: Partial<Budget> = {};
      if (change.monthlyAmount !== undefined && Number(existing.monthlyAmount) !== change.monthlyAmount) {
        await changeStandingAmount(tx, existing, change.monthlyAmount, current);
        set.monthlyAmount = change.monthlyAmount.toFixed(2);
      }
      if (change.rollover !== undefined && change.rollover !== existing.rollover) {
        set.rollover = change.rollover;
        set.rolloverFrom = change.rollover ? current : null;
      }
      if (Object.keys(set).length > 0) {
        [budget] = await tx.update(budgets).set({ ...set, updatedAt: new Date() }).where(eq(budgets.id, existing.id)).returning();
      }
    }
    if (change.singleMonth) {
      const where = and(eq(budgetMonths.userId, userId), eq(budgetMonths.categoryId, category.id), eq(budgetMonths.month, change.singleMonth.month), eq(budgetMonths.singleMonth, true));
      if (change.singleMonth.amount === null) {
        await tx.delete(budgetMonths).where(where);
      } else {
        const amount = change.singleMonth.amount.toFixed(2);
        await tx
          .insert(budgetMonths)
          .values({ userId, categoryId: category.id, month: change.singleMonth.month, amount, singleMonth: true })
          .onConflictDoUpdate({ target: [budgetMonths.userId, budgetMonths.categoryId, budgetMonths.month, budgetMonths.singleMonth], set: { amount } });
      }
    }
    return { ok: true, budget, created } as const;
  });
}

/** Removes a category's budget and its month amounts. Returns how many budgets were removed (0 or 1). */
export async function removeBudget(userId: string, categoryId: string): Promise<number> {
  return db.transaction(async (tx) => {
    await tx.delete(budgetMonths).where(and(eq(budgetMonths.userId, userId), eq(budgetMonths.categoryId, categoryId)));
    const removed = await tx.delete(budgets).where(and(eq(budgets.userId, userId), eq(budgets.categoryId, categoryId))).returning({ id: budgets.id });
    return removed.length;
  });
}

/**
 * Creates the budgets the user accepted from the proposals in one go. Categories that meanwhile got a budget are left
 * as they are (the proposal never overwrites a choice); returns how many were created.
 */
export async function createBudgets(userId: string, items: { categoryId: string; amount: number; rollover: boolean }[], today: Date): Promise<number> {
  if (items.length === 0) return 0;
  const current = monthKey(today);
  const created = await db
    .insert(budgets)
    .values(items.map((item) => ({ userId, categoryId: item.categoryId, monthlyAmount: item.amount.toFixed(2), rollover: item.rollover, rolloverFrom: item.rollover ? current : null })))
    .onConflictDoNothing({ target: [budgets.userId, budgets.categoryId] })
    .returning({ id: budgets.id });
  return created.length;
}
