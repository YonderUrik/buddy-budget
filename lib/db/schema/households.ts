import { boolean, date, index, numeric, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";
import { authUser } from "./auth";
import { categories } from "./categories";
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

/**
 * One person in a group. `userId` null = someone without a BuddyBudget account, added by name («Luca») so the group
 * can split expenses with them; an invitation tied to the row lets them take that place later, with what was already
 * written for them. Slots (avatar colours) follow `createdAt`.
 */
export const householdMembers = pgTable(
  "household_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => authUser.id, { onDelete: "cascade" }),
    /** Name given by whoever added a person without an account: user text, encrypted. Unused once `userId` is set. */
    displayName: encryptedText("display_name"),
    /** The others see this member's net worth total (one number, never the detail). */
    sharesNetWorth: boolean("shares_net_worth").notNull().default(false),
    addedBy: text("added_by").references(() => authUser.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** When the person joined with their account; null while they are only a name. */
    joinedAt: timestamp("joined_at", { withTimezone: true }),
  },
  (table) => [
    unique("household_members_household_user_unique").on(table.householdId, table.userId),
    index("household_members_user_idx").on(table.userId),
    index("household_members_household_idx").on(table.householdId),
  ]
);

/**
 * An invitation link for one person added by name (`memberId`): accepting it gives them that place. Only the SHA-256
 * of the token is stored, so a database read cannot be turned into a link. `email` is where it was sent (null for a
 * link shared by hand).
 */
export const householdInvites = pgTable(
  "household_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "cascade" }),
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
 * The owner's explicit choice on one expense: shared with a group, or `householdId` null for «solo mia» (which also
 * overrides a merchant rule). `forMemberIds` = who it was for, in equal parts (null = everyone in the group; only
 * someone else = paid entirely for them). Without a row, a rule may still share it.
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
    forMemberIds: uuid("for_member_ids").array(),
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
    /** Who the merchant's expenses are for (null = everyone), as on `household_splits`. */
    forMemberIds: uuid("for_member_ids").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("household_split_rules_user_merchant_unique").on(table.userId, table.merchantKey)]
);

/**
 * An expense written directly in the group («Aggiungi una spesa»), not from anyone's bank: who paid it can be any
 * member, also one without an account (Luca paid the dinner). Any member can change or delete it.
 */
export const householdExpenses = pgTable(
  "household_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    paidByMemberId: uuid("paid_by_member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    description: encryptedText("description").notNull(),
    date: date("date").notNull(),
    /** One of the creator's categories, for the icon and the month's spending; null = «Altro». */
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    /** Who it was for, in equal parts (null = everyone). */
    forMemberIds: uuid("for_member_ids").array(),
    createdBy: text("created_by").references(() => authUser.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("household_expenses_household_idx").on(table.householdId, table.date)]
);

/** A payment between two members that evens out the group («Pareggiate» writes the fewest needed). */
export const householdSettlements = pgTable(
  "household_settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    fromMemberId: uuid("from_member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "cascade" }),
    toMemberId: uuid("to_member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "cascade" }),
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
export type HouseholdExpense = typeof householdExpenses.$inferSelect;
