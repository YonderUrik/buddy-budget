import { describe, expect, it } from "vitest";
import { resolveDeepLink } from "@/lib/native/deep-link";
import { appReturnDeepLink, appReturnPage } from "./app-return";

describe("appReturnDeepLink", () => {
  it("carries the bank's parameters to the callback inside the app", () => {
    const link = appReturnDeepLink(new URLSearchParams({ ref: "c0nn", error: "UserCancelledSession" }));
    expect(resolveDeepLink(link, "https://app.buddybudget.io")).toBe("/api/gocardless/callback?ref=c0nn&error=UserCancelledSession");
  });

  it("still opens the callback without parameters", () => {
    expect(resolveDeepLink(appReturnDeepLink(new URLSearchParams()), "https://app.buddybudget.io")).toBe("/api/gocardless/callback");
  });
});

describe("appReturnPage", () => {
  it("escapes texts and the link", () => {
    const html = appReturnPage('buddybudget://open?path=%2F"><script>', { title: "<b>", body: "x", button: "Apri" }, "it");
    expect(html).not.toContain('"><script>');
    expect(html).toContain("&#60;b&#62;");
  });
});
