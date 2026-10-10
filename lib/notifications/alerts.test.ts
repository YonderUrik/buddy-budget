import { describe, expect, it } from "vitest";
import { makeBudget, makeCategory, makeTransaction } from "./fixtures.test-util";
import { findBudgetAlerts, findDeadlineAlerts } from "./alerts";

const NOW = new Date("2026-10-10T07:00:00Z");
const categories = [makeCategory({ id: "cat-food", name: "Spesa alimentare" })];
const budgets = [makeBudget({ categoryId: "cat-food", monthlyAmount: "300" })];
const spend = (amount: number, date = "2026-10-05") => [makeTransaction({ amount: String(-amount), date, categoryId: "cat-food" })];
const base = { categories, budgets, alreadySent: new Set<string>(), now: NOW };

describe("findBudgetAlerts", () => {
  it("non avvisa sotto l'80%", () => {
    expect(findBudgetAlerts({ ...base, transactions: spend(239) })).toEqual([]);
  });

  it("avvisa all'80% e al 100%, con la soglia più alta raggiunta", () => {
    const [at80] = findBudgetAlerts({ ...base, transactions: spend(240) });
    expect(at80).toMatchObject({ name: "Spesa alimentare", threshold: 80, spent: 240, budget: 300 });
    const [at100] = findBudgetAlerts({ ...base, transactions: spend(310) });
    expect(at100.threshold).toBe(100);
    expect(at100.itemKeys).toHaveLength(2);
  });

  it("non ripete una soglia già inviata, ma segnala quando si passa alla successiva", () => {
    const at80Key = "budget:2026-10:cat-food:80";
    expect(findBudgetAlerts({ ...base, alreadySent: new Set([at80Key]), transactions: spend(250) })).toEqual([]);
    const next = findBudgetAlerts({ ...base, alreadySent: new Set([at80Key]), transactions: spend(320) });
    expect(next).toHaveLength(1);
    expect(next[0].threshold).toBe(100);
  });

  it("conta solo il mese in corso e ignora entrate e quota esclusa", () => {
    const transactions = [
      ...spend(500, "2026-09-28"),
      makeTransaction({ amount: "-100.00", excludedAmount: "-100.00", date: "2026-10-03", categoryId: "cat-food" }),
      makeTransaction({ amount: "400.00", date: "2026-10-04", categoryId: "cat-food" }),
    ];
    expect(findBudgetAlerts({ ...base, transactions })).toEqual([]);
  });

  it("il mese nuovo riparte da capo: la chiave contiene il mese", () => {
    const alerts = findBudgetAlerts({ ...base, alreadySent: new Set(["budget:2026-09:cat-food:100"]), transactions: spend(310) });
    expect(alerts).toHaveLength(1);
  });

  it("ordina prima le categorie già sopra il budget", () => {
    const two = [...categories, makeCategory({ id: "cat-fun", name: "Svago" })];
    const alerts = findBudgetAlerts({
      ...base,
      categories: two,
      budgets: [...budgets, makeBudget({ categoryId: "cat-fun", monthlyAmount: "100" })],
      transactions: [...spend(250), makeTransaction({ amount: "-120", date: "2026-10-02", categoryId: "cat-fun" })],
    });
    expect(alerts.map((a) => a.name)).toEqual(["Svago", "Spesa alimentare"]);
  });
});

describe("findDeadlineAlerts", () => {
  const due = (date: string, debtId = "d1", overdue = false) => ({ debtId, name: "Mutuo", date, amount: 600, overdue });

  it("avvisa entro tre giorni dalla scadenza e anche dopo, se scaduta", () => {
    expect(findDeadlineAlerts({ due: [due("2026-10-13")], alreadySent: new Set(), now: NOW })).toHaveLength(1);
    expect(findDeadlineAlerts({ due: [due("2026-10-14")], alreadySent: new Set(), now: NOW })).toEqual([]);
    expect(findDeadlineAlerts({ due: [due("2026-10-01", "d1", true)], alreadySent: new Set(), now: NOW })).toHaveLength(1);
  });

  it("non ripete la stessa rata, ma avvisa per la successiva", () => {
    const sent = new Set(["rata:d1:2026-10-12"]);
    expect(findDeadlineAlerts({ due: [due("2026-10-12")], alreadySent: sent, now: NOW })).toEqual([]);
    expect(findDeadlineAlerts({ due: [due("2026-10-12"), due("2026-10-12", "d2")], alreadySent: sent, now: NOW })).toHaveLength(1);
  });
});
