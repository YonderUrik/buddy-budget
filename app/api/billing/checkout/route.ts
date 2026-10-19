import { NextRequest } from "next/server";
import { readJson, sessionOrUnauthorized } from "@/lib/account/route-session";
import { BILLING_INTERVALS, type BillingInterval } from "@/lib/db/schema/billing";
import { billingConfig, createCheckoutSession, listSubscriptions, planForUser, stripeClient } from "@/lib/billing/server";
import { resolveProfile } from "@/lib/localization/config";
import { recordBillingAction, requestLogger, withRoute } from "@/lib/observability";

/** Statuses of a subscription that is still running: a new checkout would charge twice, the portal handles changes. */
const RUNNING = new Set(["trialing", "active", "past_due", "unpaid", "paused"]);

/** Opens Stripe Checkout for Pro (`{ interval: "month" | "year" }`) and answers with the page to go to. */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const body = (await readJson(request)) as { interval?: unknown } | null;
  const interval = BILLING_INTERVALS.find((value) => value === body?.interval) as BillingInterval | undefined;
  if (!interval) return Response.json({ error: "Scegli se pagare ogni mese o ogni anno." }, { status: 400 });

  const config = billingConfig();
  const stripe = stripeClient(config.stripe);
  const plan = planForUser(session.user);
  if (!stripe || !config.stripe || !plan.enforced) {
    recordBillingAction("checkout_started", "rejected");
    requestLogger().info("billing.checkout.rejected", { reason: "not_available" });
    return Response.json({ error: "L'abbonamento non è disponibile su questo account." }, { status: 409 });
  }
  if ((await listSubscriptions(session.user.id)).some((subscription) => RUNNING.has(subscription.status))) {
    recordBillingAction("checkout_started", "rejected");
    requestLogger().info("billing.checkout.rejected", { reason: "already_subscribed" });
    return Response.json({ error: "Hai già un abbonamento: cambialo da «Gestisci abbonamento»." }, { status: 409 });
  }

  try {
    const { language } = resolveProfile(session.user);
    const { url, trial } = await createCheckoutSession(stripe, config.stripe, { id: session.user.id, email: session.user.email, language }, interval);
    recordBillingAction("checkout_started", "ok");
    requestLogger().info("billing.checkout.created", { planInterval: interval, reason: trial ? "trial" : "no_trial" });
    return Response.json({ url, trial });
  } catch (error) {
    recordBillingAction("checkout_started", "failed");
    requestLogger().error("billing.checkout.failed", { planInterval: interval, error });
    return Response.json({ error: "Non riusciamo ad aprire il pagamento adesso. Riprova tra poco." }, { status: 502 });
  }
}

export const POST = withRoute("billing.checkout", handlePost);
