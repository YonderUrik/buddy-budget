import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn(async () => ({ ok: true })) }));

import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { billingAccessCodes, billingCustomers, billingStripeEvents } from "@/lib/db/schema/billing";
import { sendEmail } from "@/lib/email/send";
import { createAccessCode, grantPro, redeemAccessCode, revokeGrants } from "./grants";
import { isTrialAvailable } from "./checkout";
import { saveCustomer } from "./store";
import { USER_ID_METADATA_KEY } from "./subscription-map";
import { handleStripeEvent } from "./webhook";

const NOW = new Date();
const DAY = 86_400_000;
const createdUsers: string[] = [];
const createdCodes: string[] = [];
const createdEvents: string[] = [];

async function createUser(): Promise<string> {
  const id = `billing-test-${randomUUID()}`;
  await db.insert(authUser).values({ id, name: "Test", email: `${id}@example.com`, emailVerified: true });
  createdUsers.push(id);
  return id;
}

async function proUntilOf(userId: string) {
  const [row] = await db.select({ proUntil: authUser.proUntil, proSource: authUser.proSource }).from(authUser).where(eq(authUser.id, userId));
  return row;
}

/** A Stripe client whose `subscriptions.retrieve` returns what the test sets (the webhook always re-reads it). */
function fakeStripe(current: { subscription: Stripe.Subscription }) {
  return { subscriptions: { retrieve: vi.fn(async () => current.subscription) } } as unknown as Stripe;
}

function subscription(userId: string, customer: string, status: Stripe.Subscription.Status, periodEnd: Date, trialEnd: Date | null = null): Stripe.Subscription {
  return {
    id: `sub_${userId}`,
    customer,
    status,
    created: Math.floor(NOW.getTime() / 1000),
    trial_end: trialEnd ? Math.floor(trialEnd.getTime() / 1000) : null,
    ended_at: status === "canceled" ? Math.floor(NOW.getTime() / 1000) : null,
    cancel_at: null,
    cancel_at_period_end: false,
    metadata: { [USER_ID_METADATA_KEY]: userId },
    items: { data: [{ current_period_end: Math.floor(periodEnd.getTime() / 1000), price: { recurring: { interval: "month" } } }] },
  } as unknown as Stripe.Subscription;
}

function event(type: string, object: unknown): Stripe.Event {
  const id = `evt_${randomUUID()}`;
  createdEvents.push(id);
  return { id, type, data: { object } } as unknown as Stripe.Event;
}

beforeEach(() => {
  vi.mocked(sendEmail).mockClear();
  vi.stubEnv("APP_URL", "https://app.example.com");
});

afterAll(async () => {
  if (createdEvents.length) await db.delete(billingStripeEvents).where(inArray(billingStripeEvents.id, createdEvents));
  if (createdUsers.length) await db.delete(authUser).where(inArray(authUser.id, createdUsers));
  if (createdCodes.length) await db.delete(billingAccessCodes).where(inArray(billingAccessCodes.label, createdCodes));
  await client.end();
});

describe("grants and access codes", () => {
  it("gives and revokes free Pro", async () => {
    const userId = await createUser();
    await grantPro({ userId, source: "admin", endsAt: new Date(NOW.getTime() + 30 * DAY) }, NOW);
    expect(await proUntilOf(userId)).toMatchObject({ proSource: "grant" });
    await revokeGrants(userId, NOW);
    expect(await proUntilOf(userId)).toEqual({ proUntil: null, proSource: null });
  });

  it("redeems a code once per person and up to its uses", async () => {
    const label = `test-${randomUUID()}`;
    createdCodes.push(label);
    const code = await createAccessCode({ label, durationDays: 30, maxRedemptions: 1, expiresAt: null });
    const first = await createUser();
    const second = await createUser();
    const redeemed = await redeemAccessCode(first, code.toLowerCase(), NOW);
    expect(redeemed).toMatchObject({ ok: true });
    expect((await proUntilOf(first)).proSource).toBe("grant");
    expect(await redeemAccessCode(first, code, NOW)).toEqual({ ok: false, reason: "used_up" });
    expect(await redeemAccessCode(second, code, NOW)).toEqual({ ok: false, reason: "used_up" });
    expect(await redeemAccessCode(second, "BB-NOPE-NOPE", NOW)).toEqual({ ok: false, reason: "invalid" });
  });

  it("does not let the same person redeem a multi-use code twice", async () => {
    const label = `test-${randomUUID()}`;
    createdCodes.push(label);
    const code = await createAccessCode({ label, durationDays: null, maxRedemptions: 5, expiresAt: null });
    const userId = await createUser();
    expect(await redeemAccessCode(userId, code, NOW)).toMatchObject({ ok: true, endsAt: null });
    expect(await redeemAccessCode(userId, code, NOW)).toEqual({ ok: false, reason: "already_redeemed" });
  });
});

describe("Stripe webhooks", () => {
  it("turns a trial into Pro, handles a repeated event once, and goes back to Free with an email on cancellation", async () => {
    const userId = await createUser();
    const customer = `cus_${randomUUID()}`;
    await saveCustomer(userId, customer);
    expect(await isTrialAvailable(userId)).toBe(true);

    const trialEnd = new Date(NOW.getTime() + 14 * DAY);
    const current = { subscription: subscription(userId, customer, "trialing", trialEnd, trialEnd) };
    const stripe = fakeStripe(current);
    const created = event("customer.subscription.created", current.subscription);
    expect(await handleStripeEvent(stripe, created, NOW)).toBe("processed");
    expect(await proUntilOf(userId)).toMatchObject({ proSource: "trial" });
    expect(await isTrialAvailable(userId)).toBe(false);
    expect(await handleStripeEvent(stripe, created, NOW)).toBe("duplicate");

    current.subscription = subscription(userId, customer, "canceled", trialEnd);
    expect(await handleStripeEvent(stripe, event("customer.subscription.deleted", current.subscription), NOW)).toBe("processed");
    expect(await proUntilOf(userId)).toEqual({ proUntil: null, proSource: null });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("ignores subscriptions of unknown customers and events it does not use", async () => {
    const stray = { subscription: subscription("nobody", `cus_${randomUUID()}`, "active", new Date(NOW.getTime() + DAY)) };
    stray.subscription.metadata = {};
    expect(await handleStripeEvent(fakeStripe(stray), event("customer.subscription.updated", stray.subscription), NOW)).toBe("ignored");
    expect(await handleStripeEvent(fakeStripe(stray), event("charge.refunded", {}), NOW)).toBe("ignored");
  });

  it("keeps Pro open on a grant when the subscription ends, without the Free email", async () => {
    const userId = await createUser();
    const customer = `cus_${randomUUID()}`;
    await saveCustomer(userId, customer);
    await grantPro({ userId, source: "admin", endsAt: null }, NOW);
    const ended = { subscription: subscription(userId, customer, "canceled", new Date(NOW.getTime() - DAY)) };
    await handleStripeEvent(fakeStripe(ended), event("customer.subscription.deleted", ended.subscription), NOW);
    expect((await proUntilOf(userId)).proSource).toBe("grant");
    expect(sendEmail).not.toHaveBeenCalled();
    const [row] = await db.select().from(billingCustomers).where(eq(billingCustomers.userId, userId));
    expect(row.stripeCustomerId).toBe(customer);
  });
});
