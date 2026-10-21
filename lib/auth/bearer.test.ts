import { describe, expect, it, vi } from "vitest";

// The auth instance only needs a database handle to be built; no query runs in these tests.
vi.mock("@/lib/db/client", () => ({ db: {} }));

describe("auth configuration for native clients", async () => {
  const { auth } = await import("./index");

  it("enables the bearer plugin, so `Authorization: Bearer <session token>` works on every getSession call", () => {
    expect(auth.options.plugins?.map((plugin) => plugin.id)).toContain("bearer");
  });

  it("keeps signed tokens optional: the raw token from /magic-link/verify is accepted as is", () => {
    const bearer = auth.options.plugins?.find((plugin) => plugin.id === "bearer") as { options?: { requireSignature?: boolean } } | undefined;
    expect(bearer?.options?.requireSignature).toBeUndefined();
  });

  it("enables the email OTP plugin for native sign-in, with 6-digit hashed codes valid 10 minutes", () => {
    const otp = auth.options.plugins?.find((plugin) => plugin.id === "email-otp") as
      | { options?: { otpLength?: number; expiresIn?: number; storeOTP?: string; disableSignUp?: boolean } }
      | undefined;
    expect(otp?.options).toMatchObject({ otpLength: 6, expiresIn: 600, storeOTP: "hashed" });
    expect(otp?.options?.disableSignUp).toBeUndefined();
  });

  it("ignores a bearer token that is not a valid session", async () => {
    await expect(auth.api.getSession({ headers: new Headers({ Authorization: "Bearer not.a-valid-signature" }) })).resolves.toBeNull();
  });
});
