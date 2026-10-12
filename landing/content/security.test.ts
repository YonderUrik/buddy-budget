import { describe, expect, it } from "vitest";
import { ANALYTICS_DATA, CONTROLS, FIELD_ENCRYPTION_LIVE, FLOW, GOCARDLESS_DATA, LIMITS, STORED } from "./security";
import { FAQ, SECURITY } from "./site";

/** Tutti i testi pubblici sulla sicurezza, home e pagina /sicurezza. */
const allText = () => JSON.stringify([FLOW, STORED, GOCARDLESS_DATA, ANALYTICS_DATA, CONTROLS, LIMITS, SECURITY, FAQ]);

describe("testi sulla sicurezza", () => {
  it("parlano di cifratura nel database solo quando è attiva in produzione", () => {
    const claims = /cifrat[ei][^.]*(nel database|nei backup)|cifra prima di salvarle/i.test(allText());
    expect(claims).toBe(FIELD_ENCRYPTION_LIVE);
  });

});
