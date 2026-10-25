import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { accounts } from "./accounts";

/** Direct TR cash connection; session is always AES-GCM encrypted before persistence, never a PIN. */
export const tradeRepublicConnections = pgTable("trade_republic_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  externalAccountHash: text("external_account_hash").notNull(),
  session: text("session").notNull(),
  status: text("status").$type<"linked" | "expired">().notNull().default("linked"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("trade_republic_connections_user_external_unique").on(t.userId, t.externalAccountHash)]);
