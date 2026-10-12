import { index, integer, numeric, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { categorySourceEnum, transactions } from "./transactions";

/**
 * Una «Ricategorizza» applicata: serve solo all'annulla. Contiene id, categorie e numeri, mai testi dei movimenti.
 * `scope` dice da dove è partita: `tutto` (il pulsante in Categorizza) o `regola` (una regola applicata anche al passato).
 */
export const categorizationRuns = pgTable(
  "categorization_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    scope: text("scope", { enum: ["tutto", "regola"] }).notNull(),
    changed: integer("changed").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    undoneAt: timestamp("undone_at", { withTimezone: true }),
  },
  (table) => [index("categorization_runs_user_idx").on(table.userId, table.createdAt)]
);

/**
 * Com'era ogni movimento prima della ricategorizzazione. L'annulla rimette questi valori solo se il movimento ha ancora
 * la categoria e il momento scritti dalla ricategorizzazione (`appliedAt`): una scelta fatta dopo dall'utente resta.
 */
export const categorizationRunItems = pgTable(
  "categorization_run_items",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => categorizationRuns.id, { onDelete: "cascade" }),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    previousCategoryId: uuid("previous_category_id").notNull(),
    previousExcludedAmount: numeric("previous_excluded_amount", { precision: 12, scale: 2 }).notNull(),
    previousSource: categorySourceEnum("previous_source"),
    previousConfidence: numeric("previous_confidence", { precision: 5, scale: 4 }),
    previousCategorizedAt: timestamp("previous_categorized_at", { withTimezone: true }),
    newCategoryId: uuid("new_category_id").notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.runId, table.transactionId] })]
);

export type CategorizationRun = typeof categorizationRuns.$inferSelect;
