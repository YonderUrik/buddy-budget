import { NextRequest } from "next/server";
import { billingConfig, handleStripeEvent, stripeClient } from "@/lib/billing/server";
import { recordBillingWebhook, requestLogger, withRoute } from "@/lib/observability";

export const maxDuration = 30;

/**
 * Stripe webhooks: public (no session), authenticated by the `Stripe-Signature` header and `STRIPE_WEBHOOK_SECRET`.
 * 200 once handled (or deliberately ignored), 400 for a bad signature, 500 when the work failed so Stripe retries.
 * Without Stripe settings (self-hosted, keys missing) it answers 404.
 */
async function handlePost(request: NextRequest) {
  const settings = billingConfig().stripe;
  const stripe = stripeClient(settings);
  if (!stripe || !settings) return new Response(null, { status: 404 });
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();
  let event;
  try {
    if (!signature) throw new Error("missing signature");
    event = await stripe.webhooks.constructEventAsync(payload, signature, settings.webhookSecret);
  } catch {
    recordBillingWebhook("other", "invalid_signature");
    requestLogger().warn("billing.webhook.invalid_signature");
    return new Response(null, { status: 400 });
  }
  try {
    const outcome = await handleStripeEvent(stripe, event);
    return Response.json({ received: true, outcome });
  } catch (error) {
    recordBillingWebhook(event.type, "failed");
    requestLogger().error("billing.webhook.failed", { stripeEventType: event.type, error });
    return new Response(null, { status: 500 });
  }
}

export const POST = withRoute("stripe.webhook", handlePost);
