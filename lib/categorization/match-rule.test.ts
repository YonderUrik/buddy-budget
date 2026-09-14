import { describe, expect, it } from "vitest";
import { isDirectionCompatible, selectMatchingRule, type RuleCandidate } from "./match-rule";

function makeRule(overrides: Partial<RuleCandidate> = {}): RuleCandidate {
  return {
    id: "rule-1",
    matchType: "merchant",
    pattern: "esselunga via roma",
    categoryId: "cat-spesa",
    categoryType: "variabile",
    categoryIsFallback: false,
    splitPercentage: null,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("isDirectionCompatible", () => {
  it("accetta una categoria entrata su una transazione in entrata", () => {
    expect(isDirectionCompatible("entrata", true, false)).toBe(true);
  });

  it("rifiuta una categoria entrata su una transazione in uscita", () => {
    expect(isDirectionCompatible("entrata", false, false)).toBe(false);
  });

  it("rifiuta una categoria di spesa su una transazione in entrata", () => {
    expect(isDirectionCompatible("variabile", true, false)).toBe(false);
  });

  it("accetta la categoria fallback in entrambe le direzioni", () => {
    expect(isDirectionCompatible("variabile", true, true)).toBe(true);
    expect(isDirectionCompatible("entrata", false, true)).toBe(true);
  });
});

describe("selectMatchingRule", () => {
  it("ritorna null senza regole", () => {
    expect(selectMatchingRule("esselunga via roma", false, [])).toBeNull();
  });

  it("trova la regola merchant sulla chiave esatta", () => {
    const rule = makeRule();
    expect(selectMatchingRule("esselunga via roma", false, [rule])).toBe(rule);
  });

  it("non applica una regola merchant a una chiave diversa", () => {
    expect(selectMatchingRule("esselunga via milano", false, [makeRule()])).toBeNull();
  });

  it("preferisce la regola merchant esatta a una contains che pure matcherebbe", () => {
    const exact = makeRule({ id: "exact" });
    const contains = makeRule({ id: "contains", matchType: "contains", pattern: "esselunga" });
    expect(selectMatchingRule("esselunga via roma", false, [contains, exact])?.id).toBe("exact");
  });

  it("applica una regola contains come sottostringa della chiave", () => {
    const contains = makeRule({ id: "c", matchType: "contains", pattern: "esselunga" });
    expect(selectMatchingRule("esselunga via milano", false, [contains])?.id).toBe("c");
  });

  it("fra più contains vince il pattern più lungo, cioè il più specifico", () => {
    const generic = makeRule({ id: "generic", matchType: "contains", pattern: "amazon" });
    const specific = makeRule({ id: "specific", matchType: "contains", pattern: "amazon prime" });
    expect(selectMatchingRule("amazon prime video", false, [generic, specific])?.id).toBe("specific");
  });

  it("a pari lunghezza di pattern contains vince la regola più recente", () => {
    const older = makeRule({ id: "older", matchType: "contains", pattern: "conad", createdAt: new Date("2026-01-01") });
    const newer = makeRule({ id: "newer", matchType: "contains", pattern: "metro", createdAt: new Date("2026-05-01") });
    expect(selectMatchingRule("metro conad", false, [older, newer])?.id).toBe("newer");
  });

  it("ignora una regola merchant incompatibile con la direzione", () => {
    const income = makeRule({ categoryType: "entrata" });
    expect(selectMatchingRule("esselunga via roma", false, [income])).toBeNull();
  });

  it("prosegue sulla regola contains compatibile quando la merchant esatta è incompatibile", () => {
    const wrongDirection = makeRule({ id: "wrong", categoryType: "entrata" });
    const usable = makeRule({ id: "usable", matchType: "contains", pattern: "esselunga" });
    expect(selectMatchingRule("esselunga via roma", false, [wrongDirection, usable])?.id).toBe("usable");
  });

  it("applica una regola contains che coincide con l'intera chiave", () => {
    const rule = makeRule({ matchType: "contains", pattern: "netflix" });
    expect(selectMatchingRule("netflix", false, [rule])?.id).toBe("rule-1");
  });
});
