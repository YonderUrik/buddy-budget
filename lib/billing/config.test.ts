import { describe, expect, it } from "vitest";
import { billingConfig, describeBilling, isPlanEnforcedFor } from "./config";

const STRIPE = { STRIPE_SECRET_KEY: "sk_test_abc", STRIPE_WEBHOOK_SECRET: "whsec_abc", STRIPE_PRICE_MONTHLY: "price_m", STRIPE_PRICE_YEARLY: "price_y" };

describe("billingConfig", () => {
  it("is off by default and when a Stripe value is missing", () => {
    expect(billingConfig({}).mode).toBe("off");
    const missing = billingConfig({ BILLING_MODE: "on", ...STRIPE, STRIPE_PRICE_YEARLY: "" });
    expect(missing).toMatchObject({ mode: "off", disabledReason: "missing_stripe_keys" });
  });

  it("never bills a self-hosted install", () => {
    expect(billingConfig({ BILLING_MODE: "on", SELF_HOSTED: "true", ...STRIPE })).toMatchObject({ mode: "off", stripe: null, disabledReason: "self_hosted" });
  });

  it("turns on with every Stripe value, and recognises test keys", () => {
    const config = billingConfig({ BILLING_MODE: "on", ...STRIPE });
    expect(config.mode).toBe("on");
    expect(config.stripe).toMatchObject({ prices: { month: "price_m", year: "price_y" }, testMode: true, portalConfiguration: null });
    expect(billingConfig({ BILLING_MODE: "on", ...STRIPE, STRIPE_SECRET_KEY: "sk_live_abc" }).stripe?.testMode).toBe(false);
  });

  it("treats an unknown mode as off", () => {
    expect(billingConfig({ BILLING_MODE: "maybe", ...STRIPE }).mode).toBe("off");
  });
});

describe("isPlanEnforcedFor", () => {
  it("applies to everyone when on, to the listed emails in pilot, to nobody when off", () => {
    const on = billingConfig({ BILLING_MODE: "on", ...STRIPE });
    const pilot = billingConfig({ BILLING_MODE: "pilot", BILLING_PILOT_EMAILS: " Anna@Example.com ,bob@example.com", ...STRIPE });
    expect(isPlanEnforcedFor("x@example.com", on)).toBe(true);
    expect(isPlanEnforcedFor("anna@example.com", pilot)).toBe(true);
    expect(isPlanEnforcedFor("x@example.com", pilot)).toBe(false);
    expect(isPlanEnforcedFor(null, pilot)).toBe(false);
    expect(isPlanEnforcedFor("anna@example.com", billingConfig({}))).toBe(false);
  });
});

describe("describeBilling", () => {
  it("names flags and counts, never keys or emails", () => {
    const line = describeBilling({ BILLING_MODE: "pilot", BILLING_PILOT_EMAILS: "anna@example.com", ...STRIPE });
    expect(line).toBe("billing=pilot stripe=test pilot=1");
    expect(line).not.toContain("anna");
    expect(describeBilling({ BILLING_MODE: "on" })).toBe("billing=off stripe=off disabled=missing_stripe_keys");
  });
});
