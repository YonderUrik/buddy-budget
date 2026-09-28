import { describe, expect, it } from "vitest";
import { computeGrossValue, fieldsFor, localTodayKey, prefillFromPlan, priceLabel, quantityLabel } from "./register-operation-form.state";

describe("form operazione", () => {
  it("mostra quote e prezzo per acquisti e vendite, l'importo per i proventi", () => {
    expect(fieldsFor("acquisto")).toEqual({ quantity: true, price: true, grossAmount: false });
    expect(fieldsFor("cedola")).toEqual({ quantity: false, price: false, grossAmount: true });
  });

  it("calcola il controvalore, anche per le obbligazioni in percentuale del nominale", () => {
    expect(computeGrossValue("acquisto", 10, 12.5, null, "unita")).toBe(125);
    expect(computeGrossValue("acquisto", 10_000, 99.5, null, "percentuale_nominale")).toBe(9950);
    expect(computeGrossValue("acquisto", null, 12.5, null, "unita")).toBeNull();
    expect(computeGrossValue("dividendo", null, null, 30, "unita")).toBe(30);
    expect([quantityLabel("percentuale_nominale"), priceLabel("unita")]).toEqual(["Valore nominale", "Prezzo per quota"]);
  });

  it("il PAC precompila quote stimate dall'ultimo prezzo, arrotondate per difetto", () => {
    expect(prefillFromPlan({ instrumentId: "i", amount: "200.00" }, 110)).toEqual({ instrumentId: "i", type: "acquisto", price: 110, quantity: 1.8181 });
    expect(prefillFromPlan({ instrumentId: "i", amount: "200.00" }, null).quantity).toBeNull();
  });

  it("la data di oggi è in ora locale", () => {
    expect(localTodayKey(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});
