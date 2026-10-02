import { date, index, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";

/**
 * Forma di previdenza complementare dell'utente (fondo pensione, PIP...). Il valore non si salva qui: vive nelle
 * fotografie (`pension_snapshots`), che l'utente inserisce leggendole nell'area clienti del fondo.
 */
export const pensionFunds = pgTable(
  "pension_funds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Data di prima adesione a una forma pensionistica (anche in un'altra azienda): decide l'aliquota in uscita.
    adhesionDate: date("adhesion_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("pension_funds_user_idx").on(table.userId)]
);

/** Fotografia di un fondo: contributi netti e controvalore letti dall'utente in una data. I versamenti si ricavano dalle differenze. */
export const pensionSnapshots = pgTable(
  "pension_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fundId: uuid("fund_id")
      .notNull()
      .references(() => pensionFunds.id, { onDelete: "cascade" }),
    // Duplicato dal fondo: serve a filtrare e pulire per utente senza join.
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    netContributions: numeric("net_contributions", { precision: 14, scale: 2 }).notNull(),
    value: numeric("value", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("pension_snapshots_fund_date_unique").on(table.fundId, table.date),
    index("pension_snapshots_user_idx").on(table.userId),
  ]
);

export type PensionFund = typeof pensionFunds.$inferSelect;
export type NewPensionFund = typeof pensionFunds.$inferInsert;
export type PensionSnapshotRow = typeof pensionSnapshots.$inferSelect;
export type NewPensionSnapshotRow = typeof pensionSnapshots.$inferInsert;
