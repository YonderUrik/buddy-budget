import { describe, expect, it } from "vitest";
import { isLocalMode, isLocalRequest, validateLocalMode } from "./local-mode";

const local = { SELF_HOSTED: "true", SELFHOST_AUTH_MODE: "local", APP_BIND: "127.0.0.1", APP_URL: "http://localhost:8080", BETTER_AUTH_URL: "http://localhost:8080" };
const request = (headers = {}) => new Request("http://localhost:8080/api/auth/selfhost-local", { headers: { host: "localhost:8080", ...headers } });

describe("automatic personal access", () => {
  it("requires an explicit self-hosted opt-in", () => {
    expect(isLocalMode({})).toBe(false);
    expect(isLocalMode({ SELFHOST_AUTH_MODE: "local" })).toBe(false);
    expect(isLocalMode(local)).toBe(true);
    expect(() => validateLocalMode({ SELFHOST_AUTH_MODE: "local" })).toThrow();
  });
  it.each([
    { SELF_HOSTED: "false" }, { APP_BIND: "0.0.0.0" }, { APP_BIND: "::" },
    { APP_URL: "https://budget.example.com" }, { APP_URL: "http://localhost.evil.test:8080" },
    { BETTER_AUTH_URL: "https://budget.example.com" }, { SELFHOST_AUTH_MODE: "typo" },
  ])("fails closed for unsafe configuration %j", patch => {
    expect(() => validateLocalMode({ ...local, ...patch })).toThrow();
    expect(isLocalRequest(request(), { ...local, ...patch })).toBe(false);
  });
  it("accepts the configured local host and origin", () => {
    expect(isLocalRequest(request(), local)).toBe(true);
    expect(isLocalRequest(request({ origin: local.APP_URL, "sec-fetch-site": "same-origin" }), local)).toBe(true);
  });
  it.each([
    { host: "evil.test:8080" }, { host: "localhost:9999" }, { origin: "https://evil.test" },
    { origin: "null" }, { "sec-fetch-site": "cross-site" }, { "sec-fetch-site": "same-site" },
    { host: "evil.test", "x-forwarded-host": "localhost:8080" },
  ])("rejects rebinding, foreign origins and cross-site requests %j", headers => {
    expect(isLocalRequest(request(headers), local)).toBe(false);
  });
  it("server mode keeps authentication even on localhost", () => {
    expect(isLocalRequest(request(), { ...local, SELFHOST_AUTH_MODE: "server" })).toBe(false);
    expect(() => validateLocalMode({ SELFHOST_AUTH_MODE: "server", APP_URL: "https://budget.example.com", APP_BIND: "0.0.0.0" })).not.toThrow();
  });
});
