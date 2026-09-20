import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { categories } from "./categories";

export const RULE_MATCH_TYPES = ["merchant", "contains"] as const;
export const RULE_SOURCES = ["appresa", "manuale"] as const;

export const ruleMatchTypeEnum = pgEnum("rule_match_type", RULE_MATCH_TYPES);
export const ruleSourceEnum = pgEnum("rule_source", RULE_SOURCES);

/**
 * Regola di categorizzazione: associa un pattern (già normalizzato con `merchantKey`) a una
 * categoria. È l'unica memoria che scrive in autonomia all'import — nasce da una conferma
 * esplicita dell'utente (`appresa`) o dalla pagina di gestione (`manuale`), mai da una deduzione.
 */
export const categorizationRules = pgTable(
  "categorization_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    matchType: ruleMatchTypeEnum("match_type").notNull(),
    // Pattern già normalizzato: confrontato con merchantKey(description), mai con il testo grezzo.
    pattern: text("pattern").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    // Quota "Dividi" da riproporre come frazione dell'importo (0-1); null = nessuno split.
    splitPercentage: numeric("split_percentage", { precision: 5, scale: 4 }),
    source: ruleSourceEnum("source").notNull().default("appresa"),
    hitCount: integer("hit_count").notNull().default(0),
    lastAppliedAt: timestamp("last_applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("categorization_rules_user_type_pattern_unique").on(
      table.userId,
      table.matchType,
      table.pattern
    ),
    index("categorization_rules_user_idx").on(table.userId),
  ]
);

export type CategorizationRule = typeof categorizationRules.$inferSelect;
export type NewCategorizationRule = typeof categorizationRules.$inferInsert;
