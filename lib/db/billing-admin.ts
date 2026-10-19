/**
 * Billing administration, run by the owner from a terminal with the production environment:
 *
 *   pnpm billing:stripe-setup [--live]                        # product, prices and portal on Stripe; prints the env values
 *   pnpm billing:grant <email> [--days N | --until YYYY-MM-DD] [--note text]   # free Pro (whitelist); for good by default
 *   pnpm billing:revoke <email>                               # removes the free Pro (a paid subscription stays)
 *   pnpm billing:code --label text [--days N] [--uses N] [--expires YYYY-MM-DD]   # access code, printed once
 *   pnpm billing:grant-existing --until YYYY-MM-DD [--dry-run] # free Pro for every account created before now
 *
 * Nothing here charges anyone. Stripe keys come from STRIPE_SECRET_KEY; without `--live` a live key is refused.
 */
import Stripe from "stripe";
import { and, eq, gt, isNull, lt, or } from "drizzle-orm";
import { PRO_PRICE_CENTS, PRO_PRICE_CURRENCY } from "@/lib/billing/plans";
import { createAccessCode, grantPro, revokeGrants } from "@/lib/billing/grants";
import { authUser } from "@/lib/db/schema/auth";
import { billingGrants } from "@/lib/db/schema/billing";
import { client, db } from "./client";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Value of `--name value` in the arguments, or null. */
function option(args: readonly string[], name: string): string | null {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith("--") ? args[index + 1] : null;
}

