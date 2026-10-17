/**
 * Sample data for the landing screenshots: (re)creates the "Giulia Demo" user with `seedDemoAccount`
 * (`lib/public-demo/seed.ts`, the same data as the public demo) and a fixed session for the capture script.
 *
 * Runs on an EMPTY, migrated database (never the production or a development DB with real data): it refuses to start
 * if the database contains users other than the demo one.
 * Usage: `pnpm demo:seed` with `DATABASE_URL` pointing to the demo database. See `docs/landing-screens.md`.
 * `DEMO_LANGUAGE=en|de` seeds the same data with texts in that language (German also gets the German product rules),
 * so the landing screenshots can be captured in every interface language; it re-creates the demo user each time.
 */
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { LANGUAGES, type Language } from "@/lib/localization/config";
import { seedDemoAccount } from "@/lib/public-demo/seed";

export const DEMO_USER_ID = "demo-user";
export const DEMO_SESSION_TOKEN = "demo-session-token-0000000000000000";

const LANGUAGE = (process.env.DEMO_LANGUAGE ?? "it") as Language;
if (!LANGUAGES.includes(LANGUAGE)) throw new Error(`DEMO_LANGUAGE must be one of ${LANGUAGES.join(", ")}`);

async function main() {
  const others = await db.select({ id: authUser.id }).from(authUser);
  if (others.some((user) => user.id !== DEMO_USER_ID)) {
    throw new Error("The database already contains other users: the demo seed only runs on an empty database.");
  }
  const result = await seedDemoAccount({
    userId: DEMO_USER_ID,
    email: "giulia.demo@example.com",
    language: LANGUAGE,
    screenshotSession: { id: "demo-session", token: DEMO_SESSION_TOKEN },
  });
  console.log(`Demo ready: ${result.transactions} transactions, ${result.operations} operations, ${result.prices} prices.`);
  await client.end();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
