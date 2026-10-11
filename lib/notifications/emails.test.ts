import { describe, expect, it } from "vitest";
import { budgetAlertEmail, deadlineAlertEmail, digestEmail, type EmailContext } from "./emails";
import { digestPeriod, type DigestData } from "./digest";

const ctx: EmailContext = {
  appUrl: "https://app.test",
  money: (v) => `${v.toFixed(2).replace(".", ",")} €`,
  unsubscribeUrl: "https://app.test/disiscrizione?t=TOKEN",
  preferencesUrl: "https://app.test/impostazioni?sezione=notifiche#impostazioni-notifiche",
};
const data: DigestData = {
  period: digestPeriod("mensile", new Date("2026-10-02T07:00:00Z")),
  spent: 1234.5,
  income: 2000,
  previousSpent: 1100,
  topCategories: [{ name: "Spesa alimentare", amount: 320 }],
  budget: { total: 4, over: 1 },
  movements: 40,
  investments: null,
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
  const investments = { endValue: 25000, gain: 312.4, twr: 0.0126, income: 48, netContributions: 500 };

  it("in una frase spese ed entrate, poi la Liquidità in poche righe", () => {
    const { text } = digestEmail(data, ctx);
    expect(text).toContain("A settembre hai speso 1234,50 € e incassato 2000,00 €.");
    expect(text).toContain("Liquidità\nEntrate: 2000,00 €\nUscite: 1234,50 €\nMessi da parte: 765,50 €");
    expect(text).toContain("Uscite rispetto al mese prima: +12%");
    expect(text).toContain("Voce più pesante: Spesa alimentare · 320,00 €");
    expect(text).toContain("Budget superati: 1 su 4");
    expect(text).not.toContain("Investimenti");
  });

  it("se hai speso più di quanto hai incassato lo dice senza numeri negativi", () => {
    const { text } = digestEmail({ ...data, income: 1000 }, ctx);
    expect(text).toContain("Speso più delle entrate: 234,50 €");
  });

  it("aggiunge gli investimenti: guadagno, rendimento, dividendi e versamenti", () => {
    const { text, html } = digestEmail({ ...data, investments }, ctx);
    expect(text).toContain("I tuoi investimenti hanno guadagnato 312,40 €, di cui 48,00 € di dividendi e cedole.");
    expect(text).toContain("Investimenti\nValore a fine periodo: 25000,00 €\nGuadagno del periodo: +312,40 € (+1,3%)\nDividendi e cedole: 48,00 €\nInvestiti nel periodo: 500,00 €");
    expect(html).toContain(">Investimenti</div>");
  });

  it("una perdita si dice come tale, senza dividendi né versamenti se non ci sono", () => {
    const { text } = digestEmail({ ...data, investments: { ...investments, gain: -120, twr: -0.005, income: 0, netContributions: 0 } }, ctx);
    expect(text).toContain("I tuoi investimenti hanno perso 120,00 €.");
    expect(text).toContain("Guadagno del periodo: -120,00 € (-0,5%)");
    expect(text).not.toContain("Dividendi e cedole");
    expect(text).not.toContain("nel periodo:");
  });

  it("senza movimenti sui conti parla solo degli investimenti", () => {
    const { text } = digestEmail({ ...data, movements: 0, investments }, ctx);
    expect(text).toContain("A settembre non hai movimenti sui conti.");
    expect(text).not.toContain("Liquidità");
  });

  it("con «nascondi importi» non svela il segno del guadagno", () => {
    const { text } = digestEmail({ ...data, investments }, { ...ctx, money: () => "••••" });
    expect(text).toContain("Guadagno del periodo: •••• (+1,3%)");
  });

  it("non dà consigli di investimento né raccomandazioni", () => {
    expect(digestEmail({ ...data, investments }, ctx).text).not.toMatch(/dovresti|ti consigliamo|ti suggeriamo|conviene/i);
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
