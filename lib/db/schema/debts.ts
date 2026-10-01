import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { transactions } from "./transactions";

/** Tipi di debito: text + costante invece di enum Postgres, per aggiungerne senza migrazioni. */
export const DEBT_KINDS = ["loan", "credit_line"] as const;
export type DebtKind = (typeof DEBT_KINDS)[number];

/** Come è stato aggiunto un finanziamento: da oggi, ricostruito dall'origine o fotografia della situazione di oggi. */
export const DEBT_START_MODES = ["nuovo", "origine", "fotografia"] as const;
export type DebtStartMode = (typeof DEBT_START_MODES)[number];

/**
 * `rate_change`: nuovo tasso annuo dalla data (per una linea di credito, il nuovo valore dell'indice). `balance_correction`:
 * residuo reale alla data (per una linea, saldo utilizzato). `payment`: rata pagata. `early_repayment`: estinzione
 * anticipata (importo, penale, effetto sul piano). Solo linee di credito: `draw` utilizzo, `repay` rimborso,
 * `interest_charged` interessi realmente addebitati dalla banca.
 */
export const DEBT_EVENT_TYPES = ["payment", "rate_change", "balance_correction", "early_repayment", "draw", "repay", "interest_charged"] as const;
export type DebtEventType = (typeof DEBT_EVENT_TYPES)[number];

/** Effetto di un'estinzione anticipata: rata più bassa a parità di scadenza, o stessa rata e fine anticipata. */
export const DEBT_EARLY_EFFECTS = ["reduce_installment", "reduce_duration"] as const;
export type DebtEarlyEffect = (typeof DEBT_EARLY_EFFECTS)[number];

/** Ogni quanto la banca addebita gli interessi di una linea di credito. */
export const CREDIT_LINE_FREQUENCIES = ["monthly", "quarterly"] as const;
export type CreditLineFrequency = (typeof CREDIT_LINE_FREQUENCIES)[number];

/** Base del giorno per gli interessi: 360, 365 o giorni effettivi dell'anno. */
export const CREDIT_LINE_DAY_COUNTS = ["360", "365", "actual"] as const;
export type CreditLineDayCount = (typeof CREDIT_LINE_DAY_COUNTS)[number];

/** Soglia di allerta dell'utilizzo: percentuale del fido o importo assoluto. */
export const CREDIT_LINE_ALERT_TYPES = ["percent", "amount"] as const;
export type CreditLineAlertType = (typeof CREDIT_LINE_ALERT_TYPES)[number];

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
    // Solo linee di credito (`kind = credit_line`). In questo caso `principal` è l'utilizzato iniziale, `annual_rate`
    // il valore iniziale dell'indice, `installments` vale 0 e `first_installment_date` è la data di apertura.
    creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }),
    // Spread in punti percentuali sopra l'indice (0 per un tasso fisso).
    spread: numeric("spread", { precision: 7, scale: 4 }),
    // Etichetta libera dell'indice (es. "Euribor 3M"), solo per mostrarla.
    indexLabel: text("index_label"),
    interestFrequency: text("interest_frequency").$type<CreditLineFrequency>(),
    dayCount: text("day_count").$type<CreditLineDayCount>(),
    // Se gli interessi addebitati si sommano al capitale utilizzato.
    capitalizeInterest: boolean("capitalize_interest"),
    alertThresholdType: text("alert_threshold_type").$type<CreditLineAlertType>(),
    alertThresholdValue: numeric("alert_threshold_value", { precision: 14, scale: 2 }),
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
    // Importo reale pagato (payment), residuo reale (balance_correction) o somma estinta (early_repayment).
    amount: numeric("amount", { precision: 14, scale: 2 }),
    installmentNumber: integer("installment_number"),
    // Nuovo tasso annuo in percentuale (rate_change).
    rate: numeric("rate", { precision: 7, scale: 4 }),
    // Penale pagata sull'estinzione anticipata, in euro.
    penalty: numeric("penalty", { precision: 12, scale: 2 }),
    effect: text("effect").$type<DebtEarlyEffect>(),
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
