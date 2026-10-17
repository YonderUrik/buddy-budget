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
    expect(text).toContain("https://app.example.test/liquidita/conti?rinnova=1");
  });

  it("avviso di scadenza senza data usa una formula generica", () => {
    expect(consentEmailContent("expiring", { institutionName: "Banca Uno", appUrl: "https://a.test" }).text).toContain("scade a breve");
  });

  it("avviso di scaduto: spiega che i dati restano e porta al rinnovo", () => {
    const { subject, text } = consentEmailContent("expired", { institutionName: "Banca Uno", appUrl: "https://a.test" });
    expect(subject).toContain("scaduto");
    expect(text).toContain("non vanno persi");
    expect(text).toContain("https://a.test/liquidita/conti?rinnova=1");
  });

  it("in inglese e in tedesco, con la data nel formato della lingua", () => {
    const params = { institutionName: "Bank One", appUrl: "https://a.test", expiresAt: new Date("2026-10-08T10:00:00Z") };
    const en = consentEmailContent("expiring", { ...params, language: "en" });
    expect(en.subject).toBe("Your connection to Bank One is about to expire");
    expect(en.text).toContain("Your consent to read your Bank One accounts expires on 8 October 2026.");
    expect(en.text).toContain("Renew connection: https://a.test/liquidita/conti?rinnova=1");
    const de = consentEmailContent("expired", { ...params, language: "de" });
    expect(de.subject).toBe("Deine Verbindung zu Bank One ist abgelaufen");
    expect(consentEmailContent("expiring", { ...params, language: "de" }).text).toContain("läuft am 8. Oktober 2026 ab");
  });
});
