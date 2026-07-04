import { numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { dataSourceEnum } from "./shared";
import { users } from "./users";

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  institution: text("institution"),
  type: text("type").notNull(),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  source: dataSourceEnum("source").notNull().default("manuale"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
