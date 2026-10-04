import { pgTable, text, uuid, unique } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { accounts } from "./accounts";
import { investmentPortfolios } from "./investments";

/** Broker source identity stays separate from the user's combined investment portfolio. */
export const brokerImportAccounts = pgTable("broker_import_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  accountKey: text("account_key").notNull(),
  provider: text("provider").notNull(),
  portfolioId: uuid("portfolio_id").notNull().references(() => investmentPortfolios.id, { onDelete: "cascade" }),
  cashAccountId: uuid("cash_account_id").references(() => accounts.id, { onDelete: "set null" }),
}, (t) => [unique("broker_import_accounts_user_key").on(t.userId, t.accountKey)]);
