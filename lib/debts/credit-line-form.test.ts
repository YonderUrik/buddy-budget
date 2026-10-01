import { describe, expect, it } from "vitest";
import { buildCreateCreditLineInput, buildCreditLineSettingsPatch, emptyCreditLineForm, validateCreditLineForm, type CreditLineFormState } from "./credit-line-form";

const valid = (patch: Partial<CreditLineFormState> = {}): CreditLineFormState => ({
  ...emptyCreditLineForm("2026-10-01"),
  name: "Lombard",
  creditLimit: "50000",
  initialUsed: "10000,50",
  indexRate: "2,5",
  spread: "1,2",
  ...patch,
});

describe("validateCreditLineForm", () => {
  it("accetta un form completo", () => {
    expect(validateCreditLineForm(valid(), true)).toBeNull();
  });

  it("chiede nome, fido, indice e utilizzato", () => {
    expect(validateCreditLineForm(valid({ name: " " }), true)).toMatch(/nome/);
    expect(validateCreditLineForm(valid({ creditLimit: "" }), true)).toMatch(/fido/);
    expect(validateCreditLineForm(valid({ indexRate: "" }), true)).toMatch(/indice/);
    expect(validateCreditLineForm(valid({ initialUsed: "60000" }), true)).toMatch(/supera il fido/);
    expect(validateCreditLineForm(valid({ spread: "-1" }), true)).toMatch(/spread/);
  });

  it("nelle impostazioni non ricontrolla i dati iniziali", () => {
    expect(validateCreditLineForm(valid({ initialUsed: "", indexRate: "" }), false)).toBeNull();
  });

  it("controlla la soglia e le spese", () => {
    expect(validateCreditLineForm(valid({ alertKind: "percent", alertValue: "" }), true)).toMatch(/soglia/);
    expect(validateCreditLineForm(valid({ alertKind: "percent", alertValue: "120" }), true)).toMatch(/100/);
    expect(validateCreditLineForm(valid({ alertKind: "amount", alertValue: "30000" }), true)).toBeNull();
    expect(validateCreditLineForm(valid({ costs: [{ label: "", amount: "5", kind: "per_rata" }] }), true)).toMatch(/spese/);
  });
});

describe("buildCreateCreditLineInput", () => {
  it("legge i numeri all'italiana e porta le regole scelte", () => {
    expect(buildCreateCreditLineInput(valid({ alertKind: "percent", alertValue: "80", indexLabel: " Euribor 3M ", costs: [{ label: "Tenuta", amount: "5,5", kind: "per_rata" }] }))).toEqual({
      kind: "credit_line",
      name: "Lombard",
      creditLimit: 50000,
      initialUsed: 10000.5,
      indexRate: 2.5,
      spread: 1.2,
      indexLabel: "Euribor 3M",
      openDate: "2026-10-01",
      interestFrequency: "monthly",
      dayCount: "365",
      capitalizeInterest: false,
      alertThreshold: { type: "percent", value: 80 },
      costs: [{ label: "Tenuta", amount: 5.5, kind: "per_rata" }],
    });
  });
});

describe("buildCreditLineSettingsPatch", () => {
  it("manda null per togliere la soglia e la stringa vuota per togliere l'etichetta", () => {
    const patch = buildCreditLineSettingsPatch(valid());
    expect(patch.alertThreshold).toBeNull();
    expect(patch.indexLabel).toBe("");
    expect(patch.creditLimit).toBe(50000);
  });
});
