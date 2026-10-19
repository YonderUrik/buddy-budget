import { describe, expect, it } from "vitest";
import { countCsvRows } from "./personal-import-upload";
import { importSummary, receiptStage } from "./personal-import-receipt";

describe("countCsvRows", () => {
  it("esclude intestazione e righe vuote", () => {
    expect(countCsvRows("a,b\n1,2\n\n3,4\r\n")).toBe(2);
    expect(countCsvRows("")).toBe(0);
  });
});

describe("receiptStage", () => {
  it("segue lo stato del lavoro", () => {
    expect(receiptStage(undefined)).toBe(1);
    expect(receiptStage("processing")).toBe(1);
    expect(receiptStage("ready")).toBe(2);
    expect(receiptStage("imported")).toBe(4);
  });
});

describe("importSummary", () => {
  const tr = (source: string, values?: Record<string, string | number>) => source.replace(/\{(\d+)\}/g, (_, k) => String(values?.[k]));
  const base = { cash: 0, investments: 0, skipped: 0, bankCategorized: 0 };
  it("dice quanti movimenti nuovi su quanti, o che non c'era niente di nuovo", () => {
    expect(importSummary(tr, { ...base, rows: 40, alreadyPresent: 28 })).toBe("12 su 40 movimenti importati: gli altri c'erano già.");
    expect(importSummary(tr, { ...base, rows: 40, alreadyPresent: 40 })).toBe("Tutti i 40 movimenti del file c'erano già: non abbiamo aggiunto niente.");
    expect(importSummary(tr, { ...base, rows: 1, alreadyPresent: 1 })).toBe("Il movimento del file c'era già: non abbiamo aggiunto niente.");
    expect(importSummary(tr, { ...base, rows: 3, alreadyPresent: 0 })).toBe("I dati sono già nel tuo conto.");
    expect(importSummary(tr, base)).toBe("I dati sono già nel tuo conto.");
  });
});
