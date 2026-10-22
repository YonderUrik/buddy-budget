import type Stripe from "stripe";
import { BILLING_SUBSCRIPTION_STATUSES, type BillingInterval, type BillingSubscriptionStatus } from "@/lib/db/schema/billing";

/** Metadata key on Stripe customers, checkout sessions and subscriptions that carries our user id. */
export const USER_ID_METADATA_KEY = "buddybudget_user_id";

/** Subscription fields we store, read from a Stripe subscription. */
export interface MappedSubscription {
  stripeSubscriptionId: string;
  customerId: string;
  /** User id written in the metadata at checkout, if any. */
  metadataUserId: string | null;
  status: BillingSubscriptionStatus;
  interval: BillingInterval;
  currentPeriodEnd: Date;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  endedAt: Date | null;
}

const fromUnix = (seconds: number | null | undefined) => (typeof seconds === "number" ? new Date(seconds * 1000) : null);

/**
 * Our view of a Stripe subscription. Since the 2025 API versions the period lives on the items, so the latest item end is
 * used. A cancellation scheduled with `cancel_at` (what the Customer Portal does with flexible billing) counts as
 * cancelling at the end of the period too. An unknown status counts as `incomplete` (no access) rather than throwing.
 */
export function mapStripeSubscription(subscription: Stripe.Subscription): MappedSubscription {
  const items = subscription.items?.data ?? [];
  const periodEnds = items.map((item) => item.current_period_end).filter((value): value is number => typeof value === "number");
  const periodEnd = periodEnds.length > 0 ? Math.max(...periodEnds) : (subscription.trial_end ?? subscription.created);
  const interval = items[0]?.price?.recurring?.interval === "year" ? "year" : "month";
  const status = (BILLING_SUBSCRIPTION_STATUSES as readonly string[]).includes(subscription.status) ? (subscription.status as BillingSubscriptionStatus) : "incomplete";
  const customer = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const metadataUserId = subscription.metadata?.[USER_ID_METADATA_KEY]?.trim() || null;
  return {
    stripeSubscriptionId: subscription.id,
    customerId: customer,
    metadataUserId,
    status,
    interval,
    currentPeriodEnd: new Date(periodEnd * 1000),
    trialEnd: fromUnix(subscription.trial_end),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end || subscription.cancel_at),
    endedAt: fromUnix(subscription.ended_at),
  };
}
