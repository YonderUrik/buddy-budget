import { date, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";
import { authUser } from "./auth";
import { investmentPortfolios } from "./investments";
import type { BrokerStatement } from "@/lib/investments/import/broker-statement";
import type { ActivityRecord } from "@/lib/investments/import/interactive-brokers";

/** Reconciled broker documents and their native-currency ledger; not duplicate bank transactions. */
export const brokerStatements = pgTable("broker_statements", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  portfolioId: uuid("portfolio_id").notNull().references(() => investmentPortfolios.id, { onDelete: "cascade" }),
  cashAccountId: uuid("cash_account_id").references(() => accounts.id, { onDelete: "set null" }),
  accountKey: text("account_key").notNull(),
  fingerprint: text("fingerprint").notNull(),
  from: date("period_from").notNull(),
  to: date("period_to").notNull(),
  statement: jsonb("statement").$type<BrokerStatement>().notNull(),
  records: jsonb("records").$type<ActivityRecord[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("broker_statements_user_fingerprint").on(t.userId, t.fingerprint), unique("broker_statements_user_account_period").on(t.userId, t.accountKey, t.from, t.to)]);
