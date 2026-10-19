import "server-only";
import Stripe from "stripe";
import { billingConfig, type StripeSettings } from "./config";

const globalForStripe = globalThis as unknown as { __bbStripe?: { key: string; client: Stripe } };

/** Stripe client for the configured key (one per process), or null when billing is off on this instance. */
export function stripeClient(settings: StripeSettings | null = billingConfig().stripe): Stripe | null {
  if (!settings) return null;
  const cached = globalForStripe.__bbStripe;
  if (cached?.key === settings.secretKey) return cached.client;
  // The SDK pins its own API version (`2026-09-30.endive` for stripe 23): the types and the webhook payloads match it.
  const client = new Stripe(settings.secretKey, { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: "BuddyBudget" } });
  globalForStripe.__bbStripe = { key: settings.secretKey, client };
  return client;
}
