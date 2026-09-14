import { describe, expect, it } from "vitest";
import { computeSuggestions, groupByMerchant, type SuggestTransaction } from "./suggest";

function makeTx(overrides: Partial<SuggestTransaction> = {}): SuggestTransaction {
  return {
    id: "tx-1",
    description: "ESSELUNGA VIA ROMA",
    amount: -30,
    excludedAmount: 0,
    date: "2026-03-01",
    categoryId: "cat-fallback",
    ...overrides,
  };
}

const spesa = { id: "cat-spesa", type: "variabile" as const, isFallback: false };
const stipendio = { id: "cat-stipendio", type: "entrata" as const, isFallback: false };
const fallback = { id: "cat-fallback", type: "variabile" as const, isFallback: true };

describe("computeSuggestions", () => {
  it("non propone nulla senza regole né storico", () => {
    expect(
      computeSuggestions({ uncategorized: [makeTx()], rules: [], history: [], categories: [spesa, fallback] })
    ).toEqual([]);
  });

  it("propone dalla regola simile con motivo e confidenza pari alla similarità", () => {
    const result = computeSuggestions({
      uncategorized: [makeTx({ description: "ESSELUNGA VIA MILANO" })],
      rules: [{ id: "r1", pattern: "esselunga via roma", categoryId: "cat-spesa", splitPercentage: null }],
      history: [],
      categories: [spesa, fallback],
    });
    expect(result[0].source).toBe("regola");
    expect(result[0].suggestedCategoryId).toBe("cat-spesa");
    expect(result[0].confidence).toBeCloseTo(2 / 4);
    expect(result[0].reason).toContain("esselunga via roma");
  });

  it("propone dallo storico quando nessuna regola è simile", () => {
    const result = computeSuggestions({
      uncategorized: [makeTx()],
      rules: [],
      history: [makeTx({ id: "h1", categoryId: "cat-spesa" }), makeTx({ id: "h2", categoryId: "cat-spesa" })],
      categories: [spesa, fallback],
    });
    expect(result[0].source).toBe("storico");
    expect(result[0].suggestedCategoryId).toBe("cat-spesa");
    expect(result[0].reason).toContain("2");
  });

  it("preferisce la regola simile allo storico sulla stessa transazione", () => {
    const result = computeSuggestions({
      uncategorized: [makeTx()],
      rules: [{ id: "r1", pattern: "esselunga via roma", categoryId: "cat-spesa", splitPercentage: null }],
      history: [makeTx({ id: "h1", categoryId: "cat-altro" })],
      categories: [spesa, fallback, { id: "cat-altro", type: "variabile", isFallback: false }],
    });
    expect(result[0].source).toBe("regola");
  });

  it("non propone una categoria entrata per una spesa", () => {
    const result = computeSuggestions({
      uncategorized: [makeTx({ description: "ACME SRL", amount: -50 })],
      rules: [{ id: "r1", pattern: "acme", categoryId: "cat-stipendio", splitPercentage: null }],
      history: [],
      categories: [stipendio, fallback],
    });
    expect(result).toEqual([]);
  });

  it("propone lo split solo se coerente su tutte le transazioni della categoria vincente", () => {
    const coerente = computeSuggestions({
      uncategorized: [makeTx({ description: "AFFITTO", amount: -100 })],
      rules: [],
      history: [
        makeTx({ id: "h1", description: "AFFITTO", amount: -100, excludedAmount: -50, categoryId: "cat-spesa" }),
        makeTx({ id: "h2", description: "AFFITTO", amount: -200, excludedAmount: -100, categoryId: "cat-spesa" }),
      ],
      categories: [spesa, fallback],
    });
    expect(coerente[0].suggestedSplitPercentage).toBe(0.5);
  });

  it("ignora lo storico ancora sulla categoria fallback", () => {
    const result = computeSuggestions({
      uncategorized: [makeTx()],
      rules: [],
      history: [makeTx({ id: "h1", categoryId: "cat-fallback" })],
      categories: [spesa, fallback],
    });
    expect(result).toEqual([]);
  });
});

describe("groupByMerchant", () => {
  it("raccoglie le transazioni con la stessa chiave in un gruppo solo", () => {
    const transactions = [
      makeTx({ id: "t1", description: "PAGAMENTO POS ESSELUNGA VIA ROMA 111", amount: -10 }),
      makeTx({ id: "t2", description: "ESSELUNGA VIA ROMA", amount: -20 }),
    ];
    const groups = groupByMerchant(transactions, []);
    expect(groups).toHaveLength(1);
    expect(groups[0].transactionIds).toEqual(["t1", "t2"]);
    expect(groups[0].totalAmount).toBe(-30);
  });

  it("usa come etichetta la descrizione della transazione più recente del gruppo", () => {
    const groups = groupByMerchant(
      [
        makeTx({ id: "t1", description: "ESSELUNGA VIA ROMA", date: "2026-01-01" }),
        makeTx({ id: "t2", description: "Esselunga Via Roma 22", date: "2026-05-01" }),
      ],
      []
    );
    expect(groups[0].label).toBe("Esselunga Via Roma 22");
  });

  it("assegna al gruppo la proposta della sorgente più alta in cascata", () => {
    const transactions = [makeTx({ id: "t1" }), makeTx({ id: "t2" })];
    const groups = groupByMerchant(transactions, [
      { transactionId: "t1", merchantKey: "esselunga via roma", suggestedCategoryId: "cat-a", source: "storico", confidence: 0.6, reason: "", suggestedSplitPercentage: null },
      { transactionId: "t2", merchantKey: "esselunga via roma", suggestedCategoryId: "cat-b", source: "regola", confidence: 0.9, reason: "", suggestedSplitPercentage: null },
    ]);
    expect(groups[0].suggestion?.suggestedCategoryId).toBe("cat-b");
  });

  it("segnala quando dentro un gruppo le proposte divergono di categoria", () => {
    const transactions = [makeTx({ id: "t1" }), makeTx({ id: "t2" })];
    const groups = groupByMerchant(transactions, [
      { transactionId: "t1", merchantKey: "esselunga via roma", suggestedCategoryId: "cat-a", source: "storico", confidence: 0.6, reason: "", suggestedSplitPercentage: null },
      { transactionId: "t2", merchantKey: "esselunga via roma", suggestedCategoryId: "cat-b", source: "storico", confidence: 0.7, reason: "", suggestedSplitPercentage: null },
    ]);
    expect(groups[0].hasDivergentSuggestions).toBe(true);
  });

  it("ordina i gruppi per numero di transazioni decrescente", () => {
    const groups = groupByMerchant(
      [
        makeTx({ id: "t1", description: "NETFLIX" }),
        makeTx({ id: "t2", description: "ESSELUNGA VIA ROMA" }),
        makeTx({ id: "t3", description: "ESSELUNGA VIA ROMA" }),
      ],
      []
    );
    expect(groups[0].merchantKey).toBe("esselunga via roma");
  });
});
