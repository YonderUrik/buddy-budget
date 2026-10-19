import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";

/**
 * Billing (Free and Pro plans, `lib/billing`). Stripe holds cards, invoices and the subscription itself: here we keep
 * only the ids that link a Stripe customer to a user, the subscription fields the access check needs, the free Pro
 * grants (tester, launch, access code) and the processed webhook events. No card data, no amounts.
 * The result of all of it is denormalised on `auth_user.pro_until`, which the proxy reads with the session.
 */

/** Stripe subscription statuses (`Stripe.Subscription.Status`), stored as Stripe sends them. */
export const BILLING_SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "paused",
] as const;
export type BillingSubscriptionStatus = (typeof BILLING_SUBSCRIPTION_STATUSES)[number];

/** Billing interval of a Pro price. */
export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/** Why a free Pro grant exists: given by hand (tester, friend), to every account at launch, or from an access code. */
export const BILLING_GRANT_SOURCES = ["admin", "launch", "code"] as const;
export type BillingGrantSource = (typeof BILLING_GRANT_SOURCES)[number];

/** One Stripe customer per user, created at the first checkout. `trialUsedAt` makes the free trial once per user. */
export const billingCustomers = pgTable("billing_customers", {
  userId: text("user_id")
    .primaryKey()
    .references(() => authUser.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  /** When this user started a Pro trial (any subscription with a trial): no second trial after that. */
  trialUsedAt: timestamp("trial_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Stripe subscriptions of a user (one row each, kept after they end), refreshed from Stripe at every webhook. */
export const billingSubscriptions = pgTable(
  "billing_subscriptions",
  {
    stripeSubscriptionId: text("stripe_subscription_id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    status: text("status", { enum: BILLING_SUBSCRIPTION_STATUSES }).notNull(),
    interval: text("interval", { enum: BILLING_INTERVALS }).notNull(),
    /** End of the period already paid (or of the trial): access lasts until then. */
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    trialEnd: timestamp("trial_end", { withTimezone: true }),
    /** The user cancelled: Pro stays until `currentPeriodEnd`, then the subscription ends. */
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("billing_subscriptions_user_idx").on(table.userId)]
);

/** Access codes handed out by hand (`pnpm billing:code`): each gives Pro for `durationDays` (null = for good). */
export const billingAccessCodes = pgTable("billing_access_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** SHA-256 of the normalised code: the code itself is shown once, when it is created, and never stored. */
  codeHash: text("code_hash").notNull().unique(),
  /** What the code is for, e.g. «tester ottobre» (written by the owner, never shown to users). */
  label: text("label").notNull(),
  durationDays: integer("duration_days"),
  maxRedemptions: integer("max_redemptions").notNull().default(1),
  redemptions: integer("redemptions").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Free Pro for a user: from the owner, from the launch of the paid plan, or from an access code. */
export const billingGrants = pgTable(
  "billing_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    source: text("source", { enum: BILLING_GRANT_SOURCES }).notNull(),
    /** Short note from the owner («tester», «lancio»): never shown to users, never in logs. */
    note: text("note").notNull().default(""),
    accessCodeId: uuid("access_code_id").references(() => billingAccessCodes.id, { onDelete: "set null" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    /** Null = Pro for good. */
    endsAt: timestamp("ends_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("billing_grants_user_idx").on(table.userId)]
);

/** Stripe webhook events already processed (Stripe can deliver one more than once). Only id and type. */
export const billingStripeEvents = pgTable("billing_stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BillingSubscriptionRow = typeof billingSubscriptions.$inferSelect;
export type BillingGrantRow = typeof billingGrants.$inferSelect;
