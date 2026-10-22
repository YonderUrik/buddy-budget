import { isSelfHosted } from "@/lib/instance/config";

type Env = Record<string, string | undefined>;

/** How billing behaves on this instance: `off` = everyone has everything, `pilot` = only listed emails, `on` = everyone. */
export type BillingMode = "off" | "pilot" | "on";

/** Stripe settings, present only when every required value is set. */
export interface StripeSettings {
  secretKey: string;
  webhookSecret: string;
  prices: { month: string; year: string };
  /** Customer Portal configuration (`bpc_…`); without it Stripe uses the default one from the Dashboard. */
  portalConfiguration: string | null;
  /** Test keys (`sk_test_…`, `rk_test_…`): no real money moves. */
  testMode: boolean;
}

export interface BillingConfig {
  mode: BillingMode;
  /** Lower-case emails the plan applies to in `pilot` mode. */
  pilotEmails: ReadonlySet<string>;
  stripe: StripeSettings | null;
  /** Why billing is off although `BILLING_MODE` asks for it (missing Stripe values, self-hosted), for the boot log. */
  disabledReason: "self_hosted" | "missing_stripe_keys" | null;
}

const trimmed = (value: string | undefined) => value?.trim() || undefined;

/** Stripe settings from the environment, or null when one of the required values is missing. */
export function stripeSettings(env: Env = process.env): StripeSettings | null {
  const secretKey = trimmed(env.STRIPE_SECRET_KEY);
  const webhookSecret = trimmed(env.STRIPE_WEBHOOK_SECRET);
  const month = trimmed(env.STRIPE_PRICE_MONTHLY);
  const year = trimmed(env.STRIPE_PRICE_YEARLY);
  if (!secretKey || !webhookSecret || !month || !year) return null;
  return {
    secretKey,
    webhookSecret,
    prices: { month, year },
    portalConfiguration: trimmed(env.STRIPE_PORTAL_CONFIGURATION) ?? null,
    testMode: /^(sk|rk)_test_/.test(secretKey),
  };
}

/**
 * Billing configuration read at request time. Fail-safe by design: a self-hosted install never bills, and a hosted one
 * without all the Stripe values behaves as `off` (nobody gets locked out of features they could not pay for).
 */
export function billingConfig(env: Env = process.env): BillingConfig {
  const requested = (trimmed(env.BILLING_MODE) ?? "off") as BillingMode;
  const pilotEmails = new Set(
    (env.BILLING_PILOT_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  const stripe = stripeSettings(env);
  if (requested === "off" || !["pilot", "on"].includes(requested)) return { mode: "off", pilotEmails, stripe, disabledReason: null };
  if (isSelfHosted(env)) return { mode: "off", pilotEmails, stripe: null, disabledReason: "self_hosted" };
  if (!stripe) return { mode: "off", pilotEmails, stripe: null, disabledReason: "missing_stripe_keys" };
  return { mode: requested, pilotEmails, stripe, disabledReason: null };
}

/** True when the Free/Pro plans apply to the account with this email. */
export function isPlanEnforcedFor(email: string | null | undefined, config: BillingConfig = billingConfig()): boolean {
  if (config.mode === "on") return true;
  if (config.mode === "pilot") return Boolean(email && config.pilotEmails.has(email.trim().toLowerCase()));
  return false;
}

/** One-line summary for the boot log, e.g. `billing=pilot stripe=test pilot=2`: flags and counts, never keys or emails. */
export function describeBilling(env: Env = process.env): string {
  const config = billingConfig(env);
  const stripe = config.stripe ? (config.stripe.testMode ? "test" : "live") : "off";
  const parts = [`billing=${config.mode}`, `stripe=${stripe}`];
  if (config.mode === "pilot") parts.push(`pilot=${config.pilotEmails.size}`);
  if (config.disabledReason) parts.push(`disabled=${config.disabledReason}`);
  return parts.join(" ");
}
