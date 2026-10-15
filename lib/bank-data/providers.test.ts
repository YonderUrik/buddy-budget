import { describe, expect, it } from "vitest";
import { providerForNewConnections } from "./providers";

describe("providerForNewConnections", () => {
  const gc = { GOCARDLESS_SECRET_ID: "id", GOCARDLESS_SECRET_KEY: "key" };
  const eb = { ENABLE_BANKING_APP_ID: "app", ENABLE_BANKING_PRIVATE_KEY: "pem" };

  it("segue BANK_DATA_PROVIDER quando c'è", () => {
    expect(providerForNewConnections({ ...gc, ...eb, BANK_DATA_PROVIDER: "enablebanking" })).toBe("enablebanking");
    expect(providerForNewConnections({ ...gc, ...eb, BANK_DATA_PROVIDER: "gocardless" })).toBe("gocardless");
  });

  it("senza scelta resta su GoCardless se configurato, altrimenti Enable Banking", () => {
    expect(providerForNewConnections({ ...gc, ...eb })).toBe("gocardless");
    expect(providerForNewConnections({ ...eb })).toBe("enablebanking");
    expect(providerForNewConnections({ BANK_DATA_PROVIDER: "altro" })).toBe("gocardless");
  });
});
