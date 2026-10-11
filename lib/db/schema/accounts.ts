import { boolean, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { dataSourceEnum } from "./shared";
import { authUser } from "./auth";

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => authUser.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  color: text("color").notNull().default("slate"),
  icon: text("icon").notNull().default("wallet"),
  source: dataSourceEnum("source").notNull().default("manuale"),
  /** Conto di esempio creato da «Esplora con dati d'esempio»: non è un dato reale e si azzera in un tocco insieme ai suoi movimenti. */
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
