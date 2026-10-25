import { afterEach, describe, expect, it, vi } from "vitest";
import { openTradeRepublicSession, sealTradeRepublicSession } from "./session";
afterEach(() => vi.unstubAllEnvs());
describe("Trade Republic session encryption", () => {
  it("requires encryption even on installations that allow other fields in plaintext", () => {
    vi.stubEnv("DATA_ENCRYPTION_KEY", "");
    expect(() => sealTradeRepublicSession({ cookies: { JSESSIONID: "secret" }, deviceId: "device" })).toThrow("not configured");
    expect(() => openTradeRepublicSession('{"cookies":{}}')).toThrow("Unencrypted");
  });
  it("round-trips encrypted cookies and detects tampering", () => {
    vi.stubEnv("DATA_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    const session = { cookies: { JSESSIONID: "synthetic-secret" }, deviceId: "device" };
    const sealed = sealTradeRepublicSession(session);
    expect(sealed).not.toContain("synthetic-secret");
    expect(openTradeRepublicSession(sealed)).toEqual(session);
    expect(() => openTradeRepublicSession(sealed.slice(0, -4) + "AAAA")).toThrow();
  });
});
