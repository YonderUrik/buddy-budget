import { describe, expect, it } from "vitest";
import { resolvePlan } from "./access";
import { planForUser } from "./plan-for-user";
import { billingConfig } from "./config";

const NOW = new Date("2026-10-20T10:00:00Z");

describe("resolvePlan", () => {
  it("is Pro without conditions when the plan is not enforced", () => {
    expect(resolvePlan({ proUntil: null }, false, NOW)).toEqual({ tier: "pro", enforced: false, source: null, until: null });
  });

  it("is Free without an access or after it ended", () => {
    expect(resolvePlan({ proUntil: null }, true, NOW).tier).toBe("free");
    expect(resolvePlan({ proUntil: new Date("2026-10-20T09:59:59Z"), proSource: "subscription" }, true, NOW).tier).toBe("free");
  });

  it("is Pro until the stored end, with its source; a grant for good has no end date", () => {
    expect(resolvePlan({ proUntil: "2026-11-03T10:00:00.000Z", proSource: "trial" }, true, NOW)).toEqual({ tier: "pro", enforced: true, source: "trial", until: "2026-11-03T10:00:00.000Z" });
    expect(resolvePlan({ proUntil: new Date("9999-12-31T00:00:00Z"), proSource: "grant" }, true, NOW)).toMatchObject({ tier: "pro", until: null });
  });
});

describe("planForUser", () => {
  const on = billingConfig({ BILLING_MODE: "on", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "w", STRIPE_PRICE_MONTHLY: "m", STRIPE_PRICE_YEARLY: "y" });
  it("keeps the shared public demo open", () => {
    expect(planForUser({ id: "public-demo-it-it", email: "demo@buddybudget.io", proUntil: null }, NOW, on).tier).toBe("pro");
    expect(planForUser({ id: "u1", email: "a@example.com", proUntil: null }, NOW, on).tier).toBe("free");
  });
});
