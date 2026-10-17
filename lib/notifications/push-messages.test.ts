import { describe, expect, it } from "vitest";
import { budgetAlertPush, deadlineAlertPush, digestPush, goalsPush } from "./push-messages";

const budget = (name: string, threshold: number) => ({ categoryId: name, name, threshold, spent: 812.4, budget: 800, itemKeys: [], itemKey: name });
const due = (name: string, date: string, overdue = false) => ({ debtId: name, name, date, amount: 650.12, overdue, itemKey: name });

describe("push messages", () => {
  it("never carry amounts", () => {
    const texts = [
      budgetAlertPush([budget("Spesa", 100)]),
      deadlineAlertPush([due("Mutuo", "2026-10-20")]),
    ].map((m) => `${m.title} ${m.body}`);
    for (const text of texts) expect(text).not.toMatch(/812|650|€/);
  });

  it("name the single item or count several", () => {
    expect(budgetAlertPush([budget("Spesa", 80)]).body).toBe("Spesa: hai usato l'80% del budget del mese.");
    expect(budgetAlertPush([budget("Spesa", 100), budget("Casa", 80)]).body).toBe("2 categorie sono vicine o oltre il budget del mese.");
    expect(deadlineAlertPush([due("Mutuo", "2026-10-20")])).toMatchObject({ title: "Rata in arrivo", path: "/debiti/finanziamenti" });
    expect(deadlineAlertPush([due("Mutuo", "2026-10-01", true)]).title).toBe("Rata scaduta");
  });

  it("opens the goals view and the overview", () => {
    expect(goalsPush({ alerts: [], reminder: null, keys: [] }).path).toBe("/analitiche/obiettivi?da=notifica");
    expect(digestPush({ period: "mese", key: "k", label: "Settembre 2026", referenceDate: new Date() }).body).toContain("di settembre 2026");
  });
});
