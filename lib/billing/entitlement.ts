import type { BillingSubscriptionStatus } from "@/lib/db/schema/billing";
import { PAST_DUE_GRACE_DAYS, RENEWAL_GRACE_HOURS, type ProSource } from "./plans";

/** Stored end of a grant without an end date (`proUntil` is a timestamp, so "for good" is a date far away). */
export const FOR_GOOD = new Date("9999-12-31T00:00:00.000Z");

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** The subscription fields the access depends on. */
export interface EntitlementSubscription {
  status: BillingSubscriptionStatus;
  currentPeriodEnd: Date;
  trialEnd: Date | null;
}

/** The grant fields the access depends on. */
export interface EntitlementGrant {
  startsAt: Date;
  endsAt: Date | null;
  revokedAt: Date | null;
}

export interface Entitlement {
  /** Pro until this instant; null = Free. */
  proUntil: Date | null;
  source: ProSource | null;
}

/**
 * Until when a subscription gives Pro, or null. Trial and active: to the end of the period plus a small margin for a late
 * renewal. `past_due` (card refused, Stripe retrying): `PAST_DUE_GRACE_DAYS` more. Every other status gives nothing:
 * `canceled`, `unpaid`, `paused` (trial ended without a card), `incomplete*` (first payment never went through).
 */
export function subscriptionAccessUntil(subscription: EntitlementSubscription): Date | null {
  const end = subscription.currentPeriodEnd.getTime();
  if (subscription.status === "trialing" || subscription.status === "active") return new Date(end + RENEWAL_GRACE_HOURS * HOUR_MS);
  if (subscription.status === "past_due") return new Date(end + PAST_DUE_GRACE_DAYS * DAY_MS);
  return null;
}

/**
 * Pro access from all the sources of a user: the latest end wins. A subscription counts as `trial` while Stripe says it
 * is trialing, as `subscription` otherwise; a grant that has not started yet or was revoked does not count.
 */
export function computeEntitlement(subscriptions: readonly EntitlementSubscription[], grants: readonly EntitlementGrant[], now: Date = new Date()): Entitlement {
  let best: Entitlement = { proUntil: null, source: null };
  const consider = (until: Date | null, source: ProSource) => {
    if (!until || until.getTime() <= now.getTime()) return;
    if (!best.proUntil || until.getTime() > best.proUntil.getTime()) best = { proUntil: until, source };
  };
  for (const subscription of subscriptions) consider(subscriptionAccessUntil(subscription), subscription.status === "trialing" ? "trial" : "subscription");
  for (const grant of grants) {
    if (grant.revokedAt || grant.startsAt.getTime() > now.getTime()) continue;
    consider(grant.endsAt ?? FOR_GOOD, "grant");
  }
  return best;
}
