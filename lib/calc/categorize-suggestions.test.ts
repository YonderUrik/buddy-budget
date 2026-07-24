import { describe, expect, it } from "vitest";
import { computeCategorizeSuggestions } from "./categorize-suggestions";
import type { Transaction } from "@/lib/db/schema/transactions";

let counter = 0;

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  counter += 1;
  return {
    id: overrides.id ?? `tx-${counter}`,
    userId: "user-1",
    accountId: "account-1",
    categoryId: "category-1",
    description: "Esselunga",
    amount: "-20.00",
    excludedAmount: "0.00",
    date: "2026-01-01",
    source: "manuale",
    externalId: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("computeCategorizeSuggestions", () => {
  it("esclude le transazioni senza nessun match storico per descrizione", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "Merchant sconosciuto" })];
    const historical = [makeTransaction({ id: "h1", description: "Esselunga", categoryId: "cat-food" })];

    expect(computeCategorizeSuggestions(uncategorized, historical)).toEqual([]);
  });

  it("suggerisce la categoria quando c'è un solo match, case-insensitive", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "ESSELUNGA" })];
    const historical = [
      makeTransaction({ id: "h1", description: "esselunga", categoryId: "cat-food", date: "2026-01-05" }),
    ];

    const result = computeCategorizeSuggestions(uncategorized, historical);
    expect(result).toHaveLength(1);
    expect(result[0].suggestedCategoryId).toBe("cat-food");
    expect(result[0].matchCount).toBe(1);
    expect(result[0].suggestedSplitPercentage).toBe(0);
    expect(result[0].averageSimilarity).toBe(1);
  });

  it("sceglie la categoria più frequente tra i match", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "Netflix" })];
    const historical = [
      makeTransaction({ id: "h1", description: "Netflix", categoryId: "cat-svago", date: "2026-01-01" }),
      makeTransaction({ id: "h2", description: "Netflix", categoryId: "cat-abbonamenti", date: "2026-02-01" }),
      makeTransaction({ id: "h3", description: "Netflix", categoryId: "cat-abbonamenti", date: "2026-03-01" }),
    ];

    const result = computeCategorizeSuggestions(uncategorized, historical);
    expect(result[0].suggestedCategoryId).toBe("cat-abbonamenti");
    expect(result[0].matchCount).toBe(2);
  });

  it("in caso di pareggio sceglie la categoria della transazione più recente", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "Amazon" })];
    const historical = [
      makeTransaction({ id: "h1", description: "Amazon", categoryId: "cat-a", date: "2026-01-01" }),
      makeTransaction({ id: "h2", description: "Amazon", categoryId: "cat-b", date: "2026-03-01" }),
    ];

    const result = computeCategorizeSuggestions(uncategorized, historical);
    expect(result[0].suggestedCategoryId).toBe("cat-b");
  });

  it("suggerisce la percentuale di split quando è coerente tra i match della categoria vincente", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "Affitto condiviso", amount: "-60.00" })];
    const historical = [
      makeTransaction({
        id: "h1",
        description: "Affitto condiviso",
        categoryId: "cat-casa",
        amount: "-100.00",
        excludedAmount: "-50.00",
      }),
      makeTransaction({
        id: "h2",
        description: "Affitto condiviso",
        categoryId: "cat-casa",
        amount: "-40.00",
        excludedAmount: "-20.00",
      }),
    ];

    const result = computeCategorizeSuggestions(uncategorized, historical);
    expect(result[0].suggestedSplitPercentage).toBe(0.5);
  });

  it("non suggerisce nessuna percentuale (null) quando lo split storico è incoerente", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "Affitto condiviso" })];
    const historical = [
      makeTransaction({
        id: "h1",
        description: "Affitto condiviso",
        categoryId: "cat-casa",
        amount: "-100.00",
        excludedAmount: "-50.00",
      }),
      makeTransaction({
        id: "h2",
        description: "Affitto condiviso",
        categoryId: "cat-casa",
        amount: "-100.00",
        excludedAmount: "-30.00",
      }),
    ];

    const result = computeCategorizeSuggestions(uncategorized, historical);
    expect(result[0].suggestedSplitPercentage).toBeNull();
  });

  it("riconosce come simile un suffisso/codice numerico variabile, scartandolo dal confronto", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "PAYPAL *NETFLIX 4471" })];
    const historical = [
      makeTransaction({ id: "h1", description: "PAYPAL *NETFLIX 8832", categoryId: "cat-svago" }),
    ];

    const result = computeCategorizeSuggestions(uncategorized, historical);
    expect(result).toHaveLength(1);
    expect(result[0].suggestedCategoryId).toBe("cat-svago");
    expect(result[0].averageSimilarity).toBe(1);
  });

  it("riconosce come simile una filiale diversa della stessa catena, esattamente alla soglia del 50%", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "ESSELUNGA VIA ROMA 12" })];
    const historical = [
      makeTransaction({ id: "h1", description: "ESSELUNGA VIA MILANO 45", categoryId: "cat-food" }),
    ];

    const result = computeCategorizeSuggestions(uncategorized, historical);
    expect(result).toHaveLength(1);
    expect(result[0].suggestedCategoryId).toBe("cat-food");
    expect(result[0].averageSimilarity).toBe(0.5);
  });

  it("esclude un match sotto la soglia del 50% (una sola parola in comune su cinque totali)", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "Ristorante Rossi Milano" })];
    const historical = [
      makeTransaction({ id: "h1", description: "Ristorante Bianchi Torino", categoryId: "cat-food" }),
    ];

    expect(computeCategorizeSuggestions(uncategorized, historical)).toEqual([]);
  });

  it("descrizione interamente numerica: ricade sull'uguaglianza esatta invece che su insiemi di token vuoti", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "123456789" })];
    const historicalMatch = [
      makeTransaction({ id: "h1", description: "123456789", categoryId: "cat-varie" }),
    ];
    const historicalNoMatch = [
      makeTransaction({ id: "h2", description: "987654321", categoryId: "cat-varie" }),
    ];

    const matchResult = computeCategorizeSuggestions(uncategorized, historicalMatch);
    expect(matchResult).toHaveLength(1);
    expect(matchResult[0].averageSimilarity).toBe(1);

    expect(computeCategorizeSuggestions(uncategorized, historicalNoMatch)).toEqual([]);
  });

  it("calcola averageSimilarity come media dei soli match della categoria vincente", () => {
    const uncategorized = [makeTransaction({ id: "u1", description: "Esselunga Via Torino 9" })];
    const historical = [
      makeTransaction({ id: "h1", description: "Esselunga Via Torino 9", categoryId: "cat-food" }),
      makeTransaction({ id: "h2", description: "Esselunga Via Napoli 3", categoryId: "cat-food" }),
    ];

    const result = computeCategorizeSuggestions(uncategorized, historical);
    expect(result[0].matchCount).toBe(2);
    expect(result[0].averageSimilarity).toBe(0.75);
  });
});
