import { describe, expect, it } from "vitest";
import { PRIVACY_EMAIL } from "./links";
import { buildPrivacyRequestHref, PRIVACY_REQUEST_OPTIONS } from "./requests";

describe("richieste privacy", () => {
  it("il link va all'indirizzo privacy con oggetto e testo compilati", () => {
    const href = buildPrivacyRequestHref(PRIVACY_REQUEST_OPTIONS[0], "mario@example.com");
    expect(href.startsWith(`mailto:${PRIVACY_EMAIL}?`)).toBe(true);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("subject")).toContain(PRIVACY_REQUEST_OPTIONS[0].label);
    expect(params.get("body")).toContain("mario@example.com");
    expect(params.get("body")).toContain(PRIVACY_REQUEST_OPTIONS[0].article);
  });

  it("ogni richiesta ha un tipo diverso", () => {
    const types = PRIVACY_REQUEST_OPTIONS.map((o) => o.type);
    expect(new Set(types).size).toBe(types.length);
  });
});
