import { index, integer, numeric, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { categories } from "./categories";

export const SUGGESTION_SOURCES = ["assistente", "utente"] as const;
export const SUGGESTION_STATUSES = ["in_attesa", "confermata", "corretta"] as const;
export const SUGGESTION_DIRECTIONS = ["entrata", "uscita"] as const;

export const suggestionSourceEnum = pgEnum("suggestion_source", SUGGESTION_SOURCES);
export const suggestionStatusEnum = pgEnum("suggestion_status", SUGGESTION_STATUSES);
export const suggestionDirectionEnum = pgEnum("suggestion_direction", SUGGESTION_DIRECTIONS);

/**
 * Proposta di categoria per un esercente (chiave `merchantKey` + direzione). **Non è una regola**: non categorizza
 * mai da sola, serve a riproporre in Categorizza la stessa categoria senza richiamare il modello. Nasce dall'assistente
 * (`in_attesa`), diventa `confermata` se l'utente la accetta o `corretta` se ne sceglie un'altra (e allora `categoryId`
 * è la sua scelta, `source` = `utente`). Contiene solo la chiave normalizzata dell'esercente, mai importi o date.
 */
export const categorizationSuggestions = pgTable(
  "categorization_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    merchantKey: text("merchant_key").notNull(),
    direction: suggestionDirectionEnum("direction").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    /** Probabilità (0-1) che il modello ha dato alla categoria; 1 se la scelta è dell'utente. */
    confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull(),
    source: suggestionSourceEnum("source").notNull().default("assistente"),
    status: suggestionStatusEnum("status").notNull().default("in_attesa"),
    /** Modello e versione del prompt che hanno prodotto la proposta (vuoti se la scelta è dell'utente). */
    model: text("model"),
    promptVersion: integer("prompt_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    unique("categorization_suggestions_user_merchant_unique").on(table.userId, table.merchantKey, table.direction),
    index("categorization_suggestions_user_idx").on(table.userId),
  ]
);

export type CategorizationSuggestionRow = typeof categorizationSuggestions.$inferSelect;
