import "server-only";
import type Stripe from "stripe";
import type { BillingInterval } from "@/lib/db/schema/billing";
import { getAppUrl } from "@/lib/env";
import type { Language } from "@/lib/localization/config";
import type { StripeSettings } from "./config";
import { PRO_PAGE_PATH } from "./plan-routes";
import { PRO_TRIAL_DAYS } from "./plans";
import { findCustomer, listSubscriptions, saveCustomer } from "./store";
import { USER_ID_METADATA_KEY } from "./subscription-map";

/** Who is buying: the signed-in account. */
export interface CheckoutUser {
  id: string;
  email: string;
  language: Language;
}

/** A user gets the free trial once: never after a trial or any earlier subscription. */
export async function isTrialAvailable(userId: string): Promise<boolean> {
  const [customer, subscriptions] = await Promise.all([findCustomer(userId), listSubscriptions(userId)]);
  return !customer?.trialUsedAt && subscriptions.length === 0;
}

/**
 * Stripe customer of the user, created on the first checkout with our user id in the metadata (so a webhook can always
 * find the account). Only the email goes to Stripe: no name, no financial data.
 */
export async function ensureStripeCustomer(stripe: Stripe, user: CheckoutUser): Promise<string> {
  const existing = await findCustomer(user.id);
  if (existing) return existing.stripeCustomerId;
  const customer = await stripe.customers.create(
    { email: user.email, preferred_locales: [user.language], metadata: { [USER_ID_METADATA_KEY]: user.id } },
    { idempotencyKey: `customer-${user.id}` },
  );
  await saveCustomer(user.id, customer.id);
  // Another request may have saved its own customer first: the stored one wins.
  return (await findCustomer(user.id))?.stripeCustomerId ?? customer.id;
}

/**
 * Hosted Checkout for Pro. With the trial: 14 days free, card asked up front, no charge before the end; if the card is
 * missing at the end the subscription is cancelled rather than left unpaid. Promotion codes (real discounts made in the
 * Stripe Dashboard) are accepted; our own access codes are not Stripe coupons and go through `/api/billing/redeem`.
 */
export async function createCheckoutSession(
  stripe: Stripe,
  settings: StripeSettings,
  user: CheckoutUser,
  interval: BillingInterval,
): Promise<{ url: string; trial: boolean }> {
  const [customer, trial] = await Promise.all([ensureStripeCustomer(stripe, user), isTrialAvailable(user.id)]);
  const base = getAppUrl();
  const metadata = { [USER_ID_METADATA_KEY]: user.id };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: user.id,
    line_items: [{ price: settings.prices[interval], quantity: 1 }],
    locale: user.language,
    allow_promotion_codes: true,
    payment_method_collection: "always",
    metadata,
    subscription_data: {
      metadata,
      billing_mode: { type: "flexible" },
      ...(trial ? { trial_period_days: PRO_TRIAL_DAYS, trial_settings: { end_behavior: { missing_payment_method: "cancel" } } } : {}),
    },
    success_url: `${base}${PRO_PAGE_PATH}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}${PRO_PAGE_PATH}?checkout=cancel`,
  });
  if (!session.url) throw new Error("Stripe Checkout returned no URL");
  return { url: session.url, trial };
}

/** Customer Portal session (change interval or card, see invoices, cancel), back to the plans page. */
export async function createPortalSession(stripe: Stripe, settings: StripeSettings, userId: string, language: Language): Promise<string | null> {
  const customer = await findCustomer(userId);
  if (!customer) return null;
  const session = await stripe.billingPortal.sessions.create({
    customer: customer.stripeCustomerId,
    locale: language,
    return_url: `${getAppUrl()}${PRO_PAGE_PATH}`,
    ...(settings.portalConfiguration ? { configuration: settings.portalConfiguration } : {}),
  });
  return session.url;
}
