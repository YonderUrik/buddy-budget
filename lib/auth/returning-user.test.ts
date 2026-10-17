import { describe, expect, it } from "vitest";
import { maskEmail, parseReturningUser, toReturningMethod } from "./returning-user";

describe("toReturningMethod", () => {
  it("maps better-auth methods and ignores unknown ones", () => {
    expect(toReturningMethod("magic-link")).toBe("email");
    expect(toReturningMethod("google")).toBe("google");
    expect(toReturningMethod("passkey")).toBeNull();
    expect(toReturningMethod(null)).toBeNull();
  });
});

describe("parseReturningUser", () => {
  it("reads a valid entry", () => {
    expect(parseReturningUser(JSON.stringify({ email: "a@b.it", method: "google" }))).toEqual({ email: "a@b.it", method: "google" });
  });

  it("drops an unknown method but keeps the email", () => {
    expect(parseReturningUser(JSON.stringify({ email: "a@b.it", method: "sms" }))).toEqual({ email: "a@b.it", method: null });
  });

  it("treats malformed values as nothing remembered", () => {
    expect(parseReturningUser(null)).toBeNull();
    expect(parseReturningUser("not json")).toBeNull();
    expect(parseReturningUser(JSON.stringify({ email: "no-at-sign" }))).toBeNull();
    expect(parseReturningUser(JSON.stringify("a@b.it"))).toBeNull();
  });
});

describe("maskEmail", () => {
  it("keeps the first characters and the domain", () => {
    expect(maskEmail("daniele@gmail.com")).toBe("dan•••@gmail.com");
  });

  it("never shows a short local part in full", () => {
    expect(maskEmail("ab@x.it")).toBe("a•••@x.it");
    expect(maskEmail("a@x.it")).toBe("a•••@x.it");
  });
});
