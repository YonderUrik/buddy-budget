import { describe, expect, it } from "vitest";
import { countExampleRows, directionOf, groupForModel, pickExamples } from "./groups";

const row = (id: string, description: string, amount: number, rawDescription: string | null = null) => ({
  id,
  description,
  rawDescription,
  mcc: null,
  amount,
});

describe("groupForModel", () => {
  it("raggruppa per esercente e direzione", () => {
    const groups = groupForModel([
      row("1", "Esselunga", -10),
      row("2", "ESSELUNGA", -20),
      row("3", "Esselunga", 5),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.direction === "uscita")?.transactionIds).toEqual(["1", "2"]);
    expect(groups.find((g) => g.direction === "entrata")?.transactionIds).toEqual(["3"]);
  });

  it("segna come bloccati i trasferimenti", () => {
    const [group] = groupForModel([row("1", "Bonifico a favore di Qualcuno", -50)]);
    expect(group.blocked).toBe("operazione");
  });

  it("usa il testo grezzo della banca per riconoscere un pagamento con carta", () => {
    const [group] = groupForModel([
      row("1", "Rossi Mario", -9, "ROSSI MARIO TORINO IT Carta N. ***** 249 Data operazione 01/02/25"),
    ]);
    expect(group.blocked).toBeNull();
  });
});

describe("directionOf", () => {
  it("distingue entrate e uscite", () => {
    expect(directionOf(1)).toBe("entrata");
    expect(directionOf(-1)).toBe("uscita");
  });
});

describe("pickExamples", () => {
  it("prende al massimo due esempi per categoria, dai più frequenti, e salta i bloccati", () => {
    const names = new Map([["c1", "Spesa"], ["c2", "Casa"]]);
    const examples = pickExamples(
      [
        { description: "Coop", rawDescription: null, categoryId: "c1", count: 9 },
        { description: "Conad", rawDescription: null, categoryId: "c1", count: 8 },
        { description: "Lidl", rawDescription: null, categoryId: "c1", count: 7 },
        { description: "Bonifico affitto", rawDescription: null, categoryId: "c2", count: 6 },
        { description: "Ikea", rawDescription: null, categoryId: "c2", count: 5 },
      ],
      names
    );
    expect(examples.map((e) => e.category)).toEqual(["Spesa", "Spesa", "Casa"]);
    expect(examples.map((e) => e.name)).toEqual(["Coop", "Conad", "IKEA"]);
  });
});

describe("countExampleRows", () => {
  it("conta le righe uguali e ordina per frequenza", () => {
    const rows = [
      { description: "Esselunga", rawDescription: null, categoryId: "spesa" },
      { description: "Netflix", rawDescription: null, categoryId: "svago" },
      { description: "Esselunga", rawDescription: null, categoryId: "spesa" },
      { description: "Esselunga", rawDescription: "POS ESSELUNGA", categoryId: "spesa" },
    ];
    expect(countExampleRows(rows)).toEqual([
      { description: "Esselunga", rawDescription: null, categoryId: "spesa", count: 2 },
      { description: "Netflix", rawDescription: null, categoryId: "svago", count: 1 },
      { description: "Esselunga", rawDescription: "POS ESSELUNGA", categoryId: "spesa", count: 1 },
    ]);
  });

  it("rispetta il limite", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ description: `m${i}`, rawDescription: null, categoryId: "c" }));
    expect(countExampleRows(rows, 3)).toHaveLength(3);
  });
});
