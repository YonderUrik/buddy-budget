import type { BillingStatus } from "@/lib/billing/status";

/** Which sentence describes the account's plan, with the date it refers to (ISO), if any. */
export type PlanStatusLine =
  | { kind: "trial"; date: string; cancels: boolean }
  | { kind: "active"; date: string; cancels: boolean }
  | { kind: "past_due"; date: string }
  | { kind: "suspended" }
  | { kind: "grant"; date: string | null }
  | { kind: "free" };

/** The status sentence for an account (pure: tested, and the same in the plans page and in Settings). */
export function planStatusLine(status: Pick<BillingStatus, "plan" | "subscription">): PlanStatusLine {
  const { plan, subscription } = status;
  if (plan.tier === "pro" && plan.source === "grant") return { kind: "grant", date: plan.until };
  if (subscription?.status === "trialing") return { kind: "trial", date: subscription.trialEnd ?? subscription.currentPeriodEnd, cancels: subscription.cancelAtPeriodEnd };
  if (subscription?.status === "active") return { kind: "active", date: subscription.currentPeriodEnd, cancels: subscription.cancelAtPeriodEnd };
  if (subscription?.status === "past_due") return { kind: "past_due", date: plan.until ?? subscription.currentPeriodEnd };
  if (subscription && (subscription.status === "unpaid" || subscription.status === "paused")) return { kind: "suspended" };
  if (plan.tier === "pro") return { kind: "grant", date: plan.until };
  return { kind: "free" };
}
