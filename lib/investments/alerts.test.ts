import { describe, expect, it } from "vitest";
import { alertEmailContent, isAlertTriggered } from "./alerts";

describe("isAlertTriggered", () => {
  it("sopra scatta a livello raggiunto o superato", () => {
    expect(isAlertTriggered("sopra", 100, 99.99)).toBe(false);
    expect(isAlertTriggered("sopra", 100, 100)).toBe(true);
    expect(isAlertTriggered("sopra", 100, 120)).toBe(true);
  });
  it("sotto scatta a livello raggiunto o superato al ribasso", () => {
    expect(isAlertTriggered("sotto", 100, 100.01)).toBe(false);
    expect(isAlertTriggered("sotto", 100, 100)).toBe(true);
    expect(isAlertTriggered("sotto", 100, 80)).toBe(true);
  });
});

describe("alertEmailContent", () => {
  it("indica titolo, livello, ultima chiusura e link", () => {
    const { subject, text } = alertEmailContent({
      instrumentName: "Vanguard FTSE All-World",
      currency: "EUR",
      direction: "sotto",
      targetPrice: 120,
      closePrice: 118.5,
      closeDate: "2026-09-30",
      appUrl: "https://app.example",
      instrumentId: "abc",
    });
    expect(subject).toContain("Vanguard FTSE All-World scende sotto");
    expect(text).toContain("2026-09-30");
    expect(text).toContain("https://app.example/investimenti/titoli/abc");
    expect(text).toContain("Questa non è una raccomandazione");
  });

  it("in inglese e in tedesco, con prezzi e data nel formato della lingua", () => {
    const params = { instrumentName: "VWCE", currency: "EUR", direction: "sotto" as const, targetPrice: 120, closePrice: 118.5, closeDate: "2026-09-30", appUrl: "https://app.example", instrumentId: "abc" };
    const en = alertEmailContent({ ...params, language: "en" });
    expect(en.subject).toBe("Price alert: VWCE fell below €120.00");
    expect(en.text).toContain("Last close: €118.50 (30 September 2026).");
    // German puts a no-break space before the currency sign.
    const de = alertEmailContent({ ...params, direction: "sopra", language: "de" });
    de.subject = de.subject.replace(/\u00a0/g, " ");
    de.text = de.text.replace(/\u00a0/g, " ");
    expect(de.subject).toBe("Kursalarm: VWCE ist über 120,00 € gestiegen");
    expect(de.text).toContain("Letzter Schlusskurs: 118,50 € (30. September 2026).");
  });
});
