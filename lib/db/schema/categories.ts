import { boolean, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";

export const categoryTypeEnum = pgEnum("category_type", ["fissa", "variabile"]);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: categoryTypeEnum("type").notNull(),
    color: text("color").notNull().default("slate"),
    icon: text("icon").notNull().default("package"),
    isFallback: boolean("is_fallback").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("categories_user_name_unique").on(table.userId, table.name)]
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export const DEFAULT_CATEGORIES: {
  name: string;
  type: "fissa" | "variabile";
  icon: CategoryIcon;
  color: CategoryColor;
  isFallback?: boolean;
}[] = [
  { name: "Affitto", type: "fissa", icon: "home", color: "slate" },
  { name: "Bollette & casa", type: "fissa", icon: "zap", color: "yellow" },
  { name: "Abbonamenti", type: "fissa", icon: "tv", color: "purple" },
  { name: "Spesa alimentare", type: "variabile", icon: "shopping-cart", color: "green" },
  { name: "Ristoranti", type: "variabile", icon: "utensils", color: "orange" },
  { name: "Altro", type: "variabile", icon: "package", color: "slate" },
  { name: "Svago", type: "variabile", icon: "film", color: "teal" },
  { name: "Trasporti", type: "variabile", icon: "car", color: "blue" },
  { name: "Da categorizzare", type: "variabile", icon: "help-circle", color: "red", isFallback: true },
];
