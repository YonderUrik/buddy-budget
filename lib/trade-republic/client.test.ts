import { describe, expect, it, vi } from "vitest";
import { createTradeRepublicClient, type TradeRepublicSession } from "./client";

const session = (): TradeRepublicSession => ({ cookies: {}, deviceId: "synthetic-device" });
describe("Trade Republic web login", () => {
  it("retains cookies on the server and polls app approval without retaining credentials", async () => {
    const state = session();
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ processId: "process" }, { headers: { "set-cookie": "session=secret; Secure; HttpOnly" } }))
      .mockResolvedValueOnce(Response.json({ status: "PENDING", requiredAction: "AUTHENTICATOR_VERIFICATION" }))
      .mockResolvedValueOnce(Response.json({ status: "CONFIRMED" }));
    const client = createTradeRepublicClient(state, fetcher);
    await client.login("+49123456789", "1234");
    expect(state).toEqual({ cookies: { session: "secret" }, deviceId: "synthetic-device", processId: "process" });
    expect(await client.loginState()).toEqual({ status: "pending", needsAuthenticator: true });
    expect(await client.loginState()).toEqual({ status: "confirmed", needsAuthenticator: false });
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({ Cookie: "session=secret" });
  });
  it("never includes upstream secrets in errors", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("PIN=1234; token=secret", { status: 401 }));
    await expect(createTradeRepublicClient(session(), fetcher).login("+49123456789", "1234")).rejects.toThrow("Trade Republic: expired");
  });
  it("rejects unknown login states rather than treating them as approved", async () => {
    const state = { ...session(), processId: "process" };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ status: "REJECTED" }));
    await expect(createTradeRepublicClient(state, fetcher).loginState()).rejects.toThrow("expired");
  });
  it("fails closed on malformed responses and maps rate limits", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({})).mockResolvedValueOnce(new Response(null, { status: 429 }));
    const client = createTradeRepublicClient(session(), fetcher);
    await expect(client.login("+49123456789", "1234")).rejects.toThrow("invalid-response");
    await expect(client.login("+49123456789", "1234")).rejects.toThrow("rate-limited");
  });
});
