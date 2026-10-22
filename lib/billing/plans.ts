import type { BillingInterval } from "@/lib/db/schema/billing";

/** Days of free Pro before the first charge (once per user). */
export const PRO_TRIAL_DAYS = 14;

/**
 * Pro prices in euro cents, VAT included where due. They are what the app shows: the Stripe prices
 * (`STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, created by `pnpm billing:stripe-setup` from these values) charge them.
 */
export const PRO_PRICE_CENTS: Record<BillingInterval, number> = { month: 199, year: 2000 };

/** Currency of the Pro prices, whatever the user's own currency. */
export const PRO_PRICE_CURRENCY = "EUR";

/** Days a `past_due` subscription keeps Pro while Stripe retries the card. */
export const PAST_DUE_GRACE_DAYS = 7;

/** Hours of Pro kept after the end of a paid period, so a renewal webhook that is a little late never locks anyone out. */
export const RENEWAL_GRACE_HOURS = 48;

/** Where a Pro access comes from: a paid subscription, a subscription still in its trial, or a free grant. */
export const PRO_SOURCES = ["subscription", "trial", "grant"] as const;
export type ProSource = (typeof PRO_SOURCES)[number];

/** Yearly saving compared with twelve monthly payments, in whole percent (20 € vs 23,88 € → 16%). */
export function yearlySavingPercent(prices: Record<BillingInterval, number> = PRO_PRICE_CENTS): number {
  return Math.round((1 - prices.year / (prices.month * 12)) * 100);
}
