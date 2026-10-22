import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { USER_ID_METADATA_KEY, mapStripeSubscription } from "./subscription-map";

function subscription(overrides: Partial<Stripe.Subscription> = {}, items: Array<{ end: number; interval: "month" | "year" }> = [{ end: 1_800_000_000, interval: "year" }]): Stripe.Subscription {
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    created: 1_790_000_000,
    trial_end: null,
    ended_at: null,
    cancel_at: null,
    cancel_at_period_end: false,
    metadata: { [USER_ID_METADATA_KEY]: "user-1" },
    items: { data: items.map((item) => ({ current_period_end: item.end, price: { recurring: { interval: item.interval } } })) },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

describe("mapStripeSubscription", () => {
  it("reads the period from the items and the user from the metadata", () => {
    expect(mapStripeSubscription(subscription())).toEqual({
      stripeSubscriptionId: "sub_1",
      customerId: "cus_1",
      metadataUserId: "user-1",
      status: "active",
      interval: "year",
      currentPeriodEnd: new Date(1_800_000_000_000),
      trialEnd: null,
      cancelAtPeriodEnd: false,
      endedAt: null,
    });
  });

  it("uses the latest item end, an expanded customer, and cancel_at as a scheduled cancellation", () => {
    const mapped = mapStripeSubscription(
      subscription({ customer: { id: "cus_2" } as Stripe.Customer, cancel_at: 1_800_500_000, trial_end: 1_790_100_000 }, [
        { end: 1_800_000_000, interval: "month" },
        { end: 1_800_500_000, interval: "month" },
      ]),
    );
    expect(mapped).toMatchObject({ customerId: "cus_2", interval: "month", currentPeriodEnd: new Date(1_800_500_000_000), cancelAtPeriodEnd: true, trialEnd: new Date(1_790_100_000_000) });
  });

  it("counts an unknown status as incomplete", () => {
    expect(mapStripeSubscription(subscription({ status: "brand_new" as Stripe.Subscription.Status })).status).toBe("incomplete");
  });
});
