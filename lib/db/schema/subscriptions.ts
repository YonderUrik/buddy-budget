import { date, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { categories } from "./categories";

/** Scelte che l'utente può fare su un abbonamento: `confermato` lo conta, `escluso` lo nasconde, `terminato` lo archivia. */
export const SUBSCRIPTION_STATUSES = ["confermato", "escluso", "terminato"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * Scelte dell'utente sugli abbonamenti. Il rilevamento è calcolato al volo dalle transazioni e non si salva: qui restano
 * solo le decisioni (conferma, esclusione, abbonamento terminato) e gli abbonamenti aggiunti a mano, agganciati alle
 * transazioni tramite `key` (vedi `subscriptionKey` in lib/calc/subscriptions.ts). Gli importi sono nella valuta dell'utente.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    status: text("status", { enum: SUBSCRIPTION_STATUSES }).notNull().default("confermato"),
    /** `manuale`: aggiunto dall'utente; `rilevato`: nato da una conferma del rilevamento. */
    origin: text("origin", { enum: ["rilevato", "manuale"] }).notNull(),
    /** Nome scelto dall'utente; se nullo si usa quello letto dalle transazioni. */
    name: text("name"),
    /** Importo e cadenza dichiarati: usati solo per gli abbonamenti manuali senza addebiti ancora trovati. */
    amount: numeric("amount", { precision: 12, scale: 2 }),
    cadence: text("cadence", { enum: ["settimanale", "mensile", "trimestrale", "semestrale", "annuale"] }),
    /** Data del prossimo addebito dichiarata dall'utente (abbonamenti manuali). */
    nextDate: date("next_date"),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("subscriptions_user_key_unique").on(table.userId, table.key)]
);

export type StoredSubscription = typeof subscriptions.$inferSelect;
export type NewStoredSubscription = typeof subscriptions.$inferInsert;
