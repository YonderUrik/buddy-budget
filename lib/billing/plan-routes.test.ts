import { describe, expect, it } from "vitest";
import { isPlanPathAvailable, isProPath, parseProArea, proAreaOf } from "./plan-routes";

describe("plan routes", () => {
  it.each(["/panoramica", "/investimenti", "/investimenti/titoli/abc", "/pensione/scenari", "/debiti", "/analitiche/obiettivi", "/api/investments/portfolio", "/api/debts", "/api/sidebar/summary", "/api/goals", "/api/instruments/x"])(
    "%s needs Pro",
    (path) => expect(isProPath(path)).toBe(true),
  );

  it.each(["/liquidita", "/liquidita/conti", "/categorizza", "/importazioni", "/impostazioni", "/aiuto", "/pro", "/api/transactions", "/api/accounts", "/api/net-worth/history", "/api/billing/status", "/api/user/settings", "/panoramicax", "/api/debtsx"])(
    "%s is open on Free",
    (path) => expect(isProPath(path)).toBe(false),
  );

  it("names the area of a page and opens everything to Pro", () => {
    expect(proAreaOf("/investimenti/tasse")).toBe("investimenti");
    expect(proAreaOf("/api/debts")).toBeNull();
    expect(isPlanPathAvailable("pro", "/investimenti")).toBe(true);
    expect(isPlanPathAvailable("free", "/investimenti")).toBe(false);
  });

  it("accepts only known areas in ?da=", () => {
    expect(parseProArea("debiti")).toBe("debiti");
    expect(parseProArea("../x")).toBeNull();
    expect(parseProArea(null)).toBeNull();
  });
});
