import { describe, expect, it } from "vitest";
import { resolveDeepLink } from "./deep-link";

const ORIGIN = "https://app.buddybudget.io";

describe("resolveDeepLink", () => {
  it("keeps path, query and hash of a link on the app's origin", () => {
    expect(resolveDeepLink(`${ORIGIN}/api/auth/magic-link/verify?token=abc#x`, ORIGIN)).toBe("/api/auth/magic-link/verify?token=abc#x");
  });

  it("opens screens of the app through the custom scheme", () => {
    expect(resolveDeepLink("buddybudget://open?path=/analitiche/obiettivi?da=notifica", ORIGIN)).toBe("/analitiche/obiettivi?da=notifica");
  });

  it("reads the path of the custom scheme", () => {
    expect(resolveDeepLink("buddybudget://open?path=%2Fapi%2Fgocardless%2Fcallback%3Fref%3D1", ORIGIN)).toBe("/api/gocardless/callback?ref=1");
  });

  it.each([
    ["another host", "https://evil.example/liquidita"],
    ["http instead of https", "http://app.buddybudget.io/liquidita"],
    ["scheme with an unknown action", "buddybudget://pay?path=/liquidita"],
    ["scheme without a path", "buddybudget://open"],
    ["protocol-relative path", "buddybudget://open?path=//evil.example"],
    ["backslash path", "buddybudget://open?path=/\\evil.example"],
    ["relative path", "buddybudget://open?path=liquidita"],
    ["not a URL", "not a url"],
    ["an API endpoint outside the list", "buddybudget://open?path=/api/user/account"],
    ["the API root", "buddybudget://open?path=/api?x=1"],
    ["an app-origin link to another API", `${ORIGIN}/api/user/export`],
  ])("ignores %s", (_label, url) => {
    expect(resolveDeepLink(url, ORIGIN)).toBeNull();
  });
});
