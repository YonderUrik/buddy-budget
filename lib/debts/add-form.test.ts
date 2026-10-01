import { describe, expect, it } from "vitest";
import { buildCreateDebtInput, emptyAddDebtForm, parseAmount, previewAddForm, resolveAddForm, validateAddFormBasics } from "./add-form";

function form(overrides: Partial<ReturnType<typeof emptyAddDebtForm>>) {
  return { ...emptyAddDebtForm("nuovo"), name: "Prestito", firstInstallmentDate: "2026-11-05", ...overrides };
}

describe("parseAmount", () => {
  it("legge i formati italiani e inglesi", () => {
    expect(parseAmount("1.250,50")).toBe(1250.5);
    expect(parseAmount("6,9")).toBe(6.9);
    expect(parseAmount("6.9")).toBe(6.9);
    expect(parseAmount("  ")).toBeUndefined();
    expect(parseAmount("abc")).toBeUndefined();
  });
});

describe("resolveAddForm", () => {
  it("con meno di tre dati non è un errore ma non calcola", () => {
    expect(resolveAddForm(form({ principal: "10000", annualRate: "6" }))).toEqual({ ok: false, message: null });
  });
  it("calcola la rata dai tre dati e la segna come calcolata", () => {
    const r = resolveAddForm(form({ principal: "10000", annualRate: "6", installments: "12" }));
    expect(r.ok && r.value.calculated).toBe("installment");
    expect(r.ok && r.value.inputs.installment).toBe(860.66);
  });
  it("calcola il tasso dalla rata", () => {
    const r = resolveAddForm(form({ principal: "10000", installment: "860,66", installments: "12" }));
    expect(r.ok && r.value.calculated).toBe("annualRate");
    expect(r.ok && r.value.inputs.annualRate).toBeCloseTo(6, 2);
  });
  it("con tutti e quattro non calcola nulla", () => {
    const r = resolveAddForm(form({ principal: "10000", installment: "860,66", installments: "12", annualRate: "6" }));
    expect(r.ok && r.value.calculated).toBeUndefined();
  });
  it("restituisce un messaggio leggibile con dati incompatibili", () => {
    const r = resolveAddForm(form({ principal: "10000", installment: "100", installments: "50" }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toMatch(/non copre/);
  });
  it("rifiuta un numero di rate non intero", () => {
    const r = resolveAddForm(form({ principal: "10000", installment: "100", installments: "12,5", annualRate: "5" }));
    expect(!r.ok && r.message).toMatch(/intero/);
  });
  it("calcola il TAEG con le spese, non per la fotografia di oggi", () => {
    const costs = [{ label: "Istruttoria", amount: "150", kind: "una_tantum" as const }];
    const nuovo = resolveAddForm(form({ principal: "10000", annualRate: "6", installments: "12", costs }));
    expect(nuovo.ok && nuovo.value.apr).toBeGreaterThan(7);
    const foto = resolveAddForm({ ...form({ principal: "10000", annualRate: "6", installments: "12", costs }), startMode: "fotografia" });
    expect(foto.ok && foto.value.apr).toBeNull();
  });
});

describe("buildCreateDebtInput", () => {
  it("non dichiara la rata se è stata calcolata", () => {
    const state = form({ principal: "10000", annualRate: "6", installments: "12" });
    const r = resolveAddForm(state);
    if (!r.ok) throw new Error("atteso ok");
    expect(buildCreateDebtInput(state, r.value, "2026-10-01").installment).toBeUndefined();
  });
  it("dichiara la rata scritta dall'utente e ignora le spese incomplete", () => {
    const state = form({
      principal: "10000",
      installment: "860,66",
      installments: "12",
      annualRate: "6",
      costs: [
        { label: "Assicurazione", amount: "4,5", kind: "per_rata" },
        { label: "", amount: "10", kind: "una_tantum" },
      ],
    });
    const r = resolveAddForm(state);
    if (!r.ok) throw new Error("atteso ok");
    const input = buildCreateDebtInput(state, r.value, "2026-10-01");
    expect(input.installment).toBe(860.66);
    expect(input.costs).toEqual([{ label: "Assicurazione", amount: 4.5, kind: "per_rata" }]);
  });
  it("la fotografia di oggi porta la data della fotografia", () => {
    const state = { ...form({ principal: "5000", annualRate: "5", installments: "10" }), startMode: "fotografia" as const };
    const r = resolveAddForm(state);
    if (!r.ok) throw new Error("atteso ok");
    expect(buildCreateDebtInput(state, r.value, "2026-10-01").anchorDate).toBe("2026-10-01");
  });
});

describe("validateAddFormBasics", () => {
  it("chiede nome e data", () => {
    expect(validateAddFormBasics(form({ name: " " }))).toMatch(/nome/);
    expect(validateAddFormBasics(form({ firstInstallmentDate: "" }))).toMatch(/data/);
    expect(validateAddFormBasics(form({}))).toBeNull();
  });
});

describe("previewAddForm", () => {
  it("dà rata, interessi totali e data dell'ultima rata", () => {
    const state = form({ principal: "10000", annualRate: "6", installments: "12", firstInstallmentDate: "2026-11-05" });
    const r = resolveAddForm(state);
    if (!r.ok) throw new Error("atteso ok");
    const preview = previewAddForm(state, r.value);
    expect(preview?.installment).toBe(860.66);
    expect(preview?.endDate).toBe("2027-10-05");
    expect(preview?.totalInterest).toBeCloseTo(327.9, 0);
  });
  it("senza data non c'è anteprima", () => {
    const state = form({ principal: "10000", annualRate: "6", installments: "12", firstInstallmentDate: "" });
    const r = resolveAddForm(state);
    if (!r.ok) throw new Error("atteso ok");
    expect(previewAddForm(state, r.value)).toBeNull();
  });
});
