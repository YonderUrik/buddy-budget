import { describe, expect, it } from "vitest";
import {
  computeGrossValue,
  fieldsFor,
  localTodayKey,
  prefillFromPlan,
  priceLabel,
  priceSuggestionHint,
  priceText,
  quantityLabel,
  suggestsMarketPrice,
} from "./register-operation-form.state";

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

  it("propone il prezzo alla data solo per acquisti e vendite", () => {
    expect(["acquisto", "vendita", "rimborso", "dividendo", "cedola"].map((t) => suggestsMarketPrice(t as never))).toEqual([true, true, false, false, false]);
  });

  it("il prezzo proposto ha la virgola e al massimo 6 decimali", () => {
    expect(priceText(105.23)).toBe("105,23");
    expect(priceText(0.123456789)).toBe("0,123457");
    expect(priceText(100)).toBe("100");
  });

  it("dice da dove viene il prezzo proposto, o perché manca", () => {
    const close = (date: string, origin: "yahoo" | "manuale") => ({ price: { date, close: 10, origin }, loading: false });
    expect(priceSuggestionHint("2026-09-25", undefined, true)).toBe("Cerco il prezzo di questa data…");
    expect(priceSuggestionHint("2026-09-25", undefined, false)).toBeNull();
    expect(priceSuggestionHint("2026-09-25", { price: null, loading: true }, true)).toBe("Scarico i prezzi di questa data…");
    expect(priceSuggestionHint("2026-09-25", { price: null, loading: false }, false)).toBe("Nessun prezzo per questa data: inseriscilo tu.");
    expect(priceSuggestionHint("2026-09-25", close("2026-09-25", "yahoo"), false)).toBe("Chiusura del 25 set 2026");
    expect(priceSuggestionHint("2026-09-27", close("2026-09-25", "yahoo"), false)).toBe("Ultima chiusura prima di questa data, del 25 set 2026");
    expect(priceSuggestionHint("2026-09-25", close("2026-09-25", "manuale"), false)).toBe("Il tuo prezzo del 25 set 2026");
  });
});
