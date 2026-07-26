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
  icon: string; // Es. Lucide Icons
  color: string;
  isFallback?: boolean;
}[] = [
  // --- SPESE FISSE (I tuoi impegni mensili/annuali) ---
  { name: "Affitto & Mutuo", type: "fissa", icon: "home", color: "slate" },
  { name: "Bollette & Utenze", type: "fissa", icon: "zap", color: "yellow" },
  { name: "Abbonamenti", type: "fissa", icon: "tv", color: "purple" },
  { name: "Assicurazioni & Tasse", type: "fissa", icon: "shield", color: "indigo" },
  { name: "Risparmi & Investimenti", type: "fissa", icon: "piggy-bank", color: "emerald" },

  // --- NECESSITÀ VARIABILI (Devi farle, ma l'importo cambia) ---
  { name: "Spesa alimentare", type: "variabile", icon: "shopping-cart", color: "green" },
  { name: "Trasporti & Auto", type: "variabile", icon: "car", color: "blue" },
  { name: "Salute & Cura", type: "variabile", icon: "heart", color: "rose" },

  // --- STILE DI VITA (Discrezionali, dove puoi tagliare se serve) ---
  { name: "Ristoranti & Bar", type: "variabile", icon: "utensils", color: "orange" },
  { name: "Shopping", type: "variabile", icon: "shopping-bag", color: "pink" },
  { name: "Svago & Hobbies", type: "variabile", icon: "smile", color: "teal" },
  { name: "Viaggi", type: "variabile", icon: "plane", color: "cyan" },
  { name: "Regali", type: "variabile", icon: "gift", color: "fuchsia" },

  // --- GESTIONE EMERGENZE E FALLBACK ---
  { name: "Imprevisti", type: "variabile", icon: "alert-triangle", color: "amber" },
  { name: "Da categorizzare", type: "variabile", icon: "help-circle", color: "slate", isFallback: true },
];
