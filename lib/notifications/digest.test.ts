import { describe, expect, it } from "vitest";
import { makeBudget, makeCategory, makeTransaction } from "./fixtures.test-util";
import { buildDigest, digestPeriod, digestWindowStartIso, isDigestDay } from "./digest";

const NOW = new Date("2026-10-02T07:00:00Z");
const categories = [makeCategory({ id: "cat-food", name: "Spesa alimentare" }), makeCategory({ id: "cat-fun", name: "Svago", type: "voluta" })];

describe("isDigestDay", () => {
  it("il mensile parte nei primi tre giorni del mese", () => {
    expect(isDigestDay("mensile", new Date("2026-10-01T07:00:00Z"))).toBe(true);
    expect(isDigestDay("mensile", new Date("2026-10-03T07:00:00Z"))).toBe(true);
    expect(isDigestDay("mensile", new Date("2026-10-04T07:00:00Z"))).toBe(false);
  });

  it("il settimanale parte il lunedì e il martedì (ora di Roma)", () => {
    expect(isDigestDay("settimanale", new Date("2026-10-12T07:00:00Z"))).toBe(true); // lunedì
    expect(isDigestDay("settimanale", new Date("2026-10-13T07:00:00Z"))).toBe(true);
    expect(isDigestDay("settimanale", new Date("2026-10-14T07:00:00Z"))).toBe(false);
  });

  it("usa il giorno di Roma anche a cavallo della mezzanotte UTC", () => {
    // 30 settembre 22:30 UTC = 1 ottobre 00:30 a Roma
    expect(isDigestDay("mensile", new Date("2026-09-30T22:30:00Z"))).toBe(true);
  });
});

describe("digestPeriod", () => {
  it("il mensile guarda il mese precedente e la chiave non cambia nei giorni di margine", () => {
    const a = digestPeriod("mensile", new Date("2026-10-01T07:00:00Z"));
    const b = digestPeriod("mensile", new Date("2026-10-03T07:00:00Z"));
    expect(a.key).toBe("digest:mensile:2026-09");
    expect(b.key).toBe(a.key);
    expect(a.label).toBe("Settembre 2026");
  });

  it("il settimanale guarda la settimana precedente, da lunedì", () => {
    const monday = digestPeriod("settimanale", new Date("2026-10-12T07:00:00Z"));
    const tuesday = digestPeriod("settimanale", new Date("2026-10-13T07:00:00Z"));
    expect(monday.key).toBe("digest:settimanale:2026-10-05");
    expect(tuesday.key).toBe(monday.key);
  });

  it("la finestra dei dati parte dal periodo prima, per il confronto", () => {
    expect(digestWindowStartIso("mensile", NOW)).toBe("2026-08-01");
  });
});

describe("buildDigest", () => {
  const transactions = [
    makeTransaction({ amount: "-200.00", date: "2026-09-05", categoryId: "cat-food" }),
    makeTransaction({ amount: "-100.00", excludedAmount: "-40.00", date: "2026-09-20", categoryId: "cat-fun" }),
    makeTransaction({ amount: "2000.00", date: "2026-09-27", categoryId: "cat-food" }),
    makeTransaction({ amount: "-120.00", date: "2026-08-14", categoryId: "cat-food" }),
    makeTransaction({ amount: "-999.00", date: "2026-10-01", categoryId: "cat-food" }), // fuori periodo
  ];

  it("somma spese effettive (dopo «Dividi»), entrate e confronto col periodo precedente", () => {
    const data = buildDigest({ transactions, categories, budgets: [], frequency: "mensile", now: NOW });
    expect(data.spent).toBe(260);
    expect(data.income).toBe(2000);
    expect(data.previousSpent).toBe(120);
    expect(data.movements).toBe(3);
    expect(data.budget).toBeNull();
  });

  it("ordina le categorie più pesanti e conta i budget superati", () => {
    const data = buildDigest({
      transactions,
      categories,
      budgets: [makeBudget({ categoryId: "cat-food", monthlyAmount: "150" }), makeBudget({ categoryId: "cat-fun", monthlyAmount: "100" })],
      frequency: "mensile",
      now: NOW,
    });
    expect(data.topCategories).toEqual([
      { name: "Spesa alimentare", amount: 200 },
      { name: "Svago", amount: 60 },
    ]);
    expect(data.budget).toEqual({ total: 2, over: 1 });
  });

  it("senza movimenti nel periodo non ce n'è da raccontare", () => {
    expect(buildDigest({ transactions: [], categories, budgets: [], frequency: "mensile", now: NOW }).movements).toBe(0);
  });
});
