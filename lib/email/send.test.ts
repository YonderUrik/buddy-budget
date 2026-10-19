import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn();
const resendSend = vi.fn();
vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn(() => ({ sendMail })) } }));
vi.mock("resend", () => ({ Resend: vi.fn(function Resend() { return { emails: { send: resendSend } }; }) }));

const { sendEmail } = await import("./send");

const MESSAGE = { to: "user@example.com", subject: "Ciao", text: "testo" };

describe("sendEmail", () => {
  beforeEach(() => {
    sendMail.mockReset();
    resendSend.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("does nothing without a configured transport", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("SMTP_URL", "");
    expect(await sendEmail(MESSAGE)).toEqual({ ok: false, reason: "email_not_configured" });
  });

  it("sends through SMTP with the sender from EMAIL_FROM", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("SMTP_URL", "smtp://mail:25");
    vi.stubEnv("EMAIL_FROM", "bb@example.com");
    sendMail.mockResolvedValue({});
    expect(await sendEmail({ ...MESSAGE, headers: { "List-Unsubscribe": "<x>" } })).toEqual({ ok: true });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: "bb@example.com", to: "user@example.com", headers: { "List-Unsubscribe": "<x>" } }));
  });

  it("turns an SMTP error into its code, never its message", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("SMTP_URL", "smtp://mail:25");
    vi.stubEnv("EMAIL_FROM", "bb@example.com");
    sendMail.mockRejectedValue(Object.assign(new Error("535 auth failed for user@example.com"), { code: "EAUTH" }));
    expect(await sendEmail(MESSAGE)).toEqual({ ok: false, reason: "smtp_EAUTH" });
  });

  it("uses Resend when its key is set and passes the idempotency key", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_x");
    vi.stubEnv("RESEND_FROM", "noreply@example.com");
    vi.stubEnv("EMAIL_FROM", "");
    resendSend.mockResolvedValue({ error: null });
    expect(await sendEmail({ ...MESSAGE, idempotencyKey: "k1" })).toEqual({ ok: true });
    expect(resendSend).toHaveBeenCalledWith(expect.objectContaining({ from: "noreply@example.com" }), { idempotencyKey: "k1" });
    resendSend.mockResolvedValue({ error: { name: "validation_error" } });
    expect(await sendEmail(MESSAGE)).toEqual({ ok: false, reason: "validation_error" });
  });
});
