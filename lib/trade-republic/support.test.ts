import { beforeEach, describe, expect, it, vi } from "vitest";
const { send, set, del } = vi.hoisted(() => ({ send: vi.fn(), set: vi.fn(), del: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/email/send", () => ({ sendEmail: send }));
vi.mock("@/lib/redis/client", () => ({ redis: { set, del } }));
import { notifyTradeRepublicSupport, tradeRepublicProblemSignature, tradeRepublicSupportEmail } from "./support";

const trail = (eventType: string) => JSON.stringify(["sync.start {}", `timeline.problems {"findings":[{"key":"unknown-event-type {\\"eventType\\":\\"${eventType}\\"}","count":2}]}`]);
beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); set.mockResolvedValue("OK"); del.mockResolvedValue(1); send.mockResolvedValue({ ok: true }); });

describe("Trade Republic support emails", () => {
  it("emails support for adapter problems, once per distinct problem", async () => {
    await notifyTradeRepublicSupport("investments", "invalid-response", trail("NEW_TYPE"), "user-1");
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "support@buddybudget.io", subject: expect.stringContaining("investimenti") }));
    set.mockResolvedValueOnce(null);
    await notifyTradeRepublicSupport("investments", "invalid-response", trail("NEW_TYPE"), "user-2");
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("stays quiet for user-side outcomes and on self-hosted installs without a support address", async () => {
    for (const reason of ["expired", "rate-limited", "existing-import", "unavailable"]) await notifyTradeRepublicSupport("login", reason, "[]", "user-1");
    vi.stubEnv("SELF_HOSTED", "true");
    await notifyTradeRepublicSupport("sync", "invalid-response", "[]", "user-1");
    expect(send).not.toHaveBeenCalled();
  });
  it("frees the daily slot when delivery fails, so the next failure retries", async () => {
    send.mockResolvedValueOnce({ ok: false, reason: "email_not_configured" });
    await notifyTradeRepublicSupport("sync", "internal", "[]", "user-1");
    expect(del).toHaveBeenCalledTimes(1);
  });
  it("tells problems apart by their checks, and carries no user id or values", () => {
    expect(tradeRepublicProblemSignature("sync", "unsupported-event", trail("A"))).not.toBe(tradeRepublicProblemSignature("sync", "unsupported-event", trail("B")));
    const email = tradeRepublicSupportEmail("sync", "unsupported-event", trail("A"), "abc123hash");
    expect(email.text).toContain("abc123hash"); expect(email.text).toContain("unknown-event-type"); expect(email.text).not.toContain("user-1");
  });
});
