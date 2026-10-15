import { integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { authUser } from "./auth";

/** Versioned financial planning documents, isolated by owner and product country. */
export const financialPlans = pgTable("financial_plans", {
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  country: text("country").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  revision: integer("revision").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.userId, table.country] })]);
