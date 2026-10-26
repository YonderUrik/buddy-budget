import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/server", async original => ({ ...await original<typeof import("next/server")>(), after: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/crypto/field-encryption", () => ({ dataEncryptionKey: () => Buffer.alloc(32) }));
vi.mock("@/lib/investments/operations", () => ({ getUserCurrency: async () => "EUR" }));
vi.mock("@/lib/start/demo", () => ({ rejectIfDemoActive: async () => null }));
vi.mock("@/lib/trade-republic", async () => ({ TradeRepublicError: (await import("@/lib/trade-republic/client")).TradeRepublicError, createTradeRepublicClient: vi.fn(), connectTradeRepublic: vi.fn(), prepareTradeRepublicSync: vi.fn(), runTradeRepublicSync: vi.fn(), readPendingLogin: vi.fn(), savePendingLogin: vi.fn(), clearPendingLogin: vi.fn(), allowTradeRepublicAttempt: vi.fn(), withTradeRepublicLoginLock: vi.fn(), tradeRepublicDebug: vi.fn(), describeError: vi.fn(), withTradeRepublicDiagnostics: (action: () => Promise<unknown>) => action(), tradeRepublicDiagnostics: () => "[]" }));
import { auth } from "@/lib/auth";
import * as tr from "@/lib/trade-republic";
import { POST, GET, DELETE } from "./route";
const request = (body: object, origin = "http://localhost") => new NextRequest("http://localhost/api/trade-republic/login", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_URL", "http://localhost");
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "owner", currency: "EUR" } } as never);
  vi.mocked(tr.allowTradeRepublicAttempt).mockResolvedValue(true);
  vi.mocked(tr.withTradeRepublicLoginLock).mockImplementation(async (_user, action) => action());
});
afterEach(() => vi.unstubAllEnvs());
describe("Trade Republic sign-in boundary", () => {
  it("rejects unauthenticated and cross-origin login attempts", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null as never);
    expect((await POST(request({ action: "poll" }))).status).toBe(401);
    expect((await POST(request({ action: "poll" }, "https://untrusted.example"))).status).toBe(403);
    expect(tr.createTradeRepublicClient).not.toHaveBeenCalled();
  });
  it("validates phone/PIN and rate-limits before contacting TR", async () => {
    expect((await POST(request({ action: "login", phoneNumber: "123", pin: "12" }))).status).toBe(400);
    vi.mocked(tr.allowTradeRepublicAttempt).mockResolvedValueOnce(false);
    expect((await POST(request({ action: "login", phoneNumber: "+49123456789", pin: "1234" }))).status).toBe(429);
    expect(tr.createTradeRepublicClient).not.toHaveBeenCalled();
  });
  it("stores only a user-scoped session after sending credentials once", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    vi.mocked(tr.createTradeRepublicClient).mockReturnValue({ login } as never);
    const response = await POST(request({ action: "login", phoneNumber: "+49123456789", pin: "1234" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "pending", needsAuthenticator: false });
    expect(login).toHaveBeenCalledWith("+49123456789", "1234");
    const [owner, saved] = vi.mocked(tr.savePendingLogin).mock.calls[0];
    expect(owner).toBe("owner"); expect(saved).not.toHaveProperty("pin"); expect(saved).not.toHaveProperty("phoneNumber");
  });
  it("creates the background sync only after provider approval", async () => {
    vi.mocked(tr.readPendingLogin).mockResolvedValue({ cookies: { JSESSIONID: "secret" }, deviceId: "device" });
    vi.mocked(tr.createTradeRepublicClient).mockReturnValue({ loginState: async () => ({ status: "confirmed" }) } as never);
    vi.mocked(tr.connectTradeRepublic).mockResolvedValue("account");
    vi.mocked(tr.prepareTradeRepublicSync).mockResolvedValue({ status: "started", job: { id: "job" } } as never);
    const response = await POST(request({ action: "poll" }));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ status: "connected", accountId: "account", jobId: "job" });
    expect(tr.connectTradeRepublic).toHaveBeenCalledWith("owner", expect.any(Object));
    expect(tr.clearPendingLogin).toHaveBeenCalledWith("owner");
  });
  it("never exposes provider errors or cookies, even on failure", async () => {
    vi.mocked(tr.readPendingLogin).mockRejectedValue(new Error("JSESSIONID=secret PIN=1234"));
    const response = await POST(request({ action: "poll" }));
    expect(response.status).toBe(502); expect(await response.text()).not.toMatch(/secret|1234/);
  });
  it("status and cancellation are scoped to the signed-in user", async () => {
    vi.mocked(tr.readPendingLogin).mockResolvedValue({ cookies: { JSESSIONID: "secret" }, deviceId: "device" });
    expect(await (await GET(new NextRequest("http://localhost/api/trade-republic/login"))).json()).toEqual({ pending: true, configured: true });
    const response = await DELETE(new NextRequest("http://localhost/api/trade-republic/login", { method: "DELETE", headers: { origin: "http://localhost" } }));
    expect(response.status).toBe(204); expect(tr.clearPendingLogin).toHaveBeenCalledWith("owner");
  });
});
