import { describe, expect, it } from "vitest";
import {
  computeAccumulatedSavings,
  computeCashflowKpis,
  computeIncomeSources,
  computeMonthlySeries,
  computeWhereItGoes,
  formatCashflowPeriodLabel,
  getCashflowPeriodRange,
  getPreviousCashflowPeriodRange,
  shiftCashflowReferenceDate,
} from "./cashflow";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { Category } from "@/lib/db/schema/categories";

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    accountId: "account-1",
    categoryId: "category-1",
    description: "Transazione",
    rawDescription: null,
    note: null,
    amount: "-10.00",
    excludedAmount: "0.00",
    date: "2026-02-10",
    source: "manuale",
    externalId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeCategory(overrides: Partial<Category>): Category {
  return {
    id: "category-1",
    userId: "user-1",
    name: "Categoria",
    type: "variabile",
    color: "slate",
    icon: "package",
    isFallback: false,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("getCashflowPeriodRange", () => {
  it("'3mesi' copre il mese di riferimento e i 2 precedenti", () => {
    const range = getCashflowPeriodRange("3mesi", new Date(2026, 2, 15)); // 15 marzo 2026
    expect(range.from).toEqual(new Date(2026, 0, 1)); // 1 gennaio
    expect(range.to).toEqual(new Date(2026, 2, 31)); // 31 marzo
  });

  it("'12mesi' copre 12 mesi calendariali fino al mese di riferimento incluso", () => {
    const range = getCashflowPeriodRange("12mesi", new Date(2026, 2, 15));
    expect(range.from).toEqual(new Date(2025, 3, 1)); // aprile 2025
    expect(range.to).toEqual(new Date(2026, 2, 31));
  });

  it("con referenceDate al 31 maggio, il periodo corrente e quello precedente di '3mesi' non si sovrappongono e non saltano mesi (regressione bug overflow addMonths)", () => {
    const referenceDate = new Date(2026, 4, 31); // 31 maggio 2026
    const current = getCashflowPeriodRange("3mesi", referenceDate);
    const previous = getPreviousCashflowPeriodRange("3mesi", referenceDate);

    expect(current.from).toEqual(new Date(2026, 2, 1)); // 1 marzo
    expect(current.to).toEqual(new Date(2026, 4, 31)); // 31 maggio
    expect(previous.from).toEqual(new Date(2025, 11, 1)); // 1 dicembre 2025
    expect(previous.to).toEqual(new Date(2026, 1, 28)); // 28 febbraio 2026 (non bisestile)

    // Nessuna sovrapposizione tra i due periodi.
    expect(previous.to.getTime()).toBeLessThan(current.from.getTime());
    // Nessun mese saltato: dal 28 febbraio all'1 marzo c'è esattamente un giorno.
    expect(current.from.getTime() - previous.to.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe("getPreviousCashflowPeriodRange / shiftCashflowReferenceDate", () => {
  it("il periodo precedente di '3mesi' è spostato indietro di 3 mesi", () => {
    const previous = getPreviousCashflowPeriodRange("3mesi", new Date(2026, 2, 15));
    expect(previous.from).toEqual(new Date(2025, 9, 1)); // ottobre 2025
    expect(previous.to).toEqual(new Date(2025, 11, 31)); // 31 dicembre 2025
  });

  it("shiftCashflowReferenceDate avanti di '6mesi' sposta di 6 mesi", () => {
    const shifted = shiftCashflowReferenceDate("6mesi", new Date(2026, 2, 15), 1);
    expect(shifted).toEqual(new Date(2026, 8, 15));
  });

  it("shiftCashflowReferenceDate indietro e poi avanti torna allo stesso mese anche partendo dal 31 (regressione bug overflow addMonths)", () => {
    const referenceDate = new Date(2026, 4, 31); // 31 maggio 2026
    const back = shiftCashflowReferenceDate("3mesi", referenceDate, -1);
    const forward = shiftCashflowReferenceDate("3mesi", back, 1);

    expect(forward.getFullYear()).toBe(referenceDate.getFullYear());
    expect(forward.getMonth()).toBe(referenceDate.getMonth());
  });
});

describe("formatCashflowPeriodLabel", () => {
  it("formatta un range nello stesso anno come 'Mmm – Mmm AAAA'", () => {
    const range = getCashflowPeriodRange("3mesi", new Date(2026, 2, 15));
    expect(formatCashflowPeriodLabel(range)).toBe("Gen – Mar 2026");
  });
});

describe("computeCashflowKpis", () => {
  const range = { from: new Date(2026, 0, 1), to: new Date(2026, 1, 28) }; // gen-feb 2026
  const todayAfterPeriod = new Date(2026, 2, 1); // 1 marzo: entrambi i mesi del range sono trascorsi per intero

  it("calcola entrate/uscite medie, flusso netto totale e tasso di risparmio", () => {
    const transactions = [
      makeTransaction({ amount: "1500.00", date: "2026-01-05" }),
      makeTransaction({ amount: "-500.00", date: "2026-01-10" }),
      makeTransaction({ amount: "1500.00", date: "2026-02-05" }),
      makeTransaction({ amount: "-700.00", date: "2026-02-10" }),
    ];

    const kpis = computeCashflowKpis(transactions, range, todayAfterPeriod);

    expect(kpis.entrateMedie).toBe(1500);
    expect(kpis.usciteMedie).toBe(600);
    expect(kpis.flussoNettoTotale).toBe(1800);
    expect(kpis.tassoRisparmio).toBeCloseTo(1800 / 3000);
  });

  it("tassoRisparmio è null quando le entrate sono zero", () => {
    const transactions = [makeTransaction({ amount: "-500.00", date: "2026-01-10" })];
    const kpis = computeCashflowKpis(transactions, range, todayAfterPeriod);
    expect(kpis.tassoRisparmio).toBeNull();
  });

  it("conta come uscita solo la spesa effettiva post-'Dividi' (amount - excludedAmount)", () => {
    const transactions = [
      makeTransaction({ amount: "-1000.00", excludedAmount: "-400.00", date: "2026-01-10" }), // effettiva: -600
    ];

    const kpis = computeCashflowKpis(transactions, range, todayAfterPeriod);

    expect(kpis.usciteMedie).toBe(300); // 600 di spesa effettiva totale ÷ 2 mesi
  });

  it("il denominatore delle medie riflette i mesi trascorsi: un mese in corso solo parzialmente trascorso non conta come mese intero", () => {
    const todayMidFebruary = new Date(2026, 1, 14); // 14 febbraio: gennaio trascorso per intero, febbraio al 50% (28 giorni)
    const transactions = [
      makeTransaction({ amount: "1500.00", date: "2026-01-05" }),
      makeTransaction({ amount: "1500.00", date: "2026-02-05" }),
    ];

    const kpis = computeCashflowKpis(transactions, range, todayMidFebruary);

    // mesi trascorsi: 1 (gennaio) + 14/28 (febbraio) = 1.5, non 2
    expect(kpis.entrateMedie).toBeCloseTo(3000 / 1.5);
  });
});

describe("computeMonthlySeries", () => {
  it("include un mese senza transazioni con entrate/uscite a 0", () => {
    const range = { from: new Date(2026, 0, 1), to: new Date(2026, 1, 28) };
    const transactions = [makeTransaction({ amount: "1000.00", date: "2026-01-05" })];

    const series = computeMonthlySeries(transactions, range);

    expect(series).toHaveLength(2);
    expect(series[0]).toMatchObject({ month: 0, entrate: 1000, uscite: 0 });
    expect(series[1]).toMatchObject({ month: 1, entrate: 0, uscite: 0 });
  });

  it("conta come uscita solo la spesa effettiva post-'Dividi'", () => {
    const range = { from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) };
    const transactions = [
      makeTransaction({ amount: "-1000.00", excludedAmount: "-400.00", date: "2026-01-10" }),
    ];

    const series = computeMonthlySeries(transactions, range);

    expect(series[0].uscite).toBe(600);
  });
});

describe("computeIncomeSources", () => {
  it("ordina le fonti per importo decrescente con quota % sul totale", () => {
    const range = { from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) };
    const stipendio = makeCategory({ id: "cat-stipendio", name: "Stipendio", type: "entrata" });
    const freelance = makeCategory({ id: "cat-freelance", name: "Freelance", type: "entrata" });
    const transactions = [
      makeTransaction({ categoryId: "cat-stipendio", amount: "1500.00", date: "2026-01-05" }),
      makeTransaction({ categoryId: "cat-freelance", amount: "500.00", date: "2026-01-10" }),
    ];

    const sources = computeIncomeSources(transactions, [stipendio, freelance], range);

    expect(sources.map((s) => s.categoryId)).toEqual(["cat-stipendio", "cat-freelance"]);
    expect(sources[0].quotaPct).toBeCloseTo(75);
    expect(sources[1].quotaPct).toBeCloseTo(25);
  });

  it("esclude una fonte con importo zero nel periodo", () => {
    const range = { from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) };
    const stipendio = makeCategory({ id: "cat-stipendio", name: "Stipendio", type: "entrata" });
    const dividendi = makeCategory({ id: "cat-dividendi", name: "Dividendi", type: "entrata" });
    const transactions = [makeTransaction({ categoryId: "cat-stipendio", amount: "1500.00", date: "2026-01-05" })];

    const sources = computeIncomeSources(transactions, [stipendio, dividendi], range);

    expect(sources.map((s) => s.categoryId)).toEqual(["cat-stipendio"]);
  });

  it("include un'entrata sulla categoria fallback 'Da categorizzare' come riga propria, così le quote sommano a 100%", () => {
    const range = { from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) };
    const stipendio = makeCategory({ id: "cat-stipendio", name: "Stipendio", type: "entrata" });
    const fallback = makeCategory({
      id: "cat-fallback",
      name: "Da categorizzare",
      type: "variabile",
      isFallback: true,
    });
    const transactions = [
      makeTransaction({ categoryId: "cat-stipendio", amount: "750.00", date: "2026-01-05" }),
      makeTransaction({ categoryId: "cat-fallback", amount: "250.00", date: "2026-01-10" }),
    ];

    const sources = computeIncomeSources(transactions, [stipendio, fallback], range);

    expect(sources.map((s) => s.categoryId)).toEqual(["cat-stipendio", "cat-fallback"]);
    const totalPct = sources.reduce((sum, s) => sum + (s.quotaPct ?? 0), 0);
    expect(totalPct).toBeCloseTo(100);
  });
});

describe("computeWhereItGoes", () => {
  it("calcola fisse/variabili/risparmio del mese di riferimento con quote sul totale entrate", () => {
    const fissa = makeCategory({ id: "cat-fissa", type: "fissa" });
    const variabile = makeCategory({ id: "cat-variabile", type: "variabile" });
    const transactions = [
      makeTransaction({ categoryId: "cat-fissa", amount: "-400.00", date: "2026-02-05" }),
      makeTransaction({ categoryId: "cat-variabile", amount: "-300.00", date: "2026-02-10" }),
      makeTransaction({ categoryId: "category-1", amount: "1500.00", date: "2026-02-01" }),
    ];

    const entries = computeWhereItGoes(transactions, [fissa, variabile], new Date(2026, 1, 15));

    expect(entries.find((e) => e.key === "fisse")?.amount).toBe(400);
    expect(entries.find((e) => e.key === "fisse")?.quotaPct).toBeCloseTo((400 / 1500) * 100);
    expect(entries.find((e) => e.key === "variabili")?.amount).toBe(300);
    expect(entries.find((e) => e.key === "risparmio")?.amount).toBe(800);
  });

  it("il risparmio può essere negativo se si spende più di quanto entra", () => {
    const fissa = makeCategory({ id: "cat-fissa", type: "fissa" });
    const transactions = [
      makeTransaction({ categoryId: "cat-fissa", amount: "-2000.00", date: "2026-02-05" }),
      makeTransaction({ categoryId: "category-1", amount: "1500.00", date: "2026-02-01" }),
    ];

    const entries = computeWhereItGoes(transactions, [fissa], new Date(2026, 1, 15));

    expect(entries.find((e) => e.key === "risparmio")?.amount).toBe(-500);
  });

  it("quotaPct è null quando le entrate del mese sono zero", () => {
    const fissa = makeCategory({ id: "cat-fissa", type: "fissa" });
    const transactions = [makeTransaction({ categoryId: "cat-fissa", amount: "-200.00", date: "2026-02-05" })];

    const entries = computeWhereItGoes(transactions, [fissa], new Date(2026, 1, 15));

    expect(entries.every((e) => e.quotaPct === null)).toBe(true);
  });

  it("una spesa su categoria non classificabile (assente dall'array o erroneamente 'entrata') non gonfia il risparmio", () => {
    const fissa = makeCategory({ id: "cat-fissa", type: "fissa" });
    const transactions = [
      makeTransaction({ categoryId: "cat-fissa", amount: "-400.00", date: "2026-02-05" }),
      makeTransaction({ categoryId: "cat-sconosciuta", amount: "-100.00", date: "2026-02-06" }),
      makeTransaction({ categoryId: "category-1", amount: "1500.00", date: "2026-02-01" }),
    ];

    const entries = computeWhereItGoes(transactions, [fissa], new Date(2026, 1, 15));

    expect(entries.find((e) => e.key === "nonClassificato")?.amount).toBe(100);
    expect(entries.find((e) => e.key === "risparmio")?.amount).toBe(1000); // 1500 - 400 - 0 - 100
  });

  it("conta come spesa solo l'importo effettivo post-'Dividi'", () => {
    const fissa = makeCategory({ id: "cat-fissa", type: "fissa" });
    const transactions = [
      makeTransaction({
        categoryId: "cat-fissa",
        amount: "-400.00",
        excludedAmount: "-150.00",
        date: "2026-02-05",
      }),
    ];

    const entries = computeWhereItGoes(transactions, [fissa], new Date(2026, 1, 15));

    expect(entries.find((e) => e.key === "fisse")?.amount).toBe(250);
  });
});

describe("computeAccumulatedSavings", () => {
  it("somma cumulativamente il flusso netto mese su mese, anche quando negativo", () => {
    const range = { from: new Date(2026, 0, 1), to: new Date(2026, 2, 31) };
    const transactions = [
      makeTransaction({ amount: "1000.00", date: "2026-01-05" }),
      makeTransaction({ amount: "-1500.00", date: "2026-02-05" }),
      makeTransaction({ amount: "500.00", date: "2026-03-05" }),
    ];

    const result = computeAccumulatedSavings(transactions, range);

    expect(result.map((e) => e.cumulative)).toEqual([1000, -500, 0]);
  });
});
