import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { accounts } from "./accounts";

export const bankConnectionStatusEnum = pgEnum("bank_connection_status", [
  "pending",
  "linked",
  "expired",
  "error",
]);

export const bankConnections = pgTable("bank_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => authUser.id, { onDelete: "cascade" }),
  institutionId: text("institution_id").notNull(),
  institutionName: text("institution_name").notNull(),
  // Nullable: nasce nulla quando la connessione è "pending" (creata prima ancora
  // di aver chiamato GoCardless), valorizzata subito dopo dalla stessa richiesta.
  requisitionId: text("requisition_id"),
  status: bankConnectionStatusEnum("status").notNull().default("pending"),
  consentExpiresAt: timestamp("consent_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BankConnection = typeof bankConnections.$inferSelect;
export type NewBankConnection = typeof bankConnections.$inferInsert;

export const bankAccountLinks = pgTable("bank_account_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectionId: uuid("connection_id")
    .notNull()
    .references(() => bankConnections.id, { onDelete: "cascade" }),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  externalAccountId: text("external_account_id").notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  nextSyncEligibleAt: timestamp("next_sync_eligible_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type BankAccountLink = typeof bankAccountLinks.$inferSelect;
export type NewBankAccountLink = typeof bankAccountLinks.$inferInsert;

/** Singola riga: cache dell'access token applicativo GoCardless (non è per-utente). */
export const gocardlessToken = pgTable("gocardless_token", {
  id: text("id").primaryKey(),
  accessToken: text("access_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type GoCardlessToken = typeof gocardlessToken.$inferSelect;
