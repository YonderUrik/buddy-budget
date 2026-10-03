import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS, countChangedFields, resolveAssumptions, updateAssumptionsSchema } from "./assumptions";

describe("ipotesi", () => {
  it("senza dati salvati usa i default", () => {
    expect(resolveAssumptions(undefined)).toEqual(DEFAULT_ASSUMPTIONS);
  });
  it("un campo salvato non valido torna al default, gli altri restano", () => {
    const r = resolveAssumptions({ withdrawalRate: 5, expectedReturn: 0.06 });
    expect(r.withdrawalRate).toBe(DEFAULT_ASSUMPTIONS.withdrawalRate);
    expect(r.expectedReturn).toBe(0.06);
  });
  it("l'aggiornamento rifiuta valori fuori limite e oggetti vuoti", () => {
    expect(updateAssumptionsSchema.safeParse({}).success).toBe(false);
    expect(updateAssumptionsSchema.safeParse({ expectedReturn: 0.9 }).success).toBe(false);
    expect(updateAssumptionsSchema.safeParse({ rule: "inventata" }).success).toBe(false);
    expect(updateAssumptionsSchema.safeParse({ withdrawalRate: 0.04, rule: "vanguard" }).success).toBe(true);
  });
  it("conta i campi cambiati", () => {
    expect(countChangedFields(DEFAULT_ASSUMPTIONS, { ...DEFAULT_ASSUMPTIONS, inflation: 0.03, rule: "vanguard" })).toBe(2);
  });
});
