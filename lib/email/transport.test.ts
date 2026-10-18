import { describe, expect, it } from "vitest";
import { emailFrom, emailTransport, isEmailConfigured } from "./transport";

describe("email transport", () => {
  it("needs a sender address", () => {
    expect(emailTransport({ RESEND_API_KEY: "re_x" })).toBeNull();
    expect(emailTransport({ SMTP_URL: "smtp://mail:25" })).toBeNull();
  });

  it("Resend wins over SMTP when both are set", () => {
    expect(emailTransport({ RESEND_API_KEY: "re_x", SMTP_URL: "smtp://mail:25", EMAIL_FROM: "a@b.it" })).toBe("resend");
    expect(emailTransport({ SMTP_URL: "smtp://mail:25", EMAIL_FROM: "a@b.it" })).toBe("smtp");
  });

  it("reads EMAIL_FROM first, then the older RESEND_FROM", () => {
    expect(emailFrom({ EMAIL_FROM: "new@b.it", RESEND_FROM: "old@b.it" })).toBe("new@b.it");
    expect(emailFrom({ RESEND_FROM: "old@b.it" })).toBe("old@b.it");
    expect(isEmailConfigured({ RESEND_API_KEY: "re_x", RESEND_FROM: "old@b.it" })).toBe(true);
    expect(isEmailConfigured({ RESEND_API_KEY: " ", RESEND_FROM: "old@b.it" })).toBe(false);
  });
});
