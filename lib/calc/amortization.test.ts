import { describe, expect, it } from "vitest";
import {
  AmortizationError,
  addMonthsClamped,
  buildSegmentSchedule,
  computeApr,
  installmentAmount,
  resolveMissingLoanInput,
  solveAnnualRate,
  solveInstallments,
  solvePrincipal,
} from "./amortization";

describe("installmentAmount", () => {
  it("calcola la rata nota: 10.000 € al 6% su 12 rate = 860,66 €", () => {
    expect(installmentAmount(10000, 6, 12)).toBe(860.66);
  });
  it("con tasso 0 divide il capitale per le rate", () => {
    expect(installmentAmount(1200, 0, 12)).toBe(100);
  });
  it("rifiuta capitale o rate non positivi", () => {
    expect(() => installmentAmount(0, 5, 12)).toThrow(AmortizationError);
    expect(() => installmentAmount(1000, 5, 0)).toThrow(AmortizationError);
  });
});

describe("addMonthsClamped", () => {
  it("non va in overflow a fine mese e ritorna al giorno 31", () => {
    expect(addMonthsClamped("2026-01-31", 1, 31)).toBe("2026-02-28");
    expect(addMonthsClamped("2028-01-31", 1, 31)).toBe("2028-02-29");
    expect(addMonthsClamped("2026-01-31", 2, 31)).toBe("2026-03-31");
  });
  it("attraversa l'anno", () => {
    expect(addMonthsClamped("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonthsClamped("2026-01-10", 24)).toBe("2028-01-10");
  });
});

describe("buildSegmentSchedule", () => {
  const schedule = buildSegmentSchedule({ firstDueDate: "2026-03-05", principal: 10000, annualRate: 6, installments: 12 });

  it("ha tante righe quante le rate, numerate da 1, con scadenze mensili", () => {
    expect(schedule).toHaveLength(12);
    expect(schedule[0].number).toBe(1);
    expect(schedule[0].dueDate).toBe("2026-03-05");
    expect(schedule[11].dueDate).toBe("2027-02-05");
  });
  it("la prima rata ha interessi = residuo × tasso / 12", () => {
    expect(schedule[0].interest).toBe(50);
    expect(schedule[0].installment).toBe(860.66);
    expect(schedule[0].capital).toBe(810.66);
  });
  it("l'ultima rata chiude il residuo a zero", () => {
    expect(schedule[11].residual).toBe(0);
  });
  it("con scadenze a fine mese tiene il giorno originale", () => {
    const rows = buildSegmentSchedule({ firstDueDate: "2026-01-31", principal: 3000, annualRate: 0, installments: 3 });
    expect(rows.map((r) => r.dueDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });
  it("prosegue la numerazione con firstNumber", () => {
    const rows = buildSegmentSchedule({ firstDueDate: "2026-07-01", principal: 500, annualRate: 4, installments: 2, firstNumber: 7 });
    expect(rows.map((r) => r.number)).toEqual([7, 8]);
  });
  it("usa la rata dichiarata e l'ultima assorbe la differenza", () => {
    const rows = buildSegmentSchedule({ firstDueDate: "2026-03-05", principal: 1000, annualRate: 0, installments: 3, installment: 334 });
    expect(rows.map((r) => r.installment)).toEqual([334, 334, 332]);
    expect(rows[2].residual).toBe(0);
  });
  it("rifiuta un numero di rate non intero", () => {
    expect(() => buildSegmentSchedule({ firstDueDate: "2026-03-05", principal: 100, annualRate: 5, installments: 2.5 })).toThrow(AmortizationError);
  });
});

describe("solver inversi (andata e ritorno)", () => {
  it("ricava il tasso dalla rata", () => {
    const rata = installmentAmount(15000, 7.35, 60);
    expect(solveAnnualRate({ principal: 15000, installment: rata, installments: 60 })).toBeCloseTo(7.35, 2);
  });
  it("ricava il tasso 0 quando la rata è capitale / rate", () => {
    expect(solveAnnualRate({ principal: 1200, installment: 100, installments: 12 })).toBeCloseTo(0, 4);
  });
  it("ricava il numero di rate", () => {
    const rata = installmentAmount(20000, 5, 48);
    expect(solveInstallments({ principal: 20000, annualRate: 5, installment: rata })).toBe(48);
  });
  it("con tasso 0 il numero di rate è per eccesso", () => {
    expect(solveInstallments({ principal: 1000, annualRate: 0, installment: 300 })).toBe(4);
  });
  it("una rata arrotondata al centesimo non aggiunge una rata intera", () => {
    expect(solveInstallments({ principal: 10000, annualRate: 6, installment: 860.66 })).toBe(12);
  });
  it("ricava il capitale", () => {
    const rata = installmentAmount(8000, 4.2, 36);
    expect(solvePrincipal({ annualRate: 4.2, installment: rata, installments: 36 })).toBeCloseTo(8000, -1);
  });
  it("segnala dati impossibili", () => {
    expect(() => solveAnnualRate({ principal: 10000, installment: 100, installments: 50 })).toThrow(AmortizationError);
    expect(() => solveInstallments({ principal: 10000, annualRate: 12, installment: 50 })).toThrow(AmortizationError);
  });
});

describe("computeApr", () => {
  it("senza spese coincide col tasso effettivo annuo del TAN", () => {
    const rata = installmentAmount(10000, 6, 12);
    // (1 + 0,06/12)^12 − 1 = 6,1678%
    expect(computeApr({ principal: 10000, upfrontCosts: 0, installment: rata, recurringCosts: 0, installments: 12 })).toBeCloseTo(6.17, 1);
  });
  it("le spese fanno salire il TAEG", () => {
    const rata = installmentAmount(10000, 6, 12);
    const senza = computeApr({ principal: 10000, upfrontCosts: 0, installment: rata, recurringCosts: 0, installments: 12 });
    const con = computeApr({ principal: 10000, upfrontCosts: 150, installment: rata, recurringCosts: 3, installments: 12 });
    expect(con).toBeGreaterThan(senza + 1);
  });
  it("segnala pagamenti inferiori al netto", () => {
    expect(() => computeApr({ principal: 1000, upfrontCosts: 0, installment: 50, recurringCosts: 0, installments: 10 })).toThrow(AmortizationError);
  });
});

describe("resolveMissingLoanInput", () => {
  it("calcola la rata se manca", () => {
    const r = resolveMissingLoanInput({ principal: 10000, annualRate: 6, installments: 12 });
    expect(r.installment).toBe(860.66);
    expect(r.calculated).toBe("installment");
  });
  it("calcola il tasso se manca", () => {
    const r = resolveMissingLoanInput({ principal: 10000, installment: 860.66, installments: 12 });
    expect(r.annualRate).toBeCloseTo(6, 2);
    expect(r.calculated).toBe("annualRate");
  });
  it("calcola le rate o il capitale se mancano", () => {
    expect(resolveMissingLoanInput({ principal: 10000, annualRate: 6, installment: 860.66 }).installments).toBe(12);
    expect(resolveMissingLoanInput({ annualRate: 6, installment: 860.66, installments: 12 }).principal).toBeCloseTo(10000, -1);
  });
  it("con tutti e quattro i dati non calcola nulla", () => {
    const r = resolveMissingLoanInput({ principal: 10000, annualRate: 6, installment: 860.66, installments: 12 });
    expect(r.calculated).toBeUndefined();
  });
  it("con due dati mancanti lancia un errore leggibile", () => {
    expect(() => resolveMissingLoanInput({ principal: 10000, annualRate: 6 })).toThrow(/almeno tre dati/);
  });
});
