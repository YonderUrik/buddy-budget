import { NextRequest } from "next/server";
import { sessionOrUnauthorized } from "@/lib/account/route-session";
import { resolvePlan } from "@/lib/billing";
import { billingConfig, planForUser, readBillingStatus, refreshUserFromStripe, stripeClient } from "@/lib/billing/server";
import { recordBillingAction, requestLogger, withRoute } from "@/lib/observability";
import { redis } from "@/lib/redis/client";

/** Seconds between two refreshes from Stripe for the same account. */
const REFRESH_COOLDOWN_SECONDS = 20;

/** One refresh from Stripe per account in the cooldown; with Redis down the refresh is allowed. */
async function refreshAllowed(userId: string): Promise<boolean> {
  try {
    return (await redis.set(`billing:refresh:${userId}`, "1", "EX", REFRESH_COOLDOWN_SECONDS, "NX")) === "OK";
  } catch {
    return true;
  }
}

/**
 * Plan and subscription of the signed-in account. `?refresh=1` (back from Checkout, or a Free account with a Stripe
 * customer) first re-reads the subscriptions from Stripe: the self-healing path when a webhook was lost.
 */
async function handleGet(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  let plan = planForUser(session.user);
  const stripe = stripeClient(billingConfig().stripe);
  if (plan.enforced && stripe && request.nextUrl.searchParams.get("refresh") === "1" && (await refreshAllowed(session.user.id))) {
    try {
      const entitlement = await refreshUserFromStripe(stripe, session.user.id);
      plan = resolvePlan({ proUntil: entitlement.proUntil, proSource: entitlement.source }, true);
      recordBillingAction("refreshed", "ok");
    } catch (error) {
      recordBillingAction("refreshed", "failed");
      requestLogger().warn("billing.refresh.failed", { error });
    }
  }
  return Response.json(await readBillingStatus(session.user.id, plan), { headers: { "Cache-Control": "no-store" } });
}

export const GET = withRoute("billing.status", handleGet);
