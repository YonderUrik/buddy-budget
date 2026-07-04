import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";

export const categoryTypeEnum = pgEnum("category_type", ["fissa", "variabile"]);

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => authUser.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: categoryTypeEnum("type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export const DEFAULT_CATEGORIES: { name: string; type: "fissa" | "variabile" }[] = [
  { name: "Affitto", type: "fissa" },
  { name: "Bollette & casa", type: "fissa" },
  { name: "Abbonamenti", type: "fissa" },
  { name: "Spesa alimentare", type: "variabile" },
  { name: "Ristoranti", type: "variabile" },
  { name: "Altro", type: "variabile" },
  { name: "Svago", type: "variabile" },
  { name: "Trasporti", type: "variabile" },
];
