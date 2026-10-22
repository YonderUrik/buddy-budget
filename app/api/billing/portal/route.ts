import { NextRequest } from "next/server";
import { sessionOrUnauthorized } from "@/lib/account/route-session";
import { billingConfig, createPortalSession, planForUser, stripeClient } from "@/lib/billing/server";
import { resolveProfile } from "@/lib/localization/config";
import { recordBillingAction, requestLogger, withRoute } from "@/lib/observability";

/** Opens the Stripe Customer Portal (change monthly/yearly, card, invoices, cancel) and answers with its address. */
async function handlePost(request: NextRequest) {
  const session = await sessionOrUnauthorized(request);
  if (session instanceof Response) return session;
  const config = billingConfig();
  const stripe = stripeClient(config.stripe);
  if (!stripe || !config.stripe || !planForUser(session.user).enforced) {
    return Response.json({ error: "L'abbonamento non è disponibile su questo account." }, { status: 409 });
  }
  try {
    const url = await createPortalSession(stripe, config.stripe, session.user.id, resolveProfile(session.user).language);
    if (!url) return Response.json({ error: "Non hai ancora un abbonamento da gestire." }, { status: 404 });
    recordBillingAction("portal_opened", "ok");
    requestLogger().info("billing.portal.opened");
    return Response.json({ url });
  } catch (error) {
    recordBillingAction("portal_opened", "failed");
    requestLogger().error("billing.portal.failed", { error });
    return Response.json({ error: "Non riusciamo ad aprire la gestione dell'abbonamento adesso. Riprova tra poco." }, { status: 502 });
  }
}

export const POST = withRoute("billing.portal", handlePost);
