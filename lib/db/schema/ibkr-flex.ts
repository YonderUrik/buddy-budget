import { date, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";

/** Why the last sync of an IBKR Flex connection failed (closed enum, shown to the user and logged). */
export type IbkrFlexConnectionError =
  | "token_expired" | "token_invalid" | "query_invalid" | "ip_restricted" | "account_inactive"
  | "rate_limited" | "unavailable" | "timeout" | "invalid_response" | "too_large"
  | "missing_sections" | "date_format" | "multiple_accounts" | "account_changed"
  | "import_refused" | "internal";

/**
 * A read-only Interactive Brokers connection through the Flex Web Service: a Flex token and a query id, nothing else
 * (never a username or password). The token is AES-GCM encrypted before it is stored and never leaves the server.
 * Imported data lives where statement imports put it (`broker_statements`, `investment_transactions`, the broker
 * cash account), under the same `account_key` as the account's CSV statements, so both sources share one history.
 */
export const ibkrFlexConnections = pgTable("ibkr_flex_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  /** Same key as the statement import (`sha256` of the IBKR account id), never the id itself. */
  accountKey: text("account_key").notNull(),
  /** Last four characters of the IBKR account id, to tell connections apart in the UI. */
  accountLabel: text("account_label").notNull(),
  /** Encrypted Flex token; emptied when IBKR reports it expired or invalid. */
  token: text("token").notNull(),
  queryId: text("query_id").notNull(),
  baseCurrency: text("base_currency").notNull(),
  /** Account opening date from the report: where the first import starts. */
  dateOpened: date("date_opened"),
  status: text("status").$type<"linked" | "expired" | "error">().notNull().default("linked"),
  lastError: text("last_error").$type<IbkrFlexConnectionError>(),
  /** The import's own refusal message (e.g. a position that does not reconcile): shown to the user, never logged. */
  lastErrorDetail: text("last_error_detail"),
  /** Last day covered by an imported report. */
  syncedThrough: date("synced_through"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  /** Consecutive failed automatic syncs; drives the backoff of `nextAttemptAt`. */
  failures: integer("failures").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("ibkr_flex_connections_user_account_unique").on(t.userId, t.accountKey),
  index("ibkr_flex_connections_due_idx").on(t.status, t.nextAttemptAt),
]);

export type IbkrFlexConnection = typeof ibkrFlexConnections.$inferSelect;
