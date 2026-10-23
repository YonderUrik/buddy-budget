import { boolean, date, index, numeric, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";
import { authUser } from "./auth";
import { encryptedText } from "./encrypted-text";
import { transactions } from "./transactions";

/**
 * Groups of people who handle money together («Gruppi» in the app: a couple, flatmates, a family). Each member keeps
 * their own account and data; a group only says what each member chose to show the others. Nothing is copied: the
 * group screens read the owners' rows through `lib/households`, which checks membership and sharing on every read.
 */
export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Name chosen by whoever created it («Noi due», «Casa Milano»): user text, encrypted like goal names. */
  name: encryptedText("name").notNull(),
  createdBy: text("created_by").references(() => authUser.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One person in a group, with what they show the others besides accounts (today only their net worth total). */
export const householdMembers = pgTable(
  "household_members",
  {
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    /** The others see this member's net worth total (one number, never the detail). */
    sharesNetWorth: boolean("shares_net_worth").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.householdId, table.userId] }), index("household_members_user_idx").on(table.userId)]
);

/**
 * An invitation link. Only the SHA-256 of the token is stored, so a database read cannot be turned into a link.
 * `email` is where it was sent (null for a link copied by hand), shown to the group as «In attesa di …».
 */
export const householdInvites = pgTable(
  "household_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    email: encryptedText("email"),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedBy: text("accepted_by").references(() => authUser.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("household_invites_token_hash_unique").on(table.tokenHash), index("household_invites_household_idx").on(table.householdId)]
);

/** An account its owner shows to a group: balance and transactions, read-only for the others. */
export const householdAccounts = pgTable(
  "household_accounts",
  {
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.householdId, table.accountId] }), index("household_accounts_user_idx").on(table.userId)]
);

/**
 * The owner's explicit choice on one expense: shared in equal parts with a group, or `householdId` null for «solo mia»
 * (which also overrides a merchant rule). Without a row, a rule may still share it (see `lib/households/splits`).
 */
export const householdSplits = pgTable(
  "household_splits",
  {
    transactionId: uuid("transaction_id")
      .primaryKey()
      .references(() => transactions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    householdId: uuid("household_id").references(() => households.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("household_splits_household_idx").on(table.householdId)]
);

/**
 * «Da ora le prossime da Esselunga»: expenses of the same merchant (key from `merchantKey`) dated from `fromDate`
 * are shared with the group without asking, unless the owner chose otherwise on one of them.
 */
export const householdSplitRules = pgTable(
  "household_split_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    merchantKey: text("merchant_key").notNull(),
    fromDate: date("from_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("household_split_rules_user_merchant_unique").on(table.userId, table.merchantKey)]
);

/** A payment between two members that evens out the group («Pareggiate» writes the fewest needed). */
export const householdSettlements = pgTable(
  "household_settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    createdBy: text("created_by").references(() => authUser.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("household_settlements_household_idx").on(table.householdId)]
);

export type Household = typeof households.$inferSelect;
export type HouseholdMember = typeof householdMembers.$inferSelect;
export type HouseholdInvite = typeof householdInvites.$inferSelect;
export type HouseholdSettlement = typeof householdSettlements.$inferSelect;
