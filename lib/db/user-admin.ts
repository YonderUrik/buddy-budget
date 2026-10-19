/**
 * Account administration for self-hosted installs without an email service, run by whoever manages the instance:
 *
 *   pnpm auth:reset-password <email>          # new password for an existing account (signs it out everywhere)
 *   pnpm auth:create-user <email> [name...]   # new account with a password, even when signups are closed
 *
 * With docker compose: `docker compose run --rm migrate pnpm auth:reset-password you@example.com`.
 * The new password is generated here and printed once; change it from Impostazioni → Account → Password.
 */
import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { defaultCategoryRows } from "@/lib/categories/seed";
import { categories } from "@/lib/db/schema/categories";
import { authAccount, authSession, authUser } from "@/lib/db/schema/auth";
import { client, db } from "./client";

/** better-auth's provider id for email and password accounts. */
const CREDENTIAL_PROVIDER = "credential";

/** Random password of 20 characters (letters and digits, no look-alikes), easy to copy from a terminal. */
export function generatePassword(length = 20): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(length), (byte) => alphabet[byte % alphabet.length]).join("");
}

/** Id in better-auth's format (32 random characters). */
function newId(): string {
  return randomBytes(24).toString("base64url").slice(0, 32);
}

/** Sets `password` as the account's password, creating the email/password sign-in if it had only link or Google. */
async function setPassword(userId: string, password: string): Promise<void> {
  const hash = await hashPassword(password);
  const now = new Date();
  const updated = await db
    .update(authAccount)
    .set({ password: hash, updatedAt: now })
    .where(and(eq(authAccount.userId, userId), eq(authAccount.providerId, CREDENTIAL_PROVIDER)))
    .returning({ id: authAccount.id });
  if (updated.length === 0) {
    await db.insert(authAccount).values({ id: newId(), userId, accountId: userId, providerId: CREDENTIAL_PROVIDER, password: hash, createdAt: now, updatedAt: now });
  }
}

async function resetPassword(email: string): Promise<void> {
  const [user] = await db.select({ id: authUser.id }).from(authUser).where(eq(authUser.email, email)).limit(1);
  if (!user) throw new Error(`No account with the email ${email}. To create one: pnpm auth:create-user ${email}`);
  const password = generatePassword();
  await setPassword(user.id, password);
  // Whoever had the old password (or a stolen session) is signed out.
  await db.delete(authSession).where(eq(authSession.userId, user.id));
  console.log(`New password for ${email}:\n\n  ${password}\n\nAll sessions of this account were closed. Change it after signing in (Impostazioni → Account → Password).`);
}

async function createUser(email: string, name: string): Promise<void> {
  const [existing] = await db.select({ id: authUser.id }).from(authUser).where(eq(authUser.email, email)).limit(1);
  if (existing) throw new Error(`An account with the email ${email} already exists. To give it a new password: pnpm auth:reset-password ${email}`);
  const id = newId();
  const password = generatePassword();
  await db.insert(authUser).values({ id, name, email, emailVerified: false });
  await setPassword(id, password);
  // The same default categories the app seeds when an account signs up.
  await db.insert(categories).values(defaultCategoryRows(id));
  console.log(`Account created for ${email}. Password:\n\n  ${password}\n\nOn the first sign-in the app asks for language and currency. Change the password from Impostazioni → Account → Password.`);
}

async function main() {
  const [command, rawEmail, ...nameParts] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  if (!email || !email.includes("@") || (command !== "reset-password" && command !== "create-user")) {
    console.error("Usage: pnpm auth:reset-password <email> | pnpm auth:create-user <email> [name]");
    process.exitCode = 1;
    return;
  }
  if (command === "reset-password") await resetPassword(email);
  else await createUser(email, nameParts.join(" ").trim() || email.split("@")[0]);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