/** A `YYYY-MM-DD` date as the end of that day in Rome (23:59:59 CET/CEST is close enough with a 2-hour offset). */
function endOfDay(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Not a date (YYYY-MM-DD): ${value}`);
  return new Date(`${value}T21:59:59.000Z`);
}

function positiveInt(value: string | null, name: string): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`--${name} must be a positive whole number`);
  return parsed;
}

async function userIdByEmail(email: string): Promise<string> {
  const [user] = await db.select({ id: authUser.id }).from(authUser).where(eq(authUser.email, email.trim().toLowerCase())).limit(1);
  if (!user) throw new Error(`No account with the email ${email}`);
  return user.id;
}

async function grant(args: string[]): Promise<void> {
  const email = args[0];
  if (!email?.includes("@")) throw new Error("Usage: pnpm billing:grant <email> [--days N | --until YYYY-MM-DD] [--note text]");
  const now = new Date();
  const days = positiveInt(option(args, "days"), "days");
  const until = option(args, "until");
  const endsAt = days ? new Date(now.getTime() + days * DAY_MS) : until ? endOfDay(until) : null;
  const entitlement = await grantPro({ userId: await userIdByEmail(email), source: "admin", endsAt, note: option(args, "note") ?? "" }, now);
  console.log(`Pro given to ${email} ${endsAt ? `until ${endsAt.toISOString()}` : "for good"} (access now until ${entitlement.proUntil?.toISOString() ?? "—"}).`);
}

async function revoke(args: string[]): Promise<void> {
  const email = args[0];
  if (!email?.includes("@")) throw new Error("Usage: pnpm billing:revoke <email>");
  const { revoked, entitlement } = await revokeGrants(await userIdByEmail(email));
  console.log(`${revoked} free Pro grant(s) revoked for ${email}. Plan now: ${entitlement.proUntil ? `Pro (${entitlement.source}) until ${entitlement.proUntil.toISOString()}` : "Free"}.`);
}

async function code(args: string[]): Promise<void> {
  const label = option(args, "label");
  if (!label) throw new Error("Usage: pnpm billing:code --label text [--days N] [--uses N] [--expires YYYY-MM-DD]");
  const durationDays = positiveInt(option(args, "days"), "days");
  const maxRedemptions = positiveInt(option(args, "uses"), "uses") ?? 1;
  const expires = option(args, "expires");
  const value = await createAccessCode({ label, durationDays, maxRedemptions, expiresAt: expires ? endOfDay(expires) : null });
  console.log(`Access code (shown only now, only its hash is stored):\n\n  ${value}\n\nPro ${durationDays ? `for ${durationDays} days` : "for good"}, ${maxRedemptions} use(s)${expires ? `, valid until ${expires}` : ""}. Redeem it from the plans page (/pro → «Hai un codice?»).`);
}

/** Free Pro for every account created before now that has no running grant yet (the launch of the paid plan). */
async function grantExisting(args: string[]): Promise<void> {
  const until = option(args, "until");
  if (!until) throw new Error("Usage: pnpm billing:grant-existing --until YYYY-MM-DD [--dry-run]");
  const endsAt = endOfDay(until);
  const now = new Date();
  const users = await db.select({ id: authUser.id }).from(authUser).where(lt(authUser.createdAt, now));
  const running = await db
    .select({ userId: billingGrants.userId })
    .from(billingGrants)
    .where(and(isNull(billingGrants.revokedAt), or(isNull(billingGrants.endsAt), gt(billingGrants.endsAt, now))));
  const covered = new Set(running.map((row) => row.userId));
  const targets = users.filter((user) => !covered.has(user.id));
  if (args.includes("--dry-run")) {
    console.log(`Dry run: ${targets.length} of ${users.length} accounts would get Pro until ${endsAt.toISOString()} (${covered.size} already have a running grant).`);
    return;
  }
  for (const user of targets) await grantPro({ userId: user.id, source: "launch", endsAt, note: "launch" }, now);
  console.log(`${targets.length} accounts got Pro until ${endsAt.toISOString()} (${covered.size} already had a running grant).`);
}

/** Creates the Pro product, the two prices and the Customer Portal configuration, and prints the values for the env. */
async function stripeSetup(args: string[]): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  const live = !/^(sk|rk)_test_/.test(key);
  if (live && !args.includes("--live")) throw new Error("This is a live key: run again with --live if that is intended");
  const stripe = new Stripe(key);
  const currency = PRO_PRICE_CURRENCY.toLowerCase();
  const existing = await stripe.prices.list({ lookup_keys: ["buddybudget_pro_month", "buddybudget_pro_year"], expand: ["data.product"] });
  const byKey = new Map(existing.data.map((price) => [price.lookup_key, price]));
  let productId = existing.data[0] ? (existing.data[0].product as Stripe.Product).id : null;
  if (!productId) {
    const product = await stripe.products.create({ name: "BuddyBudget Pro", description: "Tutte le sezioni di BuddyBudget sbloccate." });
    productId = product.id;
  }
  const ensurePrice = async (interval: "month" | "year") => {
    const lookupKey = `buddybudget_pro_${interval}`;
    const found = byKey.get(lookupKey);
    if (found && found.unit_amount === PRO_PRICE_CENTS[interval] && found.active) return found.id;
    // A changed amount is a new price (Stripe prices cannot change); the lookup key moves to it.
    const price = await stripe.prices.create({
      product: productId!,
      currency,
      unit_amount: PRO_PRICE_CENTS[interval],
      recurring: { interval },
      tax_behavior: "inclusive",
      lookup_key: lookupKey,
      transfer_lookup_key: true,
    });
    return price.id;
  };
  const month = await ensurePrice("month");
  const year = await ensurePrice("year");
  const portal = await stripe.billingPortal.configurations.create({
    business_profile: { headline: "BuddyBudget Pro", privacy_policy_url: "https://buddybudget.io/privacy", terms_of_service_url: "https://buddybudget.io/termini" },
    features: {
      customer_update: { enabled: false },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end", cancellation_reason: { enabled: true, options: ["too_expensive", "missing_features", "unused", "other"] } },
      subscription_update: { enabled: true, default_allowed_updates: ["price"], proration_behavior: "create_prorations", products: [{ product: productId!, prices: [month, year] }] },
    },
  });
  console.log(`Stripe ${live ? "LIVE" : "test"} setup done. Put these in the app's Secret (never in chat or git):\n\n  STRIPE_PRICE_MONTHLY=${month}\n  STRIPE_PRICE_YEARLY=${year}\n  STRIPE_PORTAL_CONFIGURATION=${portal.id}\n\nThen add the webhook endpoint https://app.buddybudget.io/api/stripe/webhook with the events listed in docs/architecture/billing.md and set STRIPE_WEBHOOK_SECRET.`);
}

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  "stripe-setup": stripeSetup,
  grant,
  revoke,
  code,
  "grant-existing": grantExisting,
};

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const run = COMMANDS[command ?? ""];
  if (!run) {
    console.error(`Usage: pnpm billing:<${Object.keys(COMMANDS).join("|")}> …`);
    process.exitCode = 1;
    return;
  }
  await run(args);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
