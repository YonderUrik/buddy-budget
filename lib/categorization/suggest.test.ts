import { describe, expect, it } from "vitest";
import {
  AUTO_APPLY_THRESHOLD,
  computeSuggestions,
  groupByMerchant,
  isAutoApplicable,
  isConfidentSuggestion,
  withAssistantSuggestions,
  type CategorizeSuggestion,
  type SuggestTransaction,
} from "./suggest";

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

const spesa = { id: "cat-spesa", type: "voluta" as const, isFallback: false };
const stipendio = { id: "cat-stipendio", type: "entrata" as const, isFallback: false };
const fallback = { id: "cat-fallback", type: "voluta" as const, isFallback: true };

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
      categories: [spesa, fallback, { id: "cat-altro", type: "voluta", isFallback: false }],
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

  it("non mescola nello stesso gruppo un acquisto e il suo rimborso dallo stesso merchant", () => {
    const groups = groupByMerchant(
      [
        makeTx({ id: "t1", description: "ESSELUNGA VIA ROMA", amount: -30 }),
        makeTx({ id: "t2", description: "ESSELUNGA VIA ROMA", amount: 30 }),
      ],
      []
    );
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.merchantKey === "esselunga via roma")).toBe(true);
    expect(new Set(groups.map((group) => group.groupKey)).size).toBe(2);
    expect(groups.map((group) => group.totalAmount).sort()).toEqual([-30, 30]);
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

function makeSuggestion(overrides: Partial<CategorizeSuggestion> = {}): CategorizeSuggestion {
  return {
    transactionId: "tx-1",
    merchantKey: "esselunga via roma",
    suggestedCategoryId: "cat-spesa",
    source: "storico",
    confidence: 1,
    reason: "",
    suggestedSplitPercentage: null,
    history: { agreeing: 3, total: 3 },
    ...overrides,
  };
}

describe("sicurezza delle proposte dallo storico", () => {
  it("vale quota d'accordo × somiglianza e riporta i movimenti d'accordo sul totale", () => {
    const [result] = computeSuggestions({
      uncategorized: [makeTx()],
      rules: [],
      history: [
        makeTx({ id: "h1", categoryId: "cat-spesa" }),
        makeTx({ id: "h2", categoryId: "cat-spesa" }),
        makeTx({ id: "h3", categoryId: "cat-spesa" }),
        makeTx({ id: "h4", categoryId: "cat-altro" }),
      ],
      categories: [spesa, fallback, { id: "cat-altro", type: "voluta", isFallback: false }],
    });
    expect(result.history).toEqual({ agreeing: 3, total: 4 });
    expect(result.confidence).toBeCloseTo(0.75);
  });

  it("con meno di 3 movimenti d'accordo la sicurezza scende in proporzione", () => {
    const [result] = computeSuggestions({
      uncategorized: [makeTx()],
      rules: [],
      history: [makeTx({ id: "h1", categoryId: "cat-spesa" }), makeTx({ id: "h2", categoryId: "cat-spesa" })],
      categories: [spesa, fallback],
    });
    expect(result.confidence).toBeCloseTo(0.67);
    expect(isConfidentSuggestion(result)).toBe(false);
  });

  it("preferisce uno storico sicuro a una regola solo vagamente simile", () => {
    const history = [1, 2, 3].map((n) => makeTx({ id: `h${n}`, categoryId: "cat-altro" }));
    const [result] = computeSuggestions({
      uncategorized: [makeTx()],
      rules: [{ id: "r1", pattern: "esselunga via milano", categoryId: "cat-spesa", splitPercentage: null }],
      history,
      categories: [spesa, fallback, { id: "cat-altro", type: "voluta", isFallback: false }],
    });
    expect(result.source).toBe("storico");
    expect(result.suggestedCategoryId).toBe("cat-altro");
  });
});

describe("isConfidentSuggestion", () => {
  it("sotto la soglia non è mai sicura", () => {
    expect(isConfidentSuggestion(makeSuggestion({ source: "assistente", confidence: AUTO_APPLY_THRESHOLD - 0.01 }))).toBe(false);
    expect(isConfidentSuggestion(makeSuggestion({ source: "assistente", confidence: AUTO_APPLY_THRESHOLD }))).toBe(true);
  });

  it("dallo storico servono almeno 3 movimenti d'accordo, anche al 100%", () => {
    expect(isConfidentSuggestion(makeSuggestion({ history: { agreeing: 2, total: 2 } }))).toBe(false);
    expect(isConfidentSuggestion(makeSuggestion({ history: { agreeing: 3, total: 3 } }))).toBe(true);
  });
});

describe("withAssistantSuggestions", () => {
  const group = groupByMerchant([makeTx()], [])[0];
  const groupKey = group.groupKey;

  it("riempie un gruppo senza proposta", () => {
    const [result] = withAssistantSuggestions([group], new Map([[groupKey, { categoryId: "cat-spesa", confidence: 0.6 }]]));
    expect(result.suggestion?.source).toBe("assistente");
    expect(result.suggestion?.confidence).toBe(0.6);
  });

  it("sostituisce una proposta incerta solo se quella dell'assistente è sicura", () => {
    const uncertain = { ...group, suggestion: makeSuggestion({ confidence: 0.5 }) };
    const [kept] = withAssistantSuggestions([uncertain], new Map([[groupKey, { categoryId: "cat-altro", confidence: 0.6 }]]));
    expect(kept.suggestion?.source).toBe("storico");
    const [replaced] = withAssistantSuggestions([uncertain], new Map([[groupKey, { categoryId: "cat-altro", confidence: 0.95 }]]));
    expect(replaced.suggestion?.source).toBe("assistente");
    expect(replaced.suggestion?.suggestedCategoryId).toBe("cat-altro");
  });

  it("non tocca una proposta già sicura", () => {
    const confident = { ...group, suggestion: makeSuggestion() };
    const [result] = withAssistantSuggestions([confident], new Map([[groupKey, { categoryId: "cat-altro", confidence: 0.99 }]]));
    expect(result.suggestion?.source).toBe("storico");
  });
});

describe("isAutoApplicable", () => {
  const group = groupByMerchant([makeTx()], [])[0];

  it("vuole una proposta sicura e coerente in tutto il gruppo", () => {
    expect(isAutoApplicable({ ...group, suggestion: null })).toBe(false);
    expect(isAutoApplicable({ ...group, suggestion: makeSuggestion({ confidence: 0.6 }) })).toBe(false);
    expect(isAutoApplicable({ ...group, suggestion: makeSuggestion(), hasDivergentSuggestions: true })).toBe(false);
    expect(isAutoApplicable({ ...group, suggestion: makeSuggestion() })).toBe(true);
  });
});
