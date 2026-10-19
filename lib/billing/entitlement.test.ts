import { describe, expect, it } from "vitest";
import { FOR_GOOD, computeEntitlement, subscriptionAccessUntil } from "./entitlement";

const NOW = new Date("2026-10-20T10:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe("subscriptionAccessUntil", () => {
  it("adds 48 hours to a paid or trial period, 7 days while the card is retried, nothing otherwise", () => {
    expect(subscriptionAccessUntil({ status: "active", currentPeriodEnd: day(10), trialEnd: null })).toEqual(new Date(day(10).getTime() + 48 * 3_600_000));
    expect(subscriptionAccessUntil({ status: "trialing", currentPeriodEnd: day(14), trialEnd: day(14) })).toEqual(new Date(day(14).getTime() + 48 * 3_600_000));
    expect(subscriptionAccessUntil({ status: "past_due", currentPeriodEnd: day(-1), trialEnd: null })).toEqual(day(6));
    for (const status of ["canceled", "unpaid", "paused", "incomplete", "incomplete_expired"] as const) {
      expect(subscriptionAccessUntil({ status, currentPeriodEnd: day(10), trialEnd: null })).toBeNull();
    }
  });
});

describe("computeEntitlement", () => {
  it("is Free with nothing", () => {
    expect(computeEntitlement([], [], NOW)).toEqual({ proUntil: null, source: null });
  });

  it("takes the latest end among subscriptions and grants", () => {
    const result = computeEntitlement(
      [{ status: "trialing", currentPeriodEnd: day(14), trialEnd: day(14) }],
      [{ startsAt: day(-1), endsAt: day(30), revokedAt: null }],
      NOW,
    );
    expect(result).toEqual({ proUntil: day(30), source: "grant" });
  });

  it("marks a trial as such and a paid subscription as subscription", () => {
    expect(computeEntitlement([{ status: "trialing", currentPeriodEnd: day(14), trialEnd: day(14) }], [], NOW).source).toBe("trial");
    expect(computeEntitlement([{ status: "active", currentPeriodEnd: day(14), trialEnd: null }], [], NOW).source).toBe("subscription");
  });

  it("ignores revoked, future and ended grants; a grant without an end is for good", () => {
    const grants = [
      { startsAt: day(-5), endsAt: day(5), revokedAt: day(-1) },
      { startsAt: day(2), endsAt: day(40), revokedAt: null },
      { startsAt: day(-30), endsAt: day(-1), revokedAt: null },
    ];
    expect(computeEntitlement([], grants, NOW).proUntil).toBeNull();
    expect(computeEntitlement([], [{ startsAt: day(-1), endsAt: null, revokedAt: null }], NOW)).toEqual({ proUntil: FOR_GOOD, source: "grant" });
  });
});
