import { date, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import type { InvestmentTransactionType } from "@/lib/investments/constants";
import { instruments } from "./investments";

/**
 * Operations of a broker source (statement or direct connection) the user deleted one by one. Later imports of the
 * same source skip a matching operation and still reconcile its quantity against the broker's positions.
 */
export const brokerOperationExclusions = pgTable("broker_operation_exclusions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  /** `statementAccountKey` of the source the operation came from. */
  accountKey: text("account_key").notNull(),
  instrumentId: uuid("instrument_id").notNull().references(() => instruments.id, { onDelete: "cascade" }),
  type: text("type").$type<InvestmentTransactionType>().notNull(),
  date: date("date").notNull(),
  quantity: numeric("quantity", { precision: 24, scale: 10 }).notNull(),
  price: numeric("price", { precision: 20, scale: 8 }).notNull(),
  grossAmount: numeric("gross_amount", { precision: 14, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("broker_operation_exclusions_user_key_idx").on(t.userId, t.accountKey)]);

export type BrokerOperationExclusion = typeof brokerOperationExclusions.$inferSelect;
