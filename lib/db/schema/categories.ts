import { boolean, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { CATEGORY_TYPES } from "../../categories/groups";

export const categoryTypeEnum = pgEnum("category_type", CATEGORY_TYPES);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Stable identity for app-provided labels; null for custom categories. */
    defaultKey: text("default_key"),
    type: categoryTypeEnum("type").notNull(),
    color: text("color").notNull().default("slate"),
    icon: text("icon").notNull().default("package"),
    /** Cosa rientra nella categoria, in poche parole (facoltativa): guida per l'utente e per l'assistente. */
    description: text("description"),
    isFallback: boolean("is_fallback").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("categories_user_name_unique").on(table.userId, table.name)]
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

// Le liste di default stanno in un modulo puro (usato anche lato client nell'onboarding): qui restano riesportate.
export {
  DEFAULT_CATEGORIES,
  LEGACY_CATEGORY_NAMES,
  OPTIONAL_DEFAULT_CATEGORIES,
  type DefaultCategory,
} from "../../categories/defaults";
