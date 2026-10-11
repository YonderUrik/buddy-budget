import { pgTable, jsonb, text, uuid, timestamp, integer, index, unique } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { accounts } from "./accounts";
import { investmentPortfolios } from "./investments";
export const personalFormats = pgTable("personal_formats", {
  id: uuid("id").primaryKey().defaultRandom(), userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  name: text("name").notNull(), accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }), portfolioId: uuid("portfolio_id").references(() => investmentPortfolios.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const personalParsers = pgTable("personal_parsers", {
  id: uuid("id").primaryKey().defaultRandom(), formatId: uuid("format_id").notNull().references(() => personalFormats.id, { onDelete: "cascade" }),
  signature: text("signature").notNull(), encryptedParser: text("encrypted_parser").notNull(), model: text("model").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const personalImportJobs = pgTable("personal_import_jobs", {
  id: uuid("id").primaryKey().defaultRandom(), userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  formatId: uuid("format_id").notNull().references(() => personalFormats.id, { onDelete: "cascade" }), parserId: uuid("parser_id").references(() => personalParsers.id, { onDelete: "set null" }),
  consentVersion: text("consent_version").notNull().default("openrouter-zdr-v1"),
  status: text("status").notNull().default("queued"), encryptedCsv: text("encrypted_csv"), encryptedPreview: text("encrypted_preview"),
  importLedger: jsonb("import_ledger").$type<{ cashIds: string[]; tradeIds: string[]; receiptKeys: string[] }>(),
  error: text("error"), attempts: integer("attempts").notNull().default(0), lease: uuid("lease"), leaseUntil: timestamp("lease_until", { withTimezone: true }),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  estimatedAt: timestamp("estimated_at", { withTimezone: true }).notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  notifiedAt: timestamp("notified_at", { withTimezone: true }), notifyAfter: timestamp("notify_after", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("personal_import_jobs_queue_idx").on(t.status, t.availableAt), index("personal_import_jobs_user_idx").on(t.userId)]);
export const personalImportReceipts = pgTable("personal_import_receipts", {
  id: uuid("id").primaryKey().defaultRandom(), formatId: uuid("format_id").notNull().references(() => personalFormats.id, { onDelete: "cascade" }),
  recordKey: text("record_key").notNull(), outcomeHash: text("outcome_hash").notNull(),
}, t => [unique("personal_import_receipts_record_unique").on(t.formatId, t.recordKey)]);
