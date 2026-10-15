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
});
