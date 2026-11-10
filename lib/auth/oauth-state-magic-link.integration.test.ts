import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { auth } from "./index";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";

// Regression for GHSA-965c-763c-88jm (better-auth < 1.7.7): the OAuth `state` of a social sign-in was stored in the
// same verification table as magic link tokens, so an attacker could start a Google sign-in carrying a victim's email
// in `additionalData` and redeem the returned state as a magic link token, signing in as the victim without the
// mailbox. Our configuration (magic link + Google + state in the database) was exposed. This drives the real auth
// instance against the real database and checks the state is no longer accepted as a magic link.
const BASE_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const emails: string[] = [];

afterAll(async () => {
  if (emails.length) await db.delete(authUser).where(inArray(authUser.email, emails));
});

/** Starts a Google sign-in with `email` smuggled into the state, as the attacker would, and returns the state value. */
async function oauthStateFor(email: string): Promise<string> {
  const response = await auth.handler(new Request(`${BASE_URL}/api/auth/sign-in/social`, {
    method: "POST",
    headers: { Origin: BASE_URL, "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "google", disableRedirect: true, additionalData: { email } }),
  }));
  expect(response.status).toBe(200);
  const { url } = (await response.json()) as { url: string };
  const state = new URL(url).searchParams.get("state");
  expect(state).toBeTruthy();
  return state!;
}

/** Redeems `token` on the magic link endpoint and reports whether a session came back. */
async function redeemAsMagicLink(token: string): Promise<{ status: number; signedIn: boolean }> {
  const response = await auth.handler(new Request(`${BASE_URL}/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`, {
    headers: { Origin: BASE_URL },
  }));
  const cookies = response.headers.getSetCookie().join(";");
  return { status: response.status, signedIn: cookies.includes("session_token=") && !cookies.includes("session_token=;") };
}

describe.skipIf(!process.env.GOOGLE_CLIENT_ID)("OAuth state cannot be used as a magic link (GHSA-965c-763c-88jm)", () => {
  it("does not sign in as an existing user", async () => {
    const email = `victim-${randomUUID()}@example.test`;
    emails.push(email);
    const ctx = await auth.$context;
    await ctx.internalAdapter.createUser({ name: "Victim", email, emailVerified: true }, { method: "admin" });

    const result = await redeemAsMagicLink(await oauthStateFor(email));
    expect(result.signedIn).toBe(false);
  });

  it("does not create a verified account for an unknown address", async () => {
    const email = `nobody-${randomUUID()}@example.test`;
    emails.push(email);

    const result = await redeemAsMagicLink(await oauthStateFor(email));
    expect(result.signedIn).toBe(false);
    expect(await db.select({ id: authUser.id }).from(authUser).where(inArray(authUser.email, [email]))).toHaveLength(0);
  });
});
