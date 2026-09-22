import { describe, expect, it } from "vitest";
import {
  computeIncomeKpis,
  computeIncomeSummary,
  computeKpis,
  computeSummary,
  effectiveAmount,
  getPeriodRange,
  getPreviousPeriodRange,
  isExpense,
  parseDateOnly,
  scaleBudgetForPeriod,
  computeCategoryBreakdown,
  computeGroupTotals,
  compute6MonthTrend,
  computeCategoryMonthlyStacks,
  filterTransactions,
  shiftReferenceDate,
  formatPeriodLabel,
  isIncome,
  filterByTransactionType,
} from "./expenses";
import type { Transaction } from "@/lib/db/schema/transactions";
import type { Budget } from "@/lib/db/schema/budgets";
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

function makeBudget(overrides: Partial<Budget>): Budget {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    categoryId: "category-1",
    monthlyAmount: "0.00",
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
    type: "voluta",
    color: "slate",
    icon: "package",
    isFallback: false,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("parseDateOnly", () => {
  it("costruisce una data locale senza slittamenti di fuso orario", () => {
    const date = parseDateOnly("2026-02-10");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(1);
    expect(date.getDate()).toBe(10);
  });
});

describe("getPeriodRange", () => {
  it("mese copre dal primo all'ultimo giorno del mese", () => {
    const range = getPeriodRange("mese", new Date(2026, 1, 10));
    expect(range.from).toEqual(new Date(2026, 1, 1));
    expect(range.to).toEqual(new Date(2026, 1, 28));
  });

  it("anno copre dal 1 gennaio al 31 dicembre", () => {
    const range = getPeriodRange("anno", new Date(2026, 5, 1));
    expect(range.from).toEqual(new Date(2026, 0, 1));
    expect(range.to).toEqual(new Date(2026, 11, 31));
  });

  it("3mesi copre 3 mesi calendariali fino a quello corrente incluso", () => {
    const range = getPeriodRange("3mesi", new Date(2026, 5, 15));
    expect(range.from).toEqual(new Date(2026, 3, 1));
    expect(range.to).toEqual(new Date(2026, 5, 30));
  });

  it("settimana copre esattamente 7 giorni a partire da un lunedì e contiene referenceDate", () => {
    const referenceDate = new Date(2026, 6, 15);
    const range = getPeriodRange("settimana", referenceDate);
    const spanDays = Math.round((range.to.getTime() - range.from.getTime()) / 86400000);
    expect(spanDays).toBe(6);
    expect(range.from.getDay()).toBe(1);
    expect(referenceDate.getTime()).toBeGreaterThanOrEqual(range.from.getTime());
    expect(referenceDate.getTime()).toBeLessThanOrEqual(range.to.getTime());
  });
});

describe("getPreviousPeriodRange", () => {
  it("mese precedente è il mese calendariale immediatamente prima", () => {
    const range = getPreviousPeriodRange("mese", new Date(2026, 1, 10));
    expect(range.from).toEqual(new Date(2026, 0, 1));
    expect(range.to).toEqual(new Date(2026, 0, 31));
  });

  it("anno precedente è l'anno solare immediatamente prima", () => {
    const range = getPreviousPeriodRange("anno", new Date(2026, 5, 1));
    expect(range.from).toEqual(new Date(2025, 0, 1));
    expect(range.to).toEqual(new Date(2025, 11, 31));
  });
});

describe("isExpense / effectiveAmount", () => {
  it("considera spesa solo un importo negativo", () => {
    expect(isExpense(makeTransaction({ amount: "-50.00" }))).toBe(true);
    expect(isExpense(makeTransaction({ amount: "50.00" }))).toBe(false);
  });

  it("calcola la spesa effettiva sottraendo la quota esclusa", () => {
    const transaction = makeTransaction({ amount: "-100.00", excludedAmount: "-30.00" });
    expect(effectiveAmount(transaction)).toBe(-70);
  });
});

describe("computeSummary", () => {
  it("somma Uscite/Escluse/Spese effettive ignorando le entrate", () => {
    const range = { from: new Date(2026, 1, 1), to: new Date(2026, 1, 28) };
    const transactions = [
      makeTransaction({ date: "2026-02-05", amount: "-100.00", excludedAmount: "-40.00" }),
      makeTransaction({ date: "2026-02-10", amount: "-50.00" }),
      makeTransaction({ date: "2026-02-15", amount: "200.00" }),
    ];
    const summary = computeSummary(transactions, range);
    expect(summary.uscite).toBe(150);
    expect(summary.escluse).toBe(40);
    expect(summary.speseEffettive).toBe(110);
  });
});

describe("computeIncomeSummary", () => {
  it("somma Entrate/Escluse/Entrate effettive ignorando le uscite", () => {
    const range = { from: new Date(2026, 1, 1), to: new Date(2026, 1, 28) };
    const transactions = [
      makeTransaction({ date: "2026-02-05", amount: "1500.00", excludedAmount: "300.00" }),
      makeTransaction({ date: "2026-02-10", amount: "200.00" }),
      makeTransaction({ date: "2026-02-15", amount: "-80.00" }),
    ];
    const summary = computeIncomeSummary(transactions, range);
    expect(summary.entrate).toBe(1700);
    expect(summary.escluse).toBe(300);
    expect(summary.entrateEffettive).toBe(1400);
  });
});

describe("scaleBudgetForPeriod", () => {
  it("scala il budget mensile in base al periodo", () => {
    expect(scaleBudgetForPeriod(300, "settimana")).toBeCloseTo(70, 5);
    expect(scaleBudgetForPeriod(300, "mese")).toBe(300);
    expect(scaleBudgetForPeriod(300, "3mesi")).toBe(900);
    expect(scaleBudgetForPeriod(300, "anno")).toBe(3600);
  });
});

describe("computeKpis", () => {
  it("calcola Speso/Budget rimanente/giorni rimasti/media giornaliera per il mese in corso", () => {
    const referenceDate = new Date(2026, 1, 15);
    const transactions = [
      makeTransaction({ date: "2026-02-05", amount: "-300.00" }),
      makeTransaction({ date: "2026-02-10", amount: "-100.00" }),
      makeTransaction({ date: "2026-02-20", amount: "-50.00" }), // futuro rispetto a referenceDate
      makeTransaction({ date: "2026-01-15", amount: "-310.00" }), // mese precedente
    ];
    const budgets = [makeBudget({ monthlyAmount: "700.00" })];

    const kpis = computeKpis(transactions, budgets, "mese", referenceDate, referenceDate);

    expect(kpis.speso).toBe(400);
    expect(kpis.budgetTotale).toBe(700);
    expect(kpis.budgetRimanente).toBe(300);
    expect(kpis.giorniRimasti).toBe(13);
    expect(kpis.mediaGiornaliera).toBeCloseTo(400 / 15, 5);
    expect(kpis.mediaGiornalieraPeriodoPrecedente).toBe(10);
  });

  it("un periodo passato (mese concluso) conta tutti i giorni come trascorsi, indipendentemente da 'oggi'", () => {
    const referenceDate = new Date(2026, 1, 15); // vista: metà febbraio 2026
    const today = new Date(2026, 3, 10); // oggi reale: aprile 2026, febbraio è già concluso
    const transactions = [
      makeTransaction({ date: "2026-02-05", amount: "-100.00" }),
      makeTransaction({ date: "2026-02-28", amount: "-180.00" }), // fine mese: futuro rispetto a referenceDate, passato rispetto a today
    ];
    const budgets = [makeBudget({ monthlyAmount: "280.00" })];

    const kpis = computeKpis(transactions, budgets, "mese", referenceDate, today);

    expect(kpis.speso).toBe(280);
    expect(kpis.giorniRimasti).toBe(0);
    expect(kpis.mediaGiornaliera).toBeCloseTo(280 / 28, 5);
  });

  it("nessun budget impostato: budgetRimanente è null, non un negativo basato su tutte le spese", () => {
    const referenceDate = new Date(2026, 1, 15);
    const transactions = [makeTransaction({ date: "2026-02-05", amount: "-300.00" })];

    const kpis = computeKpis(transactions, [], "mese", referenceDate, referenceDate);

    expect(kpis.budgetTotale).toBe(0);
    expect(kpis.budgetRimanente).toBeNull();
  });

  it("budget impostato solo su alcune categorie: budgetRimanente considera solo la spesa di quelle categorie", () => {
    const referenceDate = new Date(2026, 1, 15);
    const transactions = [
      makeTransaction({ categoryId: "category-1", date: "2026-02-05", amount: "-100.00" }),
      makeTransaction({ categoryId: "category-2", date: "2026-02-06", amount: "-500.00" }), // categoria senza budget
    ];
    const budgets = [makeBudget({ categoryId: "category-1", monthlyAmount: "200.00" })];

    const kpis = computeKpis(transactions, budgets, "mese", referenceDate, referenceDate);

    expect(kpis.speso).toBe(600); // "Speso nel periodo" resta il totale di tutte le categorie
    expect(kpis.budgetTotale).toBe(200);
    expect(kpis.budgetRimanente).toBe(100); // 200 - 100, non 200 - 600
  });
});

describe("computeIncomeKpis", () => {
  it("calcola Entrate/media giornaliera per il mese in corso, ignorando le uscite", () => {
    const referenceDate = new Date(2026, 1, 15);
    const transactions = [
      makeTransaction({ date: "2026-02-05", amount: "1500.00" }),
      makeTransaction({ date: "2026-02-10", amount: "100.00" }),
      makeTransaction({ date: "2026-02-20", amount: "500.00" }), // futuro rispetto a referenceDate
      makeTransaction({ date: "2026-02-10", amount: "-50.00" }), // uscita, ignorata
      makeTransaction({ date: "2026-01-15", amount: "1600.00" }), // mese precedente
    ];

    const kpis = computeIncomeKpis(transactions, "mese", referenceDate, referenceDate);

    expect(kpis.entrate).toBe(1600);
    expect(kpis.mediaGiornaliera).toBeCloseTo(1600 / 15, 5);
    expect(kpis.mediaGiornalieraPeriodoPrecedente).toBeCloseTo(1600 / 31, 5);
  });
});

describe("computeCategoryBreakdown", () => {
  it("somma la spesa effettiva per ciascuna categoria dell'utente, incluse quelle senza transazioni", () => {
    const categories = [
      makeCategory({ id: "cat-a", name: "Spesa alimentare", type: "dovuta" }),
      makeCategory({ id: "cat-b", name: "Netflix", type: "voluta" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-a", date: "2026-02-05", amount: "-60.00" }),
      makeTransaction({ categoryId: "cat-a", date: "2026-02-06", amount: "-40.00", excludedAmount: "-10.00" }),
    ];
    const breakdown = computeCategoryBreakdown(transactions, categories, "mese", new Date(2026, 1, 15), new Date(2026, 1, 15));

    expect(breakdown).toEqual([
      { categoryId: "cat-a", name: "Spesa alimentare", group: "dovuta", amount: 90, color: "slate", icon: "package" },
      { categoryId: "cat-b", name: "Netflix", group: "voluta", amount: 0, color: "slate", icon: "package" },
    ]);
  });

  it("la categoria fallback ha group 'daCategorizzare' anche se il suo type è 'voluta'", () => {
    const categories = [makeCategory({ id: "cat-f", name: "Da categorizzare", type: "voluta", isFallback: true })];
    const transactions = [makeTransaction({ categoryId: "cat-f", date: "2026-02-05", amount: "-25.00" })];
    const [entry] = computeCategoryBreakdown(transactions, categories, "mese", new Date(2026, 1, 15), new Date(2026, 1, 15));
    expect(entry.group).toBe("daCategorizzare");
    expect(entry.amount).toBe(25);
  });
});

describe("computeGroupTotals", () => {
  it("somma la spesa effettiva del periodo per gruppo, con la fallback in daCategorizzare", () => {
    const categories = [
      makeCategory({ id: "cat-dov", type: "dovuta" }),
      makeCategory({ id: "cat-vol", type: "voluta" }),
      makeCategory({ id: "cat-fut", type: "futuro" }),
      makeCategory({ id: "cat-sal", type: "saltuaria" }),
      makeCategory({ id: "cat-fb", type: "voluta", isFallback: true }),
      makeCategory({ id: "cat-in", type: "entrata" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-dov", date: "2026-02-05", amount: "-500.00" }),
      makeTransaction({ categoryId: "cat-vol", date: "2026-02-06", amount: "-60.00" }),
      makeTransaction({ categoryId: "cat-fut", date: "2026-02-07", amount: "-200.00" }),
      makeTransaction({ categoryId: "cat-sal", date: "2026-02-08", amount: "-90.00" }),
      makeTransaction({ categoryId: "cat-fb", date: "2026-02-09", amount: "-15.00" }),
      makeTransaction({ categoryId: "cat-in", date: "2026-02-01", amount: "1500.00" }),
    ];
    const result = computeGroupTotals(transactions, categories, "mese", new Date(2026, 1, 15), new Date(2026, 1, 15));
    expect(result).toEqual({ dovuta: 500, voluta: 60, futuro: 200, saltuaria: 90, daCategorizzare: 15 });
  });

  it("restituisce tutti i gruppi a zero senza transazioni", () => {
    const result = computeGroupTotals([], [], "mese", new Date(2026, 1, 15), new Date(2026, 1, 15));
    expect(result).toEqual({ dovuta: 0, voluta: 0, futuro: 0, saltuaria: 0, daCategorizzare: 0 });
  });
});

describe("compute6MonthTrend", () => {
  it("ritorna 6 mesi calendariali fino a quello corrente, ignorando dati fuori finestra", () => {
    const referenceDate = new Date(2026, 6, 15); // luglio 2026
    const transactions = [
      makeTransaction({ date: "2026-01-10", amount: "-999.00" }), // fuori finestra (gennaio)
      makeTransaction({ date: "2026-02-10", amount: "-100.00" }),
      makeTransaction({ date: "2026-07-05", amount: "-50.00" }),
    ];
    const trend = compute6MonthTrend(transactions, referenceDate);

    expect(trend).toHaveLength(6);
    expect(trend[0]).toEqual({ year: 2026, month: 1, label: "Feb", total: 100 });
    expect(trend[5]).toEqual({ year: 2026, month: 6, label: "Lug", total: 50 });
    expect(trend.reduce((sum, m) => sum + m.total, 0)).toBe(150);
  });
});

describe("computeCategoryMonthlyStacks", () => {
  it("ricalcola composizione e ordine in modo indipendente per ogni mese (non un ranking fisso sul totale semestre)", () => {
    const referenceDate = new Date(2026, 6, 15); // luglio 2026
    const categories = [
      makeCategory({ id: "cat-a", name: "A", color: "blue" }),
      makeCategory({ id: "cat-b", name: "B", color: "green" }),
      makeCategory({ id: "cat-c", name: "C", color: "red" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-a", date: "2026-02-05", amount: "-300.00" }),
      makeTransaction({ categoryId: "cat-b", date: "2026-07-05", amount: "-250.00" }),
      makeTransaction({ categoryId: "cat-c", date: "2026-07-06", amount: "-100.00" }),
    ];

    const months = computeCategoryMonthlyStacks(transactions, categories, referenceDate, 2);

    expect(months).toHaveLength(6);

    const feb = months.find((m) => m.month === 1);
    expect(feb?.segments).toEqual([{ key: "cat-a", name: "A", color: "blue", amount: 300 }]);

    const jul = months.find((m) => m.month === 6);
    expect(jul?.segments).toEqual([
      { key: "cat-b", name: "B", color: "green", amount: 250 },
      { key: "cat-c", name: "C", color: "red", amount: 100 },
    ]);
  });

  it("riordina 'Altro' insieme alle categorie individuali: se il suo totale supera una categoria top, si posiziona di conseguenza (non fisso in coda)", () => {
    const referenceDate = new Date(2026, 6, 15);
    const categories = [
      makeCategory({ id: "cat-a", name: "A", color: "blue" }),
      makeCategory({ id: "cat-b", name: "B", color: "green" }),
      makeCategory({ id: "cat-c", name: "C", color: "red" }),
      makeCategory({ id: "cat-d", name: "D", color: "yellow" }),
      makeCategory({ id: "cat-e", name: "E", color: "purple" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-a", date: "2026-07-05", amount: "-100.00" }),
      makeTransaction({ categoryId: "cat-b", date: "2026-07-05", amount: "-50.00" }),
      makeTransaction({ categoryId: "cat-c", date: "2026-07-05", amount: "-40.00" }),
      makeTransaction({ categoryId: "cat-d", date: "2026-07-05", amount: "-35.00" }),
      makeTransaction({ categoryId: "cat-e", date: "2026-07-05", amount: "-20.00" }),
    ];

    const months = computeCategoryMonthlyStacks(transactions, categories, referenceDate, 2);
    const jul = months.find((m) => m.month === 6);

    // top individuali: cat-a (100), cat-b (50). Resto: cat-c+cat-d+cat-e = 95 -> "Altro" si piazza tra cat-a e cat-b.
    expect(jul?.segments).toEqual([
      { key: "cat-a", name: "A", color: "blue", amount: 100 },
      { key: "altro", name: "Altro", color: "altro", amount: 95 },
      { key: "cat-b", name: "B", color: "green", amount: 50 },
    ]);
  });

  it("con meno categorie attive del topCount, l'array segments è più corto e non contiene chiavi fantasma", () => {
    const referenceDate = new Date(2026, 6, 15);
    const categories = [
      makeCategory({ id: "cat-a", name: "A", color: "blue" }),
      makeCategory({ id: "cat-b", name: "B", color: "green" }),
      makeCategory({ id: "cat-c", name: "C", color: "red" }),
    ];
    const transactions = [
      makeTransaction({ categoryId: "cat-a", date: "2026-07-05", amount: "-100.00" }),
      makeTransaction({ categoryId: "cat-b", date: "2026-07-06", amount: "-50.00" }),
    ];

    const months = computeCategoryMonthlyStacks(transactions, categories, referenceDate);
    const jul = months.find((m) => m.month === 6);

    expect(jul?.segments).toEqual([
      { key: "cat-a", name: "A", color: "blue", amount: 100 },
      { key: "cat-b", name: "B", color: "green", amount: 50 },
    ]);
  });

  it("con nessuna categoria o transazione ritorna 6 mesi con segments vuoto", () => {
    const referenceDate = new Date(2026, 6, 15);
    const months = computeCategoryMonthlyStacks([], [], referenceDate);

    expect(months).toHaveLength(6);
    expect(months.every((m) => m.segments.length === 0)).toBe(true);
  });
});

describe("filterTransactions", () => {
  it("senza filtri restituisce tutte le transazioni invariate", () => {
    const transactions = [
      makeTransaction({ id: "t1", categoryId: "category-1", description: "Spesa alimentare" }),
      makeTransaction({ id: "t2", categoryId: "category-2", description: "Cinema" }),
    ];
    const result = filterTransactions(transactions, { categoryId: null, searchText: "" });
    expect(result).toEqual(transactions);
  });

  it("filtra per categoryId esatto", () => {
    const transactions = [
      makeTransaction({ id: "t1", categoryId: "category-1", description: "Spesa alimentare" }),
      makeTransaction({ id: "t2", categoryId: "category-2", description: "Cinema" }),
    ];
    const result = filterTransactions(transactions, { categoryId: "category-2", searchText: "" });
    expect(result.map((t) => t.id)).toEqual(["t2"]);
  });

  it("filtra per testo, substring case-insensitive sulla descrizione", () => {
    const transactions = [
      makeTransaction({ id: "t1", categoryId: "category-1", description: "Spesa alimentare Esselunga" }),
      makeTransaction({ id: "t2", categoryId: "category-1", description: "Cinema" }),
    ];
    const result = filterTransactions(transactions, { categoryId: null, searchText: "esselunga" });
    expect(result.map((t) => t.id)).toEqual(["t1"]);
  });

  it("combina categoria e testo in AND", () => {
    const transactions = [
      makeTransaction({ id: "t1", categoryId: "category-1", description: "Spesa Esselunga" }),
      makeTransaction({ id: "t2", categoryId: "category-2", description: "Spesa Esselunga" }),
    ];
    const result = filterTransactions(transactions, { categoryId: "category-1", searchText: "esselunga" });
    expect(result.map((t) => t.id)).toEqual(["t1"]);
  });

  it("nessun match restituisce array vuoto", () => {
    const transactions = [makeTransaction({ id: "t1", description: "Cinema" })];
    const result = filterTransactions(transactions, { categoryId: null, searchText: "ristorante" });
    expect(result).toEqual([]);
  });

  it("ignora spazi bianchi attorno al testo di ricerca", () => {
    const transactions = [makeTransaction({ id: "t1", description: "Cinema" })];
    const result = filterTransactions(transactions, { categoryId: null, searchText: "  cinema  " });
    expect(result.map((t) => t.id)).toEqual(["t1"]);
  });

  it("filtra per testo anche dentro la nota, oltre alla descrizione", () => {
    const transactions = [
      makeTransaction({ id: "t1", description: "Esselunga", note: null }),
      makeTransaction({ id: "t2", description: "PAYPAL *XYZ", note: "Regalo compleanno di Marco" }),
    ];
    const result = filterTransactions(transactions, { categoryId: null, searchText: "marco" });
    expect(result.map((t) => t.id)).toEqual(["t2"]);
  });
});

describe("shiftReferenceDate", () => {
  it("settimana sposta di 7 giorni avanti e indietro", () => {
    const referenceDate = new Date(2026, 6, 15);
    expect(shiftReferenceDate("settimana", referenceDate, 1)).toEqual(new Date(2026, 6, 22));
    expect(shiftReferenceDate("settimana", referenceDate, -1)).toEqual(new Date(2026, 6, 8));
  });

  it("mese sposta di un mese avanti e indietro, attraversando il cambio anno", () => {
    const referenceDate = new Date(2026, 0, 15); // gennaio 2026
    expect(shiftReferenceDate("mese", referenceDate, 1)).toEqual(new Date(2026, 1, 15));
    expect(shiftReferenceDate("mese", referenceDate, -1)).toEqual(new Date(2025, 11, 15));
  });

  it("3mesi sposta di 3 mesi avanti e indietro", () => {
    const referenceDate = new Date(2026, 5, 15); // giugno 2026
    expect(shiftReferenceDate("3mesi", referenceDate, 1)).toEqual(new Date(2026, 8, 15));
    expect(shiftReferenceDate("3mesi", referenceDate, -1)).toEqual(new Date(2026, 2, 15));
  });

  it("anno sposta di un anno avanti e indietro", () => {
    const referenceDate = new Date(2026, 5, 15);
    expect(shiftReferenceDate("anno", referenceDate, 1)).toEqual(new Date(2027, 5, 15));
    expect(shiftReferenceDate("anno", referenceDate, -1)).toEqual(new Date(2025, 5, 15));
  });
});

describe("formatPeriodLabel", () => {
  it("mese: nome mese esteso capitalizzato + anno", () => {
    const range = getPeriodRange("mese", new Date(2026, 6, 15));
    expect(formatPeriodLabel("mese", range)).toBe("Luglio 2026");
  });

  it("anno: solo l'anno", () => {
    const range = getPeriodRange("anno", new Date(2026, 6, 15));
    expect(formatPeriodLabel("anno", range)).toBe("2026");
  });

  it("settimana: giorno-giorno mese abbreviato, stesso anno, senza spazi attorno al trattino", () => {
    const range = getPeriodRange("settimana", new Date(2026, 6, 15));
    expect(formatPeriodLabel("settimana", range)).toBe("13–19 lug");
  });

  it("settimana: giorno-mese - giorno-mese, stesso anno ma mesi diversi", () => {
    const range = getPeriodRange("settimana", new Date(2026, 6, 29));
    expect(formatPeriodLabel("settimana", range)).toBe("27 lug – 2 ago");
  });

  it("settimana: entrambe le date complete a cavallo d'anno", () => {
    const range = { from: new Date(2026, 11, 28), to: new Date(2027, 0, 3) };
    expect(formatPeriodLabel("settimana", range)).toBe("28 dic 2026 – 3 gen 2027");
  });

  it("3mesi: mese abbreviato - mese abbreviato + anno, stesso anno", () => {
    const range = getPeriodRange("3mesi", new Date(2026, 6, 15));
    expect(formatPeriodLabel("3mesi", range)).toBe("Mag – Lug 2026");
  });

  it("3mesi: entrambi i mesi con anno, a cavallo d'anno", () => {
    const range = getPeriodRange("3mesi", new Date(2026, 0, 15));
    expect(formatPeriodLabel("3mesi", range)).toBe("Nov 2025 – Gen 2026");
  });
});

describe("isIncome", () => {
  it("è true per un importo positivo", () => {
    expect(isIncome(makeTransaction({ amount: "1500.00" }))).toBe(true);
  });

  it("è false per un importo negativo o zero", () => {
    expect(isIncome(makeTransaction({ amount: "-10.00" }))).toBe(false);
    expect(isIncome(makeTransaction({ amount: "0.00" }))).toBe(false);
  });
});

describe("filterByTransactionType", () => {
  const income = makeTransaction({ id: "t-income", amount: "1500.00" });
  const expense = makeTransaction({ id: "t-expense", amount: "-30.00" });
  const all = [income, expense];

  it("'tutte' non filtra nulla", () => {
    expect(filterByTransactionType(all, "tutte")).toEqual(all);
  });

  it("'uscita' tiene solo gli importi negativi", () => {
    expect(filterByTransactionType(all, "uscita")).toEqual([expense]);
  });

  it("'entrata' tiene solo gli importi positivi", () => {
    expect(filterByTransactionType(all, "entrata")).toEqual([income]);
  });
});

describe("computeCategoryBreakdown esclude le categorie di entrata", () => {
  it("non include una categoria type 'entrata' nel risultato", () => {
    const variabile = makeCategory({ id: "cat-var", type: "voluta" });
    const entrata = makeCategory({ id: "cat-income", name: "Stipendio", type: "entrata" });
    const transactions = [
      makeTransaction({ categoryId: "cat-var", amount: "-50.00", date: "2026-02-05" }),
      makeTransaction({ categoryId: "cat-income", amount: "1500.00", date: "2026-02-01" }),
    ];
    const referenceDate = new Date(2026, 1, 10);
    const today = referenceDate;

    const breakdown = computeCategoryBreakdown(transactions, [variabile, entrata], "mese", referenceDate, today);

    expect(breakdown.map((entry) => entry.categoryId)).toEqual(["cat-var"]);
  });
});
