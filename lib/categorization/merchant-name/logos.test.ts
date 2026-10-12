import { describe, expect, it } from "vitest";
import { isKnownMerchantLogoDomain, merchantLogoDomain, MERCHANT_LOGO_DOMAINS } from "./logos";

describe("merchantLogoDomain", () => {
  it("riconosce i marchi del dizionario dalla descrizione della banca", () => {
    expect(merchantLogoDomain("AMAZON EU SARL AMAZON.IT")).toBe("amazon.com");
    expect(merchantLogoDomain("PAGAMENTO POS NETFLIX.COM 12/10")).toBe("netflix.com");
  });

  it("non indovina il logo per un nome qualunque", () => {
    expect(merchantLogoDomain("BAR DA MARIO")).toBeNull();
    expect(merchantLogoDomain("")).toBeNull();
  });
});

describe("isKnownMerchantLogoDomain", () => {
  it("accetta solo i domini della lista", () => {
    expect(isKnownMerchantLogoDomain("amazon.com")).toBe(true);
    expect(isKnownMerchantLogoDomain("example.com")).toBe(false);
    expect(isKnownMerchantLogoDomain("../amazon.com")).toBe(false);
  });

  it("ogni dominio della lista è un nome di dominio semplice", () => {
    for (const domain of Object.values(MERCHANT_LOGO_DOMAINS)) expect(domain).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
  });
});
