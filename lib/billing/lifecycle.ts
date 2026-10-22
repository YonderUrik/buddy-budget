import "server-only";
import { hashUserId, logger, recordBillingAction } from "@/lib/observability";
import { billingConfig } from "./config";
import { findCustomer, listSubscriptions } from "./store";
import { stripeClient } from "./stripe-client";

/** Statuses in which Stripe may still charge the card. */
const CHARGEABLE_STATUSES = new Set(["trialing", "active", "past_due", "unpaid", "paused", "incomplete"]);

/** True when the user has a subscription that is paid or in its trial (the inactivity cleanup skips these accounts). */
export async function hasPaidSubscription(userId: string): Promise<boolean> {
  const subscriptions = await listSubscriptions(userId);
  return subscriptions.some((subscription) => ["trialing", "active", "past_due"].includes(subscription.status));
}

/**
 * Before an account is deleted: deletes its Stripe customer, which cancels every subscription at once (no further
 * charge). Invoices stay in Stripe, where the law requires them. Throws when Stripe fails, so the account is not deleted
 * while a card could still be charged (the deletion cron retries the next day). Nothing to do without a customer.
 */
export async function cancelSubscriptionsForDeletion(userId: string): Promise<void> {
  const customer = await findCustomer(userId);
  if (!customer) return;
  const stripe = stripeClient(billingConfig().stripe);
  if (!stripe) {
    // Billing switched off with customers left: they have to be cancelled from the Stripe Dashboard.
    logger.warn("billing.customer.delete_skipped", { user: hashUserId(userId), reason: "stripe_off" });
    return;
  }
  try {
    await stripe.customers.del(customer.stripeCustomerId);
    recordBillingAction("canceled_on_delete", "ok");
    logger.info("billing.customer.deleted", { user: hashUserId(userId) });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "resource_missing") return;
    recordBillingAction("canceled_on_delete", "failed");
    logger.error("billing.customer.delete_failed", { user: hashUserId(userId), error });
    throw error;
  }
}

/**
 * Deactivation (30 days to change one's mind) stops the renewal; reactivation turns it back on. Best effort: the webhook
 * that follows records the change, and a failure is logged without blocking the account action.
 */
export async function setSubscriptionsCancelAtPeriodEnd(userId: string, cancel: boolean): Promise<void> {
  const stripe = stripeClient(billingConfig().stripe);
  if (!stripe) return;
  const subscriptions = (await listSubscriptions(userId)).filter((subscription) => CHARGEABLE_STATUSES.has(subscription.status));
  for (const subscription of subscriptions) {
    try {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, { cancel_at_period_end: cancel });
    } catch (error) {
      logger.warn("billing.subscription.renewal_update_failed", { user: hashUserId(userId), reason: cancel ? "deactivate" : "reactivate", error });
    }
  }
}
