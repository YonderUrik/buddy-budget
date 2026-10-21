import { afterEach, describe, expect, it, vi } from "vitest";
import { isBearerOnlyRequest, isTrustedWriteOrigin } from "./same-origin";

const APP_URL = "https://app.buddybudget.io";
const request = (headers: Record<string, string>) => new Request(`${APP_URL}/api/personal-imports`, { method: "POST", headers });

afterEach(() => vi.unstubAllEnvs());

describe("isTrustedWriteOrigin", () => {
  it("accepts cookie requests from the app origin only", () => {
    expect(isTrustedWriteOrigin(request({ cookie: "s=1", origin: APP_URL }), APP_URL)).toBe(true);
    expect(isTrustedWriteOrigin(request({ cookie: "s=1", origin: "https://evil.example" }), APP_URL)).toBe(false);
    expect(isTrustedWriteOrigin(request({ cookie: "s=1" }), APP_URL)).toBe(false);
  });

  it("accepts bearer-only requests without an Origin (native apps)", () => {
    expect(isTrustedWriteOrigin(request({ authorization: "Bearer abc.def" }), APP_URL)).toBe(true);
  });

  it("keeps the check when a bearer request also carries cookies", () => {
    expect(isTrustedWriteOrigin(request({ authorization: "Bearer abc", cookie: "s=1" }), APP_URL)).toBe(false);
    expect(isTrustedWriteOrigin(request({ authorization: "Bearer abc", cookie: "s=1", origin: APP_URL }), APP_URL)).toBe(true);
  });

  it("uses the request URL when APP_URL is not set", () => {
    vi.stubEnv("APP_URL", undefined);
    expect(isTrustedWriteOrigin(request({ origin: APP_URL }))).toBe(true);
  });
});

describe("isBearerOnlyRequest", () => {
  it.each([
    [{ authorization: "Bearer token" }, true],
    [{ authorization: "bearer token" }, true],
    [{ authorization: "Bearer " }, false],
    [{ authorization: "Basic dXNlcg==" }, false],
    [{}, false],
  ])("%o → %s", (headers, expected) => {
    expect(isBearerOnlyRequest(new Headers(headers))).toBe(expected);
  });
});
