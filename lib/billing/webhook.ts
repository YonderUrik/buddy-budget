import "server-only";
import type Stripe from "stripe";
import { hashUserId, logger, recordBillingWebhook } from "@/lib/observability";
import { isEventProcessed, markEventProcessed, saveCustomer, userExists } from "./store";
import { sendBillingEmail } from "./emails";
import { USER_ID_METADATA_KEY } from "./subscription-map";
import { syncStripeSubscription } from "./sync";

export type WebhookOutcome = "processed" | "duplicate" | "ignored";

const idOf = (value: string | { id: string } | null | undefined) => (typeof value === "string" ? value : (value?.id ?? null));

/** Subscription an invoice belongs to (since the 2025 API versions it sits under `parent.subscription_details`). */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return idOf(invoice.parent?.subscription_details?.subscription);
}

/**
 * Handles one verified Stripe event. Every subscription event re-reads the subscription from Stripe (payloads can arrive
 * out of order) and recomputes the access, so handling an event twice changes nothing; the event id is stored only after
 * the work succeeded, so a failure is retried by Stripe.
 */
export async function handleStripeEvent(stripe: Stripe, event: Stripe.Event, now: Date = new Date()): Promise<WebhookOutcome> {
  if (await isEventProcessed(event.id)) {
    recordBillingWebhook(event.type, "duplicate");
    return "duplicate";
  }
  const outcome = await dispatch(stripe, event, now);
  await markEventProcessed(event.id, event.type);
  recordBillingWebhook(event.type, outcome);
  logger.info("billing.webhook.handled", { stripeEventType: event.type, outcome });
  return outcome;
}

async function dispatch(stripe: Stripe, event: Stripe.Event, now: Date): Promise<WebhookOutcome> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const subscriptionId = idOf(session.subscription);
      if (session.mode !== "subscription" || !subscriptionId) return "ignored";
      // The customer is normally linked before Checkout; this covers a link lost between the two.
      const userId = session.client_reference_id ?? session.metadata?.[USER_ID_METADATA_KEY] ?? null;
      const customerId = idOf(session.customer);
      if (userId && customerId && (await userExists(userId))) await saveCustomer(userId, customerId);
      return (await syncStripeSubscription(stripe, subscriptionId, now)) ? "processed" : "ignored";
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      return (await syncStripeSubscription(stripe, event.data.object.id, now)) ? "processed" : "ignored";
    case "customer.subscription.deleted": {
      const result = await syncStripeSubscription(stripe, event.data.object.id, now);
      if (!result) return "ignored";
      // Back to Free only if nothing else (a grant, another subscription) keeps Pro open.
      if (!result.entitlement.proUntil) await sendBillingEmail(result.userId, "ended", { idempotencyKey: `ended-${event.id}` });
      return "processed";
    }
    case "customer.subscription.trial_will_end": {
      const subscription = event.data.object;
      const result = await syncStripeSubscription(stripe, subscription.id, now);
      if (!result) return "ignored";
      // Stripe sends it also when a trial is ended early: no email if the trial is already over.
      if (result.status === "trialing") {
        const interval = subscription.items.data[0]?.price?.recurring?.interval === "year" ? "year" : "month";
        const chargeAt = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
        await sendBillingEmail(result.userId, "trial_ending", { chargeAt, interval, idempotencyKey: `trial-${event.id}` });
      }
      return "processed";
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const subscriptionId = invoiceSubscriptionId(event.data.object);
      if (!subscriptionId) return "ignored";
      const result = await syncStripeSubscription(stripe, subscriptionId, now);
      if (result && event.type === "invoice.payment_failed") {
        logger.warn("billing.payment.failed", { user: hashUserId(result.userId), billingStatus: result.status });
      }
      return result ? "processed" : "ignored";
    }
    default:
      return "ignored";
  }
}
