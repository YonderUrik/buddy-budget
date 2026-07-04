import { date, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";
import { categories } from "./categories";
import { dataSourceEnum } from "./shared";
import { authUser } from "./auth";

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    excludedAmount: numeric("excluded_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    date: date("date").notNull(),
    source: dataSourceEnum("source").notNull().default("manuale"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("transactions_user_date_idx").on(table.userId, table.date)]
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

/**
 * Verifica l'invariante del meccanismo "Dividi": la quota esclusa deve avere
 * lo stesso segno dell'importo (o essere zero) e valore assoluto non superiore.
 * Validazione solo applicativa, nessun CHECK constraint DB (per decisione di spec).
 */
export function isValidExcludedAmount(amount: number, excludedAmount: number): boolean {
  if (excludedAmount !== 0 && Math.sign(excludedAmount) !== Math.sign(amount)) {
    return false;
  }
  return Math.abs(excludedAmount) <= Math.abs(amount);
}
