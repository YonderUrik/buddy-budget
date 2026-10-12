import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS, countChangedFields, mergeAssumptions, resolveAssumptions, updateAssumptionsSchema } from "./assumptions";

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

describe("rendimento automatico", () => {
  it("di default il rendimento si ricava dallo storico", () => {
    expect(DEFAULT_ASSUMPTIONS.expectedReturnAuto).toBe(true);
  });
  it("le ipotesi salvate prima restano manuali solo se il rendimento era stato cambiato", () => {
    expect(resolveAssumptions({ expectedReturn: 0.04, withdrawalRate: 0.03 }).expectedReturnAuto).toBe(true);
    expect(resolveAssumptions({ expectedReturn: 0.06 }).expectedReturnAuto).toBe(false);
    expect(resolveAssumptions({ expectedReturn: 0.06, expectedReturnAuto: true }).expectedReturnAuto).toBe(true);
  });
  it("accetta rendimenti fino al 50%", () => {
    expect(updateAssumptionsSchema.safeParse({ expectedReturn: 0.5 }).success).toBe(true);
    expect(updateAssumptionsSchema.safeParse({ expectedReturn: 0.51 }).success).toBe(false);
  });
  it("scrivere un rendimento lo rende manuale, tornare all'automatico tiene il valore di riserva", () => {
    const manual = mergeAssumptions(DEFAULT_ASSUMPTIONS, { expectedReturn: 0.12 });
    expect(manual).toMatchObject({ expectedReturn: 0.12, expectedReturnAuto: false });
    expect(mergeAssumptions(manual, { expectedReturnAuto: true })).toMatchObject({ expectedReturn: 0.12, expectedReturnAuto: true });
    expect(mergeAssumptions(DEFAULT_ASSUMPTIONS, { annualSavings: 5000 }).expectedReturnAuto).toBe(true);
  });
});
