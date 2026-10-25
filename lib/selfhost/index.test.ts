import { describe, expect, it } from "vitest";
import { instanceCapabilities, loginCapabilities } from ".";
import { supportRecipient, SUPPORT_EMAIL } from "@/lib/support";

describe("self-hosted capabilities", () => {
  it("non mostra Google o email quando manca una credenziale della coppia", () => {
    expect(loginCapabilities({ GOOGLE_CLIENT_ID: "id", RESEND_API_KEY: "re_key" })).toEqual({ googleEnabled: false, emailDelivery: false });
    expect(loginCapabilities({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret", RESEND_API_KEY: "re_key", RESEND_FROM: "budget@example.org" })).toEqual({ googleEnabled: true, emailDelivery: true });
  });

  it("non dichiara disponibili CSV e notifiche con configurazione parziale", () => {
    const capabilities = instanceCapabilities({ OPENROUTER_API_KEY: "key", RESEND_API_KEY: "re_key", RESEND_FROM: "budget@example.org", NOTIFICATIONS_MODE: "off" });
    expect(capabilities.aiCategories).toBe(true);
    expect(capabilities.aiCsv).toBe(false);
    expect(capabilities.notifications).toBe(false);
    expect(Object.values(capabilities).every(value => typeof value === "boolean")).toBe(true);
  });

  it("il supporto self-hosted richiede una destinazione esplicita", () => {
    expect(supportRecipient({ SELF_HOSTED: "true" })).toBeNull();
    expect(supportRecipient({ SELF_HOSTED: "true", SUPPORT_EMAIL_TO: "admin@example.org" })).toBe("admin@example.org");
    expect(supportRecipient({})).toBe(SUPPORT_EMAIL);
    expect(supportRecipient({ SUPPORT_EMAIL_TO: "" })).toBe(SUPPORT_EMAIL);
  });
});


it("counts main's SMTP transport in the self-hosted service status", () => {
  expect(instanceCapabilities({ SMTP_URL: "smtp://mail:25", EMAIL_FROM: "budget@example.test", NOTIFICATIONS_MODE: "execute" })).toMatchObject({ emailDelivery: true, notifications: true });
});
