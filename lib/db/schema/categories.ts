import { boolean, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { CATEGORY_TYPES, type CategoryType } from "../../categories/groups";

export const categoryTypeEnum = pgEnum("category_type", CATEGORY_TYPES);

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
  type: CategoryType;
  icon: CategoryIcon;
  color: CategoryColor;
  isFallback?: boolean;
}[] = [
  // --- DOVUTE ---
  { name: "Affitto & Mutuo", type: "dovuta", icon: "home", color: "slate" },
  { name: "Bollette & Utenze", type: "dovuta", icon: "zap", color: "yellow" },
  { name: "Internet & Telefono", type: "dovuta", icon: "wifi", color: "cyan" },
  { name: "Spesa alimentare", type: "dovuta", icon: "shopping-cart", color: "green" },
  { name: "Trasporti & Carburante", type: "dovuta", icon: "fuel", color: "blue" },
  { name: "Salute & Farmaci", type: "dovuta", icon: "pill", color: "rose" },
  { name: "Assicurazioni", type: "dovuta", icon: "shield", color: "indigo" },
  { name: "Rate & Finanziamenti", type: "dovuta", icon: "credit-card", color: "red" },
  { name: "Figli & Istruzione", type: "dovuta", icon: "graduation-cap", color: "violet" },
  { name: "Animali domestici", type: "dovuta", icon: "paw-print", color: "amber" },

  // --- VOLUTE ---
  { name: "Ristoranti & Bar", type: "voluta", icon: "utensils", color: "orange" },
  { name: "Abbonamenti & Streaming", type: "voluta", icon: "tv", color: "purple" },
  { name: "Svago & Hobby", type: "voluta", icon: "gamepad-2", color: "teal" },
  { name: "Sport & Benessere", type: "voluta", icon: "dumbbell", color: "lime" },
  { name: "Abbigliamento", type: "voluta", icon: "shirt", color: "pink" },
  { name: "Shopping & Tecnologia", type: "voluta", icon: "laptop", color: "blue" },
  { name: "Cura personale", type: "voluta", icon: "scissors", color: "rose" },
  { name: "Viaggi & Vacanze", type: "voluta", icon: "plane", color: "cyan" },

  // --- TE FUTURO ---
  { name: "Fondo emergenza", type: "futuro", icon: "wallet", color: "emerald" },
  { name: "Risparmio per obiettivi", type: "futuro", icon: "piggy-bank", color: "green" },
  { name: "Investimenti", type: "futuro", icon: "coins", color: "teal" },
  { name: "Pensione integrativa", type: "futuro", icon: "landmark", color: "indigo" },

  // --- SALTUARIE ---
  { name: "Tasse & Bolli", type: "saltuaria", icon: "receipt", color: "slate" },
  { name: "Manutenzione auto", type: "saltuaria", icon: "wrench", color: "orange" },
  { name: "Casa & Arredamento", type: "saltuaria", icon: "sofa", color: "amber" },
  { name: "Regali & Ricorrenze", type: "saltuaria", icon: "gift", color: "pink" },
  { name: "Imprevisti", type: "saltuaria", icon: "alert-triangle", color: "yellow" },

  // --- FALLBACK (nessun gruppo reale: il type è solo un valore non-null) ---
  { name: "Da categorizzare", type: "voluta", icon: "help-circle", color: "red", isFallback: true },

  // --- ENTRATE ---
  { name: "Stipendio", type: "entrata", icon: "banknote", color: "emerald" },
  { name: "Freelance", type: "entrata", icon: "briefcase", color: "blue" },
  { name: "Dividendi e interessi", type: "entrata", icon: "trending-up", color: "teal" },
  { name: "Rimborsi", type: "entrata", icon: "calculator", color: "cyan" },
  { name: "Altre entrate", type: "entrata", icon: "package", color: "slate" },
];

/**
 * Nomi di categorie di default delle versioni precedenti → nome attuale. Usato dal reset categorie
 * per aggiornare (preservandone l'id e quindi transazioni/regole/budget) le categorie solo rinominate.
 */
export const LEGACY_CATEGORY_NAMES: Record<string, string> = {
  "Assicurazioni & Tasse": "Assicurazioni",
  "Risparmi & Investimenti": "Investimenti",
  "Trasporti & Auto": "Trasporti & Carburante",
  "Salute & Cura": "Salute & Farmaci",
  "Svago & Hobbies": "Svago & Hobby",
  "Abbonamenti": "Abbonamenti & Streaming",
  "Shopping": "Shopping & Tecnologia",
  "Viaggi": "Viaggi & Vacanze",
  "Regali": "Regali & Ricorrenze",
};
