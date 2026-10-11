import { describe, expect, it } from "vitest";
import { magicLinkEmailContent } from "./emails";

describe("magicLinkEmailContent", () => {
  it("riporta il link, la scadenza e ha una versione HTML", () => {
    const { subject, text, html } = magicLinkEmailContent({ url: "https://app.example.test/api/auth/verify?token=t", expiresInMinutes: 10, appUrl: "https://app.example.test" });
    expect(subject).toContain("link di accesso");
    expect(text).toContain("10 minuti");
    expect(text).toContain("https://app.example.test/api/auth/verify?token=t");
    expect(html).toContain("Accedi");
  });
});
