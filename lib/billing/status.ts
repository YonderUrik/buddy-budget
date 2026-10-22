import "server-only";
import type { BillingInterval, BillingSubscriptionStatus } from "@/lib/db/schema/billing";
import type { PlanView } from "./access";
import { billingConfig } from "./config";
import { isTrialAvailable } from "./checkout";
import { findCustomer, listSubscriptions } from "./store";

/** What the plans page and Settings show: the plan, the latest subscription and whether checkout is possible. */
export interface BillingStatus {
  plan: PlanView;
  /** True when this account can start Checkout now (billing on for it and Stripe configured). */
  canPurchase: boolean;
  trialAvailable: boolean;
  /** True when the account has a Stripe customer (the portal can open). */
  hasCustomer: boolean;
  subscription: {
    status: BillingSubscriptionStatus;
    interval: BillingInterval;
    currentPeriodEnd: string;
    trialEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
}

/** Statuses that make the subscription "the current one" shown to the user. */
const CURRENT_STATUSES = new Set<BillingSubscriptionStatus>(["trialing", "active", "past_due", "unpaid", "paused"]);

/** Billing status of an account whose plan is already resolved. */
export async function readBillingStatus(userId: string, plan: PlanView): Promise<BillingStatus> {
  const config = billingConfig();
  if (!plan.enforced) return { plan, canPurchase: false, trialAvailable: false, hasCustomer: false, subscription: null };
  const [customer, subscriptions, trialAvailable] = await Promise.all([findCustomer(userId), listSubscriptions(userId), isTrialAvailable(userId)]);
  const current = subscriptions.find((subscription) => CURRENT_STATUSES.has(subscription.status)) ?? null;
  return {
    plan,
    canPurchase: Boolean(config.stripe) && config.mode !== "off",
    trialAvailable,
    hasCustomer: Boolean(customer),
    subscription: current
      ? {
          status: current.status,
          interval: current.interval,
          currentPeriodEnd: current.currentPeriodEnd.toISOString(),
          trialEnd: current.trialEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: current.cancelAtPeriodEnd,
        }
      : null,
  };
}
