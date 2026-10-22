import { boolean, index, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { categories } from "./categories";
import { authUser } from "./auth";

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    /** The amount that repeats every month from now on (the past is in `budget_months`). */
    monthlyAmount: numeric("monthly_amount", { precision: 12, scale: 2 }).notNull(),
    /** Leftover (or overspending) carries to the next month. */
    rollover: boolean("rollover").notNull().default(false),
    /** First month (`YYYY-MM`) whose leftover is carried; set when rollover is switched on, so turning it on never rewrites the past. */
    rolloverFrom: text("rollover_from"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("budgets_user_category_unique").on(table.userId, table.categoryId)]
);

/**
 * Month-by-month amounts of a budget. A standing row (`singleMonth = false`) applies from its month until the next
 * standing row, so changing the budget today does not rewrite past months (and the leftover carried from them);
 * a single-month row («Cifra diversa solo a dicembre») replaces the amount of that month only.
 */
export const budgetMonths = pgTable(
  "budget_months",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    /** `YYYY-MM`. */
    month: text("month").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    singleMonth: boolean("single_month").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("budget_months_user_category_month_kind_unique").on(table.userId, table.categoryId, table.month, table.singleMonth),
    index("budget_months_user_idx").on(table.userId),
  ]
);

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type BudgetMonth = typeof budgetMonths.$inferSelect;
export type NewBudgetMonth = typeof budgetMonths.$inferInsert;
