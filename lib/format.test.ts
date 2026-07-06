import { describe, expect, it } from "vitest";
import { formatCurrency, getCurrencySymbol } from "./format";

describe("formatCurrency", () => {
  it("formatta un valore positivo nella valuta indicata", () => {
    expect(formatCurrency(1234.5, "EUR")).toBe("1234,50 €");
  });

  it("rispetta maximumFractionDigits quando specificato", () => {
    expect(formatCurrency(1234.5, "EUR", { maximumFractionDigits: 0 })).toBe("1235 €");
  });

  it("supporta valute diverse da EUR", () => {
    expect(formatCurrency(10, "USD")).toBe("10,00 USD");
  });
});

describe("getCurrencySymbol", () => {
  it("restituisce € per EUR con locale it-IT", () => {
    expect(getCurrencySymbol("EUR", "it-IT")).toBe("€");
  });

  it("restituisce $ per USD con locale en-US", () => {
    expect(getCurrencySymbol("USD", "en-US")).toBe("$");
  });

  it("usa it-IT come default locale", () => {
    expect(getCurrencySymbol("EUR")).toBe("€");
  });
});
