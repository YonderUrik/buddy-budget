import "server-only";

/**
 * lib/billing/server — barrel of the server-only parts: Stripe client, checkout and portal, webhooks, grants and codes,
 * stored subscriptions. Import from `@/lib/billing` for what the browser also needs.
 */

export { billingConfig, stripeSettings, isPlanEnforcedFor, describeBilling } from "./config";
export type { BillingConfig, BillingMode, StripeSettings } from "./config";
export { planForUser } from "./plan-for-user";
export type { PlanSessionUser } from "./plan-for-user";
export { stripeClient } from "./stripe-client";
export { createCheckoutSession, createPortalSession, isTrialAvailable, ensureStripeCustomer } from "./checkout";
export type { CheckoutUser } from "./checkout";
export { handleStripeEvent } from "./webhook";
export type { WebhookOutcome } from "./webhook";
export { applyStripeSubscription, syncStripeSubscription, refreshUserFromStripe } from "./sync";
export { grantPro, revokeGrants, createAccessCode, redeemAccessCode } from "./grants";
export type { GrantInput, AccessCodeInput, RedeemResult } from "./grants";
export { findCustomer, listSubscriptions, listGrants, recomputeEntitlement } from "./store";
export { computeEntitlement, subscriptionAccessUntil, FOR_GOOD } from "./entitlement";
export type { Entitlement } from "./entitlement";
export { consumeRedeemAttempt } from "./redeem-quota";
export { cancelSubscriptionsForDeletion, setSubscriptionsCancelAtPeriodEnd, hasPaidSubscription } from "./lifecycle";
export { sendBillingEmail, billingEmailContent } from "./emails";
export type { BillingEmailKind } from "./emails";
export { readBillingStatus } from "./status";
export type { BillingStatus } from "./status";
