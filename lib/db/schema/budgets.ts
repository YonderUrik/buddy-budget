import { numeric, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { categories } from "./categories";
import { users } from "./users";

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    monthlyAmount: numeric("monthly_amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("budgets_user_category_unique").on(table.userId, table.categoryId)]
);

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
