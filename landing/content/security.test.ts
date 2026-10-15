import { describe, expect, it } from "vitest";
import { ENABLE_BANKING_LIVE } from "./bank-provider";
import { LEGAL_DOCUMENTS } from "./legal";
import { WORKS_WITH, SECURITY_HOME } from "./story";
import { ANALYTICS_DATA, CONTROLS, FIELD_ENCRYPTION_LIVE, FLOW, LIMITS, PROVIDER_DATA, STORED } from "./security";
import { FAQ, SECURITY } from "./site";

/** Tutti i testi pubblici sulla sicurezza, home e pagina /sicurezza. */
const allText = () => JSON.stringify([FLOW, STORED, PROVIDER_DATA, ANALYTICS_DATA, CONTROLS, LIMITS, SECURITY, FAQ, WORKS_WITH, SECURITY_HOME, LEGAL_DOCUMENTS]);

describe("testi sulla sicurezza", () => {
  it("parlano di cifratura nel database solo quando è attiva in produzione", () => {
    const claims = /cifrat[ei][^.]*(nel database|nei backup)|cifra prima di salvarle/i.test(allText());
    expect(claims).toBe(FIELD_ENCRYPTION_LIVE);
  });

  it("nominano Enable Banking solo dopo il passaggio in produzione", () => {
    expect(allText().includes("Enable Banking")).toBe(ENABLE_BANKING_LIVE);
  });
});
