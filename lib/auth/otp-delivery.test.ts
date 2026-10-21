import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { bearer } from "better-auth/plugins";

const { sendEmail, recordAuthEvent, log, accountRows, canCreateAccount } = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  recordAuthEvent: vi.fn(),
  accountRows: vi.fn(),
  canCreateAccount: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/email/send", () => ({ sendEmail }));
vi.mock("@/lib/observability", () => ({ recordAuthEvent, requestLogger: () => log }));
vi.mock("./signup-gate", () => ({ canCreateAccount, SIGNUPS_CLOSED_CODE: "SIGNUPS_CLOSED" }));
vi.mock("@/lib/db/client", () => ({ db: {
  select: () => ({ from: () => ({ where: () => ({ limit: accountRows }) }) }),
} }));

import { auth as configuredAuth } from "./index";

const BASE_URL = "http://localhost:3000";
const EMAIL = "user@example.test";

beforeEach(() => {
  vi.clearAllMocks();
  accountRows.mockResolvedValue([{ id: "user-1", language: "en" }]);
  canCreateAccount.mockResolvedValue(true);
  vi.stubEnv("APP_URL", BASE_URL);
  vi.stubEnv("NODE_ENV", "production");
});
afterEach(() => vi.unstubAllEnvs());

function fixture() {
  // Exercise the configured delivery callback through better-auth's real HTTP pipeline, with an in-memory DB.
  const otp = configuredAuth.options.plugins!.find((plugin) => plugin.id === "email-otp")!;
  const auth = betterAuth({
    baseURL: BASE_URL,
    secret: "test-only-otp-delivery-secret-at-least-32-characters",
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    plugins: [otp, bearer()],
    rateLimit: { enabled: false },
  });
  const post = (path: string, body: unknown) => auth.handler(new Request(`${BASE_URL}/api/auth${path}`, {
    method: "POST",
    headers: { Origin: BASE_URL, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
  const send = () => post("/email-otp/send-verification-otp", { email: EMAIL, type: "sign-in" });
  return { auth, post, send };
}

describe("email OTP delivery", () => {
  it("preserves the closed-signup refusal without sending a code", async () => {
    accountRows.mockResolvedValue([]);
    canCreateAccount.mockResolvedValue(false);
    const response = await fixture().send();
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "SIGNUPS_CLOSED" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it.each(["email_not_configured", "resend_failed", "smtp_failed"])("reports %s as an actionable production error without logging the code", async (reason) => {
    sendEmail.mockResolvedValue({ ok: false, reason });
    const response = await fixture().send();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "OTP_DELIVERY_FAILED" });
    expect(recordAuthEvent).toHaveBeenCalledWith("otp_failed");
    expect(recordAuthEvent).not.toHaveBeenCalledWith("otp_sent");
    expect(log.info).not.toHaveBeenCalled();
  });

  it.each(["email_not_configured", "resend_failed"])("keeps the development fallback for %s", async (reason) => {
    vi.stubEnv("NODE_ENV", "development");
    sendEmail.mockResolvedValue({ ok: false, reason });
    const { auth, post, send } = fixture();
    const response = await send();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(log.info).toHaveBeenCalledWith("auth.otp.dev_code", { devCode: expect.stringMatching(/^\d{6}$/) });
    const otp = log.info.mock.calls.find(([event]) => event === "auth.otp.dev_code")![1].devCode;
    const signIn = await post("/sign-in/email-otp", { email: EMAIL, otp });
    expect(signIn.status).toBe(200);
    expect((await auth.api.getSession({ headers: new Headers({ Authorization: `Bearer ${signIn.headers.get("set-auth-token")}` }) }))?.user.email).toBe(EMAIL);
  });

  it("delivers a usable code in production and rejects replay after sign-in", async () => {
    sendEmail.mockResolvedValue({ ok: true });
    const { auth, post, send } = fixture();
    expect((await send()).status).toBe(200);
    expect(recordAuthEvent).toHaveBeenCalledWith("otp_sent");
    expect(recordAuthEvent).not.toHaveBeenCalledWith("otp_failed");
    expect(log.info).not.toHaveBeenCalledWith("auth.otp.dev_code", expect.anything());
    const otp = sendEmail.mock.lastCall![0].subject.match(/\d{6}/)![0];
    const response = await post("/sign-in/email-otp", { email: EMAIL, otp });
    expect(response.status).toBe(200);
    expect((await auth.api.getSession({ headers: new Headers({ Authorization: `Bearer ${response.headers.get("set-auth-token")}` }) }))?.user.email).toBe(EMAIL);
    expect((await post("/sign-in/email-otp", { email: EMAIL, otp })).status).toBe(400);
  });
});
