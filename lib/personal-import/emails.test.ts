import { describe, expect, it } from "vitest";
import { personalImportEmailContent } from "./emails";

const PARAMS = { jobUrl: "https://app.example.test/importazioni?job=1", appUrl: "https://app.example.test" };

describe("personalImportEmailContent", () => {
  it("import riuscito: dice dove trovare i dati e porta all'importazione", () => {
    const { subject, text } = personalImportEmailContent("imported", PARAMS);
    expect(subject).toContain("importato");
    expect(text).toContain("Liquidità");
    expect(text).toContain(PARAMS.jobUrl);
  });

  it("import fallito: conferma che non è stato salvato nulla", () => {
    const { subject, text } = personalImportEmailContent("failed", PARAMS);
    expect(subject).toContain("Non è stato possibile");
    expect(text).toContain("nessun movimento è stato salvato");
  });

  it("righe da controllare: dice che si può scegliere cosa fare", () => {
    const { subject, text } = personalImportEmailContent("review", PARAMS);
    expect(subject).toContain("righe da controllare");
    expect(text).toContain("importare le altre");
    expect(text).toContain(PARAMS.jobUrl);
  });

  it("in inglese e in tedesco", () => {
    expect(personalImportEmailContent("imported", { ...PARAMS, language: "en" }).subject).toBe("Your CSV has been imported");
    expect(personalImportEmailContent("review", { ...PARAMS, language: "en" }).text).toContain("See the rows: " + PARAMS.jobUrl);
    expect(personalImportEmailContent("failed", { ...PARAMS, language: "de" }).text).toContain("Es wurden keine Umsätze gespeichert.");
  });

  it("file già presente: dice che non è stato aggiunto niente", () => {
    const { subject, text } = personalImportEmailContent("imported", { ...PARAMS, counts: { rows: 4, alreadyPresent: 4 } });
    expect(subject).toBe("Il tuo CSV non aveva movimenti nuovi");
    expect(text).toContain("non abbiamo aggiunto niente");
    expect(personalImportEmailContent("imported", { ...PARAMS, language: "en", counts: { rows: 4, alreadyPresent: 4 } }).subject).toBe("Your CSV had no new movements");
  });

  it("file in parte già presente: dice quanti movimenti nuovi su quanti", () => {
    const { subject, text } = personalImportEmailContent("imported", { ...PARAMS, counts: { rows: 40, alreadyPresent: 28 } });
    expect(subject).toContain("importato");
    expect(text).toContain("12 su 40 movimenti importati: gli altri c'erano già.");
    expect(personalImportEmailContent("imported", { ...PARAMS, language: "de", counts: { rows: 40, alreadyPresent: 28 } }).text).toContain("12 von 40 Umsätzen importiert");
  });
});
