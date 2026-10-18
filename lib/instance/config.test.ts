import { describe, expect, it } from "vitest";
import { authMethods, describeInstance, instanceConfig, isSelfHosted, parseFlag } from "./config";

const HOSTED = { RESEND_API_KEY: "re_x", RESEND_FROM: "noreply@example.com", GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" };

describe("parseFlag", () => {
  it("reads true/false and their usual spellings, anything else is unset", () => {
    expect(parseFlag("true")).toBe(true);
    expect(parseFlag(" YES ")).toBe(true);
    expect(parseFlag("0")).toBe(false);
    expect(parseFlag("")).toBeUndefined();
    expect(parseFlag("maybe")).toBeUndefined();
    expect(parseFlag(undefined)).toBeUndefined();
  });
});

describe("authMethods", () => {
  it("hosted version: magic link and Google, no password, open signups", () => {
    expect(authMethods(HOSTED)).toEqual({ password: false, magicLink: true, google: true, emailDelivery: true, openSignup: true });
  });

  it("self-hosted without email: password only, first account only", () => {
    expect(authMethods({ SELF_HOSTED: "true" })).toEqual({ password: true, magicLink: false, google: false, emailDelivery: false, openSignup: false });
  });

  it("self-hosted with SMTP: password plus the emailed link", () => {
    const methods = authMethods({ SELF_HOSTED: "true", SMTP_URL: "smtp://mail:25", EMAIL_FROM: "bb@example.com" });
    expect(methods).toMatchObject({ password: true, magicLink: true, emailDelivery: true });
  });

  it("without email and without the flag, password is on so nobody needs the server log", () => {
    expect(authMethods({})).toMatchObject({ password: true, magicLink: false });
  });

  it("password turned off without email falls back to the link in the log", () => {
    expect(authMethods({ AUTH_PASSWORD: "false" })).toMatchObject({ password: false, magicLink: true, emailDelivery: false });
  });

  it("ALLOW_SIGNUPS overrides the default in both directions", () => {
    expect(authMethods({ SELF_HOSTED: "true", ALLOW_SIGNUPS: "true" }).openSignup).toBe(true);
    expect(authMethods({ ...HOSTED, ALLOW_SIGNUPS: "false" }).openSignup).toBe(false);
  });

  it("Google needs both credentials", () => {
    expect(authMethods({ GOOGLE_CLIENT_ID: "id" }).google).toBe(false);
  });
});

describe("instance summary", () => {
  it("is self-hosted only with SELF_HOSTED=true", () => {
    expect(isSelfHosted({ SELF_HOSTED: "true" })).toBe(true);
    expect(isSelfHosted({})).toBe(false);
    expect(instanceConfig({ SELF_HOSTED: "true" }).selfHosted).toBe(true);
  });

  it("describes the setup in one line without values", () => {
    expect(describeInstance({ SELF_HOSTED: "true", SMTP_URL: "smtps://u:secret@mail:465", EMAIL_FROM: "bb@example.com" })).toBe(
      "self-hosted password=on link=email google=off email=smtp signups=first-account",
    );
    expect(describeInstance({ AUTH_PASSWORD: "false" })).toContain("link=log");
  });
});
