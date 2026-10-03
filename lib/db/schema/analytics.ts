import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { authUser } from "./auth";

/**
 * Ipotesi e preferenze della sezione Analitiche (una riga per utente). Le ipotesi stanno in un JSON validato
 * dall'applicazione (`lib/analytics/assumptions.ts`): sono parametri di calcolo che cambiano spesso e non vengono
 * mai interrogati per valore, quindi non servono colonne.
 */
export const analyticsAssumptions = pgTable("analytics_assumptions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => authUser.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  /** Quando l'utente ha completato (o chiuso) la guida iniziale; null = non l'ha ancora vista. */
  walkthroughSeenAt: timestamp("walkthrough_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AnalyticsAssumptionsRow = typeof analyticsAssumptions.$inferSelect;
export type NewAnalyticsAssumptionsRow = typeof analyticsAssumptions.$inferInsert;
