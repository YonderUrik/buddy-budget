import { sql } from "drizzle-orm";
import { check, date, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { GOAL_KINDS, type GoalKind } from "@/lib/goals/constants";
import { accounts } from "./accounts";
import { authUser } from "./auth";
import { encryptedText } from "./encrypted-text";
import { instruments } from "./investments";

export { GOAL_KINDS, type GoalKind };

/**
 * Obiettivi di risparmio. Il progresso non si salva: è la somma delle parti di conti e titoli assegnate
 * (`goal_sources`), lette ai saldi e ai prezzi di oggi. `priority` decide chi riceve per primo il risparmio del mese.
 */
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    name: encryptedText("name").notNull(),
    kind: text("kind").$type<GoalKind>().notNull(),
    targetAmount: numeric("target_amount", { precision: 14, scale: 2 }).notNull(),
    /** Mese entro cui arrivarci (primo giorno del mese); null = nessuna data. */
    targetDate: date("target_date"),
    /** Quanto l'utente vuole metterci ogni mese. */
    monthlyAmount: numeric("monthly_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    priority: integer("priority").notNull().default(0),
    /** Segnato come raggiunto (e quindi fuori dal piano del risparmio). */
    achievedAt: timestamp("achieved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("goals_user_idx").on(table.userId)]
);

/** Parte di un conto o di un titolo assegnata a un obiettivo: un'etichetta, i saldi veri non cambiano. */
export const goalSources = pgTable(
  "goal_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id").references(() => instruments.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("goal_sources_user_idx").on(table.userId),
    uniqueIndex("goal_sources_goal_account_unique").on(table.goalId, table.accountId).where(sql`${table.accountId} is not null`),
    uniqueIndex("goal_sources_goal_instrument_unique").on(table.goalId, table.instrumentId).where(sql`${table.instrumentId} is not null`),
    check("goal_sources_one_target", sql`(${table.accountId} is null) <> (${table.instrumentId} is null)`),
  ]
);

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type GoalSource = typeof goalSources.$inferSelect;
