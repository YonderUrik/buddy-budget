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
    expect(text).toContain("non è una raccomandazione");
  });
});
