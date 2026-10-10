import { describe, expect, it } from "vitest";
import { budgetAlertEmail, deadlineAlertEmail, digestEmail, type EmailContext } from "./emails";
import { digestPeriod, type DigestData } from "./digest";

const ctx: EmailContext = {
  appUrl: "https://app.test",
  money: (v) => `${v.toFixed(2).replace(".", ",")} €`,
  unsubscribeUrl: "https://app.test/disiscrizione?t=TOKEN",
  preferencesUrl: "https://app.test/impostazioni#impostazioni-notifiche",
};
const data: DigestData = {
  period: digestPeriod("mensile", new Date("2026-10-02T07:00:00Z")),
  spent: 1234.5,
  income: 2000,
  previousSpent: 1100,
  topCategories: [{ name: "Spesa alimentare", amount: 320 }],
  budget: { total: 4, over: 1 },
  movements: 40,
};

describe("email: ogni email opzionale porta la disiscrizione", () => {
  const emails = {
    digest: digestEmail(data, ctx),
    budget: budgetAlertEmail([{ categoryId: "c", name: "Cibo", threshold: 100, spent: 310, budget: 300, itemKey: "k", itemKeys: ["k"] }], ctx),
    deadlines: deadlineAlertEmail([{ debtId: "d", name: "Mutuo", date: "2026-10-12", amount: 600, overdue: false, itemKey: "k" }], ctx),
  };

  for (const [kind, email] of Object.entries(emails)) {
    it(`${kind}: link di disiscrizione e preferenze in HTML e in testo`, () => {
      expect(email.html).toContain('href="https://app.test/disiscrizione?t=TOKEN"');
      expect(email.html).toContain("Gestisci le preferenze");
      expect(email.text).toContain("Disattiva queste email: https://app.test/disiscrizione?t=TOKEN");
    });

    it(`${kind}: nessuna cifra nell'oggetto`, () => {
      expect(email.subject).not.toMatch(/\d/);
    });
  }
});

describe("digestEmail", () => {
  it("racconta spese, entrate, confronto e budget con le cifre dell'app", () => {
    const { text } = digestEmail(data, ctx);
    expect(text).toContain("A settembre 2026 hai speso 1234,50 € e incassato 2000,00 €.");
    expect(text).toContain("Ti sono rimasti 765,50 €.");
    expect(text).toContain("12% più alte");
    expect(text).toContain("Hai superato il budget in 1 categoria su 4.");
    expect(text).toContain("Spesa alimentare: 320,00 €");
  });

  it("se hai speso più di quanto hai incassato lo dice senza numeri negativi", () => {
    const { text } = digestEmail({ ...data, income: 1000 }, ctx);
    expect(text).toContain("Hai speso 234,50 € più di quanto hai incassato.");
  });

  it("non dà consigli di investimento né raccomandazioni", () => {
    expect(digestEmail(data, ctx).text).not.toMatch(/dovresti|ti consigliamo|investi/i);
  });
});

describe("budgetAlertEmail e deadlineAlertEmail", () => {
  it("più categorie in un'unica email, con la percentuale", () => {
    const alert = (name: string, spent: number) => ({ categoryId: name, name, threshold: 80, spent, budget: 100, itemKey: name, itemKeys: [name] });
    const { text } = budgetAlertEmail([alert("Cibo", 85), alert("Svago", 90)], ctx);
    expect(text).toContain("2 categorie");
    expect(text).toContain("Cibo: 85%");
  });

  it("una rata scaduta cambia oggetto e frase", () => {
    const email = deadlineAlertEmail([{ debtId: "d", name: "Mutuo", date: "2026-10-01", amount: 600, overdue: true, itemKey: "k" }], ctx);
    expect(email.subject).toBe("Hai una rata scaduta");
    expect(email.text).toContain("scaduta il");
  });
});
