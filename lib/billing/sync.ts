import "server-only";
import type Stripe from "stripe";
import { hashUserId, logger } from "@/lib/observability";
import type { Entitlement } from "./entitlement";
import { mapStripeSubscription } from "./subscription-map";
import { findCustomer, markTrialUsed, recomputeEntitlement, upsertSubscription, userExists, userIdForCustomer } from "./store";

/** Result of applying a Stripe subscription to our records: whose it is and the access before and after. */
export interface SubscriptionSyncResult {
  userId: string;
  entitlement: Entitlement;
  status: string;
}

/**
 * Stores what Stripe says about a subscription and recomputes the user's access. The user comes from the customer we
 * linked at checkout, or from the metadata as a fallback; a subscription of nobody we know is skipped (logged, not thrown,
 * so Stripe does not retry it for days).
 */
export async function applyStripeSubscription(subscription: Stripe.Subscription, now: Date = new Date()): Promise<SubscriptionSyncResult | null> {
  const mapped = mapStripeSubscription(subscription);
  const userId = (await userIdForCustomer(mapped.customerId)) ?? mapped.metadataUserId;
  if (!userId || !(await userExists(userId))) {
    logger.warn("billing.subscription.unknown_user", { outcome: "skipped" });
    return null;
  }
  await upsertSubscription(
    {
      stripeSubscriptionId: mapped.stripeSubscriptionId,
      userId,
      status: mapped.status,
      interval: mapped.interval,
      currentPeriodEnd: mapped.currentPeriodEnd,
      trialEnd: mapped.trialEnd,
      cancelAtPeriodEnd: mapped.cancelAtPeriodEnd,
      endedAt: mapped.endedAt,
    },
    now,
  );
  if (mapped.trialEnd) await markTrialUsed(userId, now);
  const entitlement = await recomputeEntitlement(userId, now);
  logger.info("billing.subscription.synced", { user: hashUserId(userId), billingStatus: mapped.status, planInterval: mapped.interval, plan: entitlement.proUntil ? "pro" : "free" });
  return { userId, entitlement, status: mapped.status };
}

/** Fetches a subscription from Stripe (the event payload can be older than the latest state) and applies it. */
export async function syncStripeSubscription(stripe: Stripe, subscriptionId: string, now: Date = new Date()): Promise<SubscriptionSyncResult | null> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return applyStripeSubscription(subscription, now);
}

/**
 * Re-reads every subscription of a user from Stripe and recomputes the access: the self-healing path when a webhook was
 * lost (the plans page asks for it when it opens after a checkout or on a Free account that has a Stripe customer).
 */
export async function refreshUserFromStripe(stripe: Stripe, userId: string, now: Date = new Date()): Promise<Entitlement> {
  const customer = await findCustomer(userId);
  if (customer) {
    const list = await stripe.subscriptions.list({ customer: customer.stripeCustomerId, status: "all", limit: 10 });
    for (const subscription of list.data) await applyStripeSubscription(subscription, now);
  }
  return recomputeEntitlement(userId, now);
}
