import { describe, expect, it } from "vitest";
import { nativeReturnUrl, parseNativeReturn, parseNativeReturnPage } from "./redirect";
import { webBankErrorMessage } from "./return-messages";

const REF = "3f1c2a9e-7b4d-4c1e-9a2f-5d6e7f809a1b";

describe("native bank return", () => {
  it("builds the app address from GoCardless' redirect query", () => {
    expect(nativeReturnUrl(parseNativeReturn(new URLSearchParams(`ref=${REF.toUpperCase()}`)))).toBe(`buddybudget://bank/return?ref=${REF}&status=returned`);
    expect(nativeReturnUrl(parseNativeReturn(new URLSearchParams(`ref=${REF}&error=UserCancelledSession`)))).toBe(
      `buddybudget://bank/return?ref=${REF}&status=cancelled&error=UserCancelledSession`
    );
    expect(nativeReturnUrl(parseNativeReturn(new URLSearchParams("")))).toBe("buddybudget://bank/return?status=invalid_ref");
  });

  it("normalizes the fallback page's query: unknown statuses read as returned, bad refs as invalid_ref", () => {
    expect(parseNativeReturnPage(new URLSearchParams(`ref=${REF}&status=failed&error=X1`))).toEqual({ ref: REF, status: "failed", error: "X1" });
    expect(parseNativeReturnPage(new URLSearchParams(`ref=${REF}&status=weird`))).toEqual({ ref: REF, status: "returned", error: null });
    expect(parseNativeReturnPage(new URLSearchParams("ref=nope&status=returned"))).toEqual({ ref: null, status: "invalid_ref", error: null });
  });

  it("maps the web bankError codes to a message, ignoring unknown ones", () => {
    expect(webBankErrorMessage("consent_failed")).toMatch(/consenso/);
    expect(webBankErrorMessage("whatever")).toBeNull();
    expect(webBankErrorMessage(null)).toBeNull();
  });
});
