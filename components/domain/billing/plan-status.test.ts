import { describe, expect, it } from "vitest";
import { planStatusLine } from "./plan-status";

const pro = (source: "trial" | "subscription" | "grant", until: string | null = "2026-11-03T00:00:00.000Z") => ({ tier: "pro" as const, enforced: true, source, until });
const free = { tier: "free" as const, enforced: true, source: null, until: null };
const sub = (status: "trialing" | "active" | "past_due" | "unpaid" | "paused", cancelAtPeriodEnd = false) => ({
  status,
  interval: "month" as const,
  currentPeriodEnd: "2026-11-03T00:00:00.000Z",
  trialEnd: status === "trialing" ? "2026-11-03T00:00:00.000Z" : null,
  cancelAtPeriodEnd,
});

describe("planStatusLine", () => {
  it("describes trial, renewal, cancellation and failed payments", () => {
    expect(planStatusLine({ plan: pro("trial"), subscription: sub("trialing") })).toEqual({ kind: "trial", date: "2026-11-03T00:00:00.000Z", cancels: false });
    expect(planStatusLine({ plan: pro("subscription"), subscription: sub("active", true) })).toMatchObject({ kind: "active", cancels: true });
    expect(planStatusLine({ plan: pro("subscription", "2026-11-10T00:00:00.000Z"), subscription: sub("past_due") })).toEqual({ kind: "past_due", date: "2026-11-10T00:00:00.000Z" });
    expect(planStatusLine({ plan: free, subscription: sub("unpaid") })).toEqual({ kind: "suspended" });
  });

  it("puts a free grant before a subscription, and says Free otherwise", () => {
    expect(planStatusLine({ plan: pro("grant", null), subscription: sub("active") })).toEqual({ kind: "grant", date: null });
    expect(planStatusLine({ plan: free, subscription: null })).toEqual({ kind: "free" });
  });
});
