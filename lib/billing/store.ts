import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import {
  billingCustomers,
  billingGrants,
  billingStripeEvents,
  billingSubscriptions,
  type BillingGrantRow,
  type BillingSubscriptionRow,
} from "@/lib/db/schema/billing";
import { computeEntitlement, type Entitlement } from "./entitlement";

/** Subscription as stored, without the bookkeeping columns. */
export type StoredSubscriptionInput = Omit<BillingSubscriptionRow, "createdAt" | "updatedAt">;

/** Stripe customer id of a user, with the trial flag, or null before the first checkout. */
export async function findCustomer(userId: string): Promise<{ stripeCustomerId: string; trialUsedAt: Date | null } | null> {
  const [row] = await db
    .select({ stripeCustomerId: billingCustomers.stripeCustomerId, trialUsedAt: billingCustomers.trialUsedAt })
    .from(billingCustomers)
    .where(eq(billingCustomers.userId, userId));
  return row ?? null;
}

/** Links a Stripe customer to a user (first checkout). */
export async function saveCustomer(userId: string, stripeCustomerId: string): Promise<void> {
  await db.insert(billingCustomers).values({ userId, stripeCustomerId }).onConflictDoNothing();
}

/** User of a Stripe customer, or null when the customer is not ours (another app on the same account, a deleted user). */
export async function userIdForCustomer(stripeCustomerId: string): Promise<string | null> {
  const [row] = await db.select({ userId: billingCustomers.userId }).from(billingCustomers).where(eq(billingCustomers.stripeCustomerId, stripeCustomerId));
  return row?.userId ?? null;
}

/** True when the user exists (a webhook can arrive for an account deleted in the meantime). */
export async function userExists(userId: string): Promise<boolean> {
  const [row] = await db.select({ id: authUser.id }).from(authUser).where(eq(authUser.id, userId));
  return Boolean(row);
}

/** Records that the user has had their free trial (only the first time counts). */
export async function markTrialUsed(userId: string, at: Date): Promise<void> {
  await db.update(billingCustomers).set({ trialUsedAt: at }).where(and(eq(billingCustomers.userId, userId), isNull(billingCustomers.trialUsedAt)));
}

/** Inserts or refreshes a subscription with what Stripe says now. */
export async function upsertSubscription(row: StoredSubscriptionInput, now: Date = new Date()): Promise<void> {
  const { userId, status, interval, currentPeriodEnd, trialEnd, cancelAtPeriodEnd, endedAt } = row;
  await db
    .insert(billingSubscriptions)
    .values({ ...row, updatedAt: now })
    .onConflictDoUpdate({
      target: billingSubscriptions.stripeSubscriptionId,
      set: { userId, status, interval, currentPeriodEnd, trialEnd, cancelAtPeriodEnd, endedAt, updatedAt: now },
    });
}

/** Every subscription of a user, newest first. */
export async function listSubscriptions(userId: string): Promise<BillingSubscriptionRow[]> {
  return db.select().from(billingSubscriptions).where(eq(billingSubscriptions.userId, userId)).orderBy(sql`${billingSubscriptions.createdAt} desc`);
}

/** Every grant of a user (revoked ones included). */
export async function listGrants(userId: string): Promise<BillingGrantRow[]> {
  return db.select().from(billingGrants).where(eq(billingGrants.userId, userId));
}

/**
 * Recomputes the Pro access of a user from subscriptions and grants and writes it on `auth_user`, where the proxy reads it
 * with the session. Every change to a subscription or a grant ends here.
 */
export async function recomputeEntitlement(userId: string, now: Date = new Date()): Promise<Entitlement> {
  const [subscriptions, grants] = await Promise.all([listSubscriptions(userId), listGrants(userId)]);
  const entitlement = computeEntitlement(subscriptions, grants, now);
  await db.update(authUser).set({ proUntil: entitlement.proUntil, proSource: entitlement.source }).where(eq(authUser.id, userId));
  return entitlement;
}

/** True when this webhook event was already processed. */
export async function isEventProcessed(eventId: string): Promise<boolean> {
  const [row] = await db.select({ id: billingStripeEvents.id }).from(billingStripeEvents).where(eq(billingStripeEvents.id, eventId));
  return Boolean(row);
}

/** Marks a webhook event as processed (after its work succeeded, so a failure is retried by Stripe). */
export async function markEventProcessed(eventId: string, type: string): Promise<void> {
  await db.insert(billingStripeEvents).values({ id: eventId, type }).onConflictDoNothing();
}

/** Email and profile of a user, for the billing emails; null when the account no longer exists. */
export async function userContact(userId: string): Promise<{ email: string; productCountry: string; language: string } | null> {
  const [row] = await db
    .select({ email: authUser.email, productCountry: authUser.productCountry, language: authUser.language })
    .from(authUser)
    .where(eq(authUser.id, userId));
  return row ?? null;
}
