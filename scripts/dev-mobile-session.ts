/**
 * Dev-only: a ready-to-use bearer session for the native apps against a local backend.
 *
 * Ensures a user exists for `--email`, completes onboarding and the legal acceptance, optionally replaces its data
 * with the sample account (`--demo`, `seedDemoAccount` from `lib/public-demo/seed.ts`: accounts, a year of
 * transactions, budgets, subscriptions, investments, goals, debts, pension), then creates a 7-day session and prints
 * its token on stdout (everything else goes to stderr), so it can be redirected to a file:
 *
 *   pnpm -s dev:mobile-session --email mobile-dev@buddybudget.test --demo > token.txt
 *   curl -H "Authorization: Bearer $(cat token.txt)" http://localhost:3001/api/me/bootstrap
 *
 * Options: `--language it|en|de` (default it; with `--demo` also the language of the sample texts), `--demo`.
 * Refuses to run with NODE_ENV=production or when DATABASE_URL is not on localhost (`lib/dev`). `--demo` deletes and
 * re-creates the user, so it only accepts reserved test addresses (`*.test`, `example.com`).
 */
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { devToolRefusal, isDisposableTestEmail } from "@/lib/dev";
import { LANGUAGES, profileForLanguage, type Language } from "@/lib/localization/config";

const SESSION_DAYS = 7;
const SESSION_USER_AGENT = "BuddyBudget-dev-mobile-session";

/** Random id in better-auth's alphabet (letters and digits). */
function randomId(length: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return [...randomBytes(length)].map((byte) => alphabet[byte % alphabet.length]).join("");
}

function fail(message: string): never {
  console.error(`dev-mobile-session: ${message}`);
  process.exit(1);
}

async function main() {
  const { values } = parseArgs({
    options: { email: { type: "string" }, demo: { type: "boolean", default: false }, language: { type: "string", default: "it" } },
  });
  const refusal = devToolRefusal({ nodeEnv: process.env.NODE_ENV, databaseUrl: process.env.DATABASE_URL });
  if (refusal) fail(`refusing to run (${refusal}): this tool only writes to a local development database.`);
  const email = values.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) fail("--email <address> is required.");
  const language = values.language as Language;
  if (!LANGUAGES.includes(language)) fail(`--language must be one of ${LANGUAGES.join(", ")}.`);
  if (values.demo && !isDisposableTestEmail(email)) fail("--demo re-creates the user: use a reserved test address (*.test, example.com).");

  // Imported after the guard: nothing touches the database before it.
  const { eq } = await import("drizzle-orm");
  const { client, db } = await import("@/lib/db/client");
  const { authSession, authUser } = await import("@/lib/db/schema/auth");
  const { categories } = await import("@/lib/db/schema/categories");
  const { defaultCategoryRows } = await import("@/lib/categories/seed");
  const { recordLegalAcceptance } = await import("@/lib/legal/acceptance");
  const { seedDemoAccount } = await import("@/lib/public-demo/seed");

  const [existing] = await db.select({ id: authUser.id }).from(authUser).where(eq(authUser.email, email)).limit(1);
  const userId = existing?.id ?? randomId(32);
  const profile = profileForLanguage(language);

  if (values.demo) {
    const result = await seedDemoAccount({ userId, email, language });
    console.error(`Demo data: ${result.transactions} transactions, ${result.operations} investment operations, ${result.prices} prices.`);
  } else if (!existing) {
    // Same effect as the first sign-in: the user row and the default categories (better-auth's user.create hook).
    await db.insert(authUser).values({ id: userId, name: "", email, emailVerified: true, currency: "EUR", ...profile });
    await db.insert(categories).values(defaultCategoryRows(userId));
    console.error("User created with the default categories.");
  }

  // Onboarding and terms done, as `POST /api/user/onboarding` would leave them; account not deactivated.
  await db.update(authUser).set({ onboardingCompleted: true, deletionScheduledAt: null }).where(eq(authUser.id, userId));
  await recordLegalAcceptance(userId);

  const token = randomId(32);
  const now = new Date();
  await db.insert(authSession).values({
    id: randomId(32),
    userId,
    token,
    expiresAt: new Date(now.getTime() + SESSION_DAYS * 86_400_000),
    createdAt: now,
    updatedAt: now,
    userAgent: SESSION_USER_AGENT,
  });
  console.error(`Session for ${email} (user ${userId}), valid ${SESSION_DAYS} days of inactivity. Token on stdout.`);
  process.stdout.write(`${token}\n`);
  await client.end();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
