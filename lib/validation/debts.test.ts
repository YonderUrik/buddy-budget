import { describe, expect, it } from "vitest";
import { createDebtEventSchema, createDebtSchema, updateDebtSchema } from "./debts";

const base = {
  name: "Prestito personale",
  startMode: "nuovo" as const,
  principal: 10000,
  annualRate: 6.5,
  installments: 36,
  firstInstallmentDate: "2026-03-05",
};

describe("createDebtSchema", () => {
  it("accetta un finanziamento valido e mette le spese a vuoto", () => {
    const parsed = createDebtSchema.parse(base);
    expect(parsed.costs).toEqual([]);
  });
  it("rifiuta tasso fuori range, rate non intere e capitale non positivo", () => {
    expect(createDebtSchema.safeParse({ ...base, annualRate: 120 }).success).toBe(false);
    expect(createDebtSchema.safeParse({ ...base, installments: 12.5 }).success).toBe(false);
    expect(createDebtSchema.safeParse({ ...base, principal: 0 }).success).toBe(false);
  });
  it("la fotografia di oggi richiede la data della fotografia", () => {
    expect(createDebtSchema.safeParse({ ...base, startMode: "fotografia" }).success).toBe(false);
    expect(createDebtSchema.safeParse({ ...base, startMode: "fotografia", anchorDate: "2026-09-30" }).success).toBe(true);
  });
  it("limita le spese accessorie", () => {
    const costs = Array.from({ length: 11 }, () => ({ label: "Spesa", amount: 1, kind: "una_tantum" as const }));
    expect(createDebtSchema.safeParse({ ...base, costs }).success).toBe(false);
  });
});

describe("updateDebtSchema", () => {
  it("richiede almeno una modifica", () => {
    expect(updateDebtSchema.safeParse({}).success).toBe(false);
    expect(updateDebtSchema.safeParse({ name: "Nuovo nome" }).success).toBe(true);
  });
});

describe("createDebtEventSchema", () => {
  it("valida i tre tipi di evento", () => {
    expect(createDebtEventSchema.safeParse({ type: "payment", installmentNumber: 1, date: "2026-03-05", amount: 300 }).success).toBe(true);
    expect(createDebtEventSchema.safeParse({ type: "rate_change", date: "2026-06-01", rate: 7 }).success).toBe(true);
    expect(createDebtEventSchema.safeParse({ type: "balance_correction", date: "2026-06-01", amount: 5000 }).success).toBe(true);
  });
  it("rifiuta un tipo sconosciuto o un pagamento senza numero di rata", () => {
    expect(createDebtEventSchema.safeParse({ type: "altro", date: "2026-06-01" }).success).toBe(false);
    expect(createDebtEventSchema.safeParse({ type: "payment", date: "2026-03-05", amount: 300 }).success).toBe(false);
  });
});
