import { describe, expect, it } from "vitest";
import { isValidLegalAcceptance } from "./acceptance-input";
import { LEGAL_VERSION, needsLegalAcceptance } from "./version";

const valid = { version: LEGAL_VERSION, ageConfirmed: true, termsAccepted: true, specificClausesAccepted: true };

describe("isValidLegalAcceptance", () => {
  it("accetta la dichiarazione completa sulla versione in vigore", () => {
    expect(isValidLegalAcceptance(valid)).toBe(true);
  });

  it.each([
    ["una casella mancante", { ...valid, ageConfirmed: false }],
    ["clausole non approvate", { ...valid, specificClausesAccepted: false }],
    ["versione vecchia", { ...valid, version: "2020-01-01" }],
    ["corpo vuoto", {}],
    ["null", null],
  ])("rifiuta %s", (_label, body) => {
    expect(isValidLegalAcceptance(body)).toBe(false);
  });
});

describe("needsLegalAcceptance", () => {
  it("richiede l'accettazione se manca o la versione è diversa", () => {
    expect(needsLegalAcceptance(null)).toBe(true);
    expect(needsLegalAcceptance("2020-01-01")).toBe(true);
    expect(needsLegalAcceptance(LEGAL_VERSION)).toBe(false);
  });
});
