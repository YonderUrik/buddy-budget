import { date, index, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";

/** Classi di asset del patrimonio ("debiti" ha importi negativi e non si salva: la calcola l'API dai piani dei debiti): text + costante invece di enum Postgres, per aggiungerne senza migrazioni. */
export const ASSET_CLASSES = ["liquidita", "investimenti", "debiti"] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

/** Origine di una riga: rilevata dal cron giornaliero o ricostruita dalle transazioni. */
export const SNAPSHOT_SOURCES = ["snapshot", "derivato"] as const;
export type SnapshotSource = (typeof SNAPSHOT_SOURCES)[number];

export const netWorthSnapshots = pgTable(
  "net_worth_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    assetClass: text("asset_class").$type<AssetClass>().notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    source: text("source").$type<SnapshotSource>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("net_worth_snapshots_user_date_class_unique").on(table.userId, table.date, table.assetClass),
    index("net_worth_snapshots_user_date_idx").on(table.userId, table.date),
  ]
);

export type NetWorthSnapshot = typeof netWorthSnapshots.$inferSelect;
export type NewNetWorthSnapshot = typeof netWorthSnapshots.$inferInsert;
