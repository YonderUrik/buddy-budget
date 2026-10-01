import { sql } from "drizzle-orm";
import { date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { transactions } from "./transactions";

/** Tipi di debito: text + costante invece di enum Postgres, per aggiungerne senza migrazioni. `credit_line` arriva nella Fase 3. */
export const DEBT_KINDS = ["loan", "credit_line"] as const;
export type DebtKind = (typeof DEBT_KINDS)[number];

/** Come è stato aggiunto un finanziamento: da oggi, ricostruito dall'origine o fotografia della situazione di oggi. */
export const DEBT_START_MODES = ["nuovo", "origine", "fotografia"] as const;
export type DebtStartMode = (typeof DEBT_START_MODES)[number];

/** `rate_change`: nuovo tasso annuo dalla data. `balance_correction`: residuo reale alla data. `payment`: rata pagata. */
export const DEBT_EVENT_TYPES = ["payment", "rate_change", "balance_correction"] as const;
export type DebtEventType = (typeof DEBT_EVENT_TYPES)[number];

/** Spesa accessoria di un finanziamento (istruttoria, assicurazione, incasso rata), decisa dall'utente. */
export interface DebtCost {
  label: string;
  amount: number;
  kind: "una_tantum" | "per_rata";
}

export const debts = pgTable(
  "debts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    kind: text("kind").$type<DebtKind>().notNull().default("loan"),
    name: text("name").notNull(),
    startMode: text("start_mode").$type<DebtStartMode>().notNull(),
    // Capitale erogato (nuovo/origine) o residuo attuale (fotografia).
    principal: numeric("principal", { precision: 14, scale: 2 }).notNull(),
    // TAN annuo in percentuale.
    annualRate: numeric("annual_rate", { precision: 7, scale: 4 }).notNull(),
    // Rate totali (nuovo/origine) o rimanenti (fotografia).
    installments: integer("installments").notNull(),
    // Scadenza della prima rata (nuovo/origine) o della prossima (fotografia).
    firstInstallmentDate: date("first_installment_date").notNull(),
    // Rata dichiarata dall'utente: se assente vale quella calcolata.
    installment: numeric("installment", { precision: 12, scale: 2 }),
    // Data in cui l'utente ha fotografato la situazione (solo modalità fotografia).
    anchorDate: date("anchor_date"),
    costs: jsonb("costs").$type<DebtCost[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("debts_user_idx").on(table.userId)]
);

export const debtEvents = pgTable(
  "debt_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    debtId: uuid("debt_id")
      .notNull()
      .references(() => debts.id, { onDelete: "cascade" }),
    // Duplicato dal debito: serve a filtrare e pulire per utente senza join.
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    type: text("type").$type<DebtEventType>().notNull(),
    date: date("date").notNull(),
    // Importo reale pagato (payment) o residuo reale (balance_correction).
    amount: numeric("amount", { precision: 14, scale: 2 }),
    installmentNumber: integer("installment_number"),
    // Nuovo tasso annuo in percentuale (rate_change).
    rate: numeric("rate", { precision: 7, scale: 4 }),
    // Transazione collegata a mano dall'utente (facoltativa): nessun automatismo.
    transactionId: uuid("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("debt_events_debt_idx").on(table.debtId),
    index("debt_events_user_idx").on(table.userId),
    // Una sola rata pagata per numero di rata e debito.
    uniqueIndex("debt_events_payment_unique")
      .on(table.debtId, table.installmentNumber)
      .where(sql`${table.type} = 'payment'`),
  ]
);

export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;
export type DebtEvent = typeof debtEvents.$inferSelect;
export type NewDebtEvent = typeof debtEvents.$inferInsert;
