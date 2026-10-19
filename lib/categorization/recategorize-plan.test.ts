import { describe, expect, it } from "vitest";
import { planRecategorize, type RecategorizeInput, type RecategorizeRow } from "./recategorize-plan";

const categories = [
  { id: "fallback", type: "voluta" as const, isFallback: true },
  { id: "spesa", type: "dovuta" as const, isFallback: false },
  { id: "casa", type: "dovuta" as const, isFallback: false },
  { id: "giroconti", type: "trasferimento" as const, isFallback: false },
];

let seq = 0;
function row(overrides: Partial<RecategorizeRow>): RecategorizeRow {
  seq += 1;
  return {
    id: `t${seq}`,
    description: "Esselunga",
    rawDescription: null,
    amount: -20,
    excludedAmount: 0,
    date: `2026-09-${String(seq).padStart(2, "0")}`,
    categoryId: "spesa",
    categorySource: "regola",
    ...overrides,
  };
}

function input(rows: RecategorizeRow[], overrides: Partial<RecategorizeInput> = {}): RecategorizeInput {
  return {
    rows,
    categories,
    rules: [{ id: "r1", pattern: "esselunga", categoryId: "casa", splitPercentage: null }],
    resolveRule: ({ description }) => (description.toLowerCase().includes("esselunga") ? { categoryId: "casa", ruleId: "r1" } : null),
    storedAssistant: new Map(),
    autoApply: true,
    assistantConsent: false,
    scope: { kind: "tutto", includeLegacy: false },
    ...overrides,
  };
}

describe("planRecategorize", () => {
  it("sposta nella categoria della regola i movimenti messi da soli in un'altra", () => {
    const rows = [row({}), row({ categorySource: "storico" }), row({ categoryId: "casa" })];
    const plan = planRecategorize(input(rows));
    expect(plan.changes).toBe(2);
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0]).toMatchObject({ fromCategoryId: "spesa", toCategoryId: "casa", source: "regola", ruleId: "r1", percentage: 0, legacyCount: 0 });
  });

  it("non tocca mai le scelte dell'utente né i movimenti da categorizzare", () => {
    const plan = planRecategorize(input([row({ categorySource: "utente" }), row({ categoryId: "fallback", categorySource: null })]));
    expect(plan.changes).toBe(0);
  });

  it("include i movimenti di prima dell'origine solo se richiesto, e mai quelli divisi a mano", () => {
    const rows = [row({ categorySource: null }), row({ categorySource: null, excludedAmount: -5 })];
    expect(planRecategorize(input(rows)).changes).toBe(0);
    const plan = planRecategorize(input(rows, { scope: { kind: "tutto", includeLegacy: true } }));
    expect(plan.changes).toBe(1);
    expect(plan.legacyChanges).toBe(1);
  });

  it("con una regola sola guarda solo i movimenti che prende quella regola, anche i più vecchi", () => {
    const rows = [row({ categorySource: null }), row({ description: "Coop", categorySource: "regola" })];
    const plan = planRecategorize(
      input(rows, {
        scope: { kind: "regola", ruleId: "r1" },
        resolveRule: ({ description }) =>
          description === "Esselunga" ? { categoryId: "casa", ruleId: "r1" } : { categoryId: "casa", ruleId: "r2" },
      })
    );
    expect(plan.changes).toBe(1);
    expect(plan.groups[0].transactionIds).toEqual([rows[0].id]);
  });

  it("changes a category taken from the bank only through a rule, never through a proposal", () => {
    const chosen = [1, 2, 3].map(() => row({ description: "Bar Roma", categoryId: "casa", categorySource: "utente" }));
    const fromBank = row({ description: "Bar Roma", categoryId: "spesa", categorySource: "banca" });
    expect(planRecategorize(input([...chosen, fromBank], { resolveRule: () => null })).changes).toBe(0);
    const byRule = planRecategorize(input([row({ categorySource: "banca" })]));
    expect(byRule.groups[0]).toMatchObject({ toCategoryId: "casa", source: "regola" });
  });

  it("usa le scelte dell'utente come prove, solo con l'applicazione automatica attiva", () => {
    const chosen = [1, 2, 3].map(() => row({ description: "Bar Roma", categoryId: "casa", categorySource: "utente" }));
    const auto = row({ description: "Bar Roma", categoryId: "spesa", categorySource: "storico" });
    const noRule = { resolveRule: () => null };
    const plan = planRecategorize(input([...chosen, auto], noRule));
    expect(plan.groups).toEqual([expect.objectContaining({ toCategoryId: "casa", source: "storico", transactionIds: [auto.id] })]);
    expect(planRecategorize(input([...chosen, auto], { ...noRule, autoApply: false })).changes).toBe(0);
  });

  it("esclude per intero gli importi che finiscono nei trasferimenti", () => {
    const plan = planRecategorize(input([row({})], { resolveRule: () => ({ categoryId: "giroconti", ruleId: "r9" }) }));
    expect(plan.groups[0]).toMatchObject({ toCategoryId: "giroconti", percentage: 1 });
  });
});
