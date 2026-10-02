import { describe, expect, it } from "vitest";
import { consentEmailContent } from "./consent-emails";

describe("consentEmailContent", () => {
  it("avviso di scadenza: nomina la banca, la data e porta al rinnovo", () => {
    const { subject, text } = consentEmailContent("expiring", {
      institutionName: "Banca Uno",
      appUrl: "https://app.example.test",
      expiresAt: new Date("2026-10-08T10:00:00Z"),
    });
    expect(subject).toContain("Banca Uno");
    expect(text).toContain("8 ottobre 2026");
    expect(text).toContain("https://app.example.test/conti?rinnova=1");
  });

  it("avviso di scadenza senza data usa una formula generica", () => {
    expect(consentEmailContent("expiring", { institutionName: "Banca Uno", appUrl: "https://a.test" }).text).toContain("scade a breve");
  });

  it("avviso di scaduto: spiega che i dati restano e porta al rinnovo", () => {
    const { subject, text } = consentEmailContent("expired", { institutionName: "Banca Uno", appUrl: "https://a.test" });
    expect(subject).toContain("scaduto");
    expect(text).toContain("non vanno persi");
    expect(text).toContain("https://a.test/conti?rinnova=1");
  });
});
