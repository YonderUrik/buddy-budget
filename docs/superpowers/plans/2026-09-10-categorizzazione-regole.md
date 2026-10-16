# Rule-based automatic categorization — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the exact match at import time and the one-by-one wizard with a system of merchant rules learned from the user's confirmations, inspectable and editable, alongside suggestions that are never auto-applied and an optional local assistant layer.

**Architecture:** A normalized merchant key (bank noise and company suffixes removed) is the unit everything revolves around. Rules (exact `merchant` or `contains`) apply on their own at import time; everything the system infers (similarity, LLM) stays a suggestion until the user applies it, and applying creates the rule. The LLM layer is isolated behind an interface and absent by default.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM + Postgres, Zod, TanStack Query, vitest, shadcn/ui on `@base-ui/react`, Ollama (optional, via HTTP).

**Spec:** `docs/superpowers/specs/2026-09-10-categorizzazione-regole-design.md`

## Global Constraints

- **The system never applies what it infers.** Only rules (created or confirmed by the user) write on their own. Similarity and LLM produce suggestions only.
- **No connected model is a normal state, not a failure.** Without `OLLAMA_BASE_URL` the assistant layer does not exist: no error, no alarm log, no warning in the UI. The app must never degrade below the purely deterministic behavior.
- **Direction guard mandatory everywhere** a category is chosen: an `entrata` (income) category only applies to positive amounts, a non-`entrata` category only to negative amounts. The fallback category (`isFallback`) accepts both signs. Same invariant already enforced by `PATCH /api/transactions/[id]`.
- **IDOR-safe ownership on every endpoint**: every `id` coming from the client must be checked against the session's `userId` before use, with the same pattern as `app/api/categories/[id]/route.ts`.
- **All user-visible strings in Italian.** No hardcoded hex colors or radii: only theme tokens.
- **One-line JSDoc** on every public function and component, as per `CLAUDE.md`.
- **Tests with vitest**, files next to the module (`nome.test.ts`), like `lib/calc/expenses.test.ts`.
- Frequent commits, one per task, in Italian, with a `feat:` / `fix:` / `test:` / `docs:` prefix.

## File structure

**New:**

| File | Responsibility |
|---|---|
| `lib/categorization/merchant-key.ts` | Description → merchant key normalization; tokenization for similarity |
| `lib/db/schema/categorization-rules.ts` | `categorization_rules` table + enums |
| `lib/categorization/match-rule.ts` | Selection of the winning rule (pure, no DB) |
| `lib/categorization/fallback.ts` | Fallback category resolved by the `isFallback` flag |
| `lib/categorization/resolve.ts` | Pipeline with DB access, used by the sync |
| `lib/categorization/suggest.ts` | Suggestion cascade + grouping by merchant |
| `lib/categorization/llm/index.ts` | `CategorySuggester` interface + `getSuggester()` |
| `lib/categorization/llm/ollama.ts` | Ollama implementation |
| `lib/validation/categorization-rules.ts` | Zod schemas for rules and batch apply |
| `lib/queries/categorization.ts` | TanStack hooks for suggestions, apply and rules |
| `lib/db/backfill-categorization-rules.ts` | One-shot initial population script |
| `app/api/transactions/categorize-apply/route.ts` | Atomic batch apply |
| `app/api/transactions/categorize-suggestions/ai/route.ts` | Assistant suggestions |
| `app/api/categorization-rules/route.ts` + `[id]/route.ts` | Rules CRUD |
| `app/(app)/categorizza/page.tsx` | Grouped review page |
| `components/domain/categorization/*` | Components of the review page and of rule management |

**Modified:** `lib/db/schema/index.ts`, `lib/gocardless/sync.ts`, `lib/gocardless/categorize.ts` (emptied/removed), `app/api/transactions/categorize-suggestions/route.ts`, `app/(app)/categorie/page.tsx`, `components/domain/expenses/auto-categorize-button.tsx`.

---

### Task 1: Normalized merchant key

**Files:**
- Create: `lib/categorization/merchant-key.ts`
- Test: `lib/categorization/merchant-key.test.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `merchantKey(description: string): string`, `merchantKeyTokens(key: string): Set<string>`, `jaccardSimilarity(a: Set<string>, b: Set<string>): number`, `MERCHANT_NOISE_TOKENS`, `COMPANY_SUFFIX_TOKENS`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/categorization/merchant-key.test.ts
import { describe, expect, it } from "vitest";
import { jaccardSimilarity, merchantKey, merchantKeyTokens } from "./merchant-key";

describe("merchantKey", () => {
  it("rimuove rumore bancario, suffissi societari e codici numerici", () => {
    expect(merchantKey("PAGAMENTO POS ESSELUNGA SPA VIA ROMA COD.4471")).toBe("esselunga via roma");
  });

  it("normalizza accenti e maiuscole", () => {
    expect(merchantKey("Caffè Città S.R.L.")).toBe("caffe citta");
  });

  it("collassa spazi e punteggiatura multipli", () => {
    expect(merchantKey("NETFLIX.COM   --  1234")).toBe("netflix com");
  });

  it("produce la stessa chiave per varianti societarie dello stesso merchant", () => {
    expect(merchantKey("ESSELUNGA SPA")).toBe(merchantKey("Esselunga S.p.A."));
  });

  it("ricade sulla descrizione normalizzata quando resta solo rumore", () => {
    expect(merchantKey("PAGAMENTO POS 4471")).toBe("pagamento pos 4471");
  });

  it("ricade sulla descrizione normalizzata quando la descrizione è solo numerica", () => {
    expect(merchantKey("  00998877  ")).toBe("00998877");
  });

  it("ritorna stringa vuota su descrizione vuota", () => {
    expect(merchantKey("   ")).toBe("");
  });
});

describe("merchantKeyTokens", () => {
  it("spezza la chiave in token", () => {
    expect(merchantKeyTokens("esselunga via roma")).toEqual(new Set(["esselunga", "via", "roma"]));
  });
});

describe("jaccardSimilarity", () => {
  it("è 1 su insiemi identici", () => {
    expect(jaccardSimilarity(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
  });

  it("è 0 su insiemi disgiunti", () => {
    expect(jaccardSimilarity(new Set(["a"]), new Set(["b"]))).toBe(0);
  });

  it("è intersezione su unione su insiemi parzialmente sovrapposti", () => {
    expect(jaccardSimilarity(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(1 / 3);
  });

  it("è 0 quando uno dei due insiemi è vuoto", () => {
    expect(jaccardSimilarity(new Set(), new Set(["a"]))).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm exec vitest run lib/categorization/merchant-key.test.ts`
Expected: FAIL — "Failed to resolve import ./merchant-key"

- [ ] **Step 3: Implement the module**

```ts
// lib/categorization/merchant-key.ts

/**
 * Bank noise tokens: words that appear in transaction descriptions without
 * identifying the merchant. Removing them is what stops "PAGAMENTO POS" from making
 * two completely unrelated merchants look similar.
 */
export const MERCHANT_NOISE_TOKENS: ReadonlySet<string> = new Set([
  "pagamento", "pagam", "pag", "pos", "carta", "cartasi", "acquisto", "addebito",
  "accredito", "bonifico", "sepa", "sdd", "rid", "rif", "cod", "codice", "operazione",
  "oper", "ricarica", "prelievo", "prelevamento", "bancomat", "contactless", "ecommerce",
  "internet", "online", "presso", "eur",
]);
// Deliberate note: articles and prepositions ("il", "del", "su") are NOT in this list.
// Removing them would merge distinct merchants — "IL FORNAIO" and "FORNAIO" would collapse onto the
// same key, and a rule learned on one would apply on its own to the other.

/** Company-form suffixes: they do not distinguish one merchant from another. */
export const COMPANY_SUFFIX_TOKENS: ReadonlySet<string> = new Set([
  "spa", "srl", "srls", "sas", "snc", "spa", "sp", "ltd", "limited", "inc", "llc",
  "bv", "nv", "gmbh", "ag", "sa", "plc", "co",
]);

/** Description lowercased, without diacritics, with punctuation replaced by spaces. */
function normalize(description: string): string {
  return description
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Stable key identifying a merchant from a transaction description:
 * removes diacritics, punctuation, purely numeric tokens, bank noise and company
 * suffixes. If nothing meaningful is left after cleaning (a description made only of noise
 * or only of numbers) it falls back to the normalized description, so as not to collapse different
 * movements onto a shared empty key.
 */
export function merchantKey(description: string): string {
  const normalized = normalize(description);
  if (normalized.length === 0) return "";

  const meaningful = normalized
    .split(" ")
    .filter((token) => token.length > 0)
    .filter((token) => !/^\d+$/.test(token))
    .filter((token) => !MERCHANT_NOISE_TOKENS.has(token))
    .filter((token) => !COMPANY_SUFFIX_TOKENS.has(token));

  return meaningful.length > 0 ? meaningful.join(" ") : normalized;
}

/** Set of tokens of a merchant key, for similarity comparison. */
export function merchantKeyTokens(key: string): Set<string> {
  return new Set(key.split(" ").filter((token) => token.length > 0));
}

/** Jaccard index between two token sets: |intersection| / |union|; 0 if either is empty. */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersectionSize = 0;
  for (const token of a) {
    if (b.has(token)) intersectionSize += 1;
  }
  const unionSize = a.size + b.size - intersectionSize;
  return intersectionSize / unionSize;
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm exec vitest run lib/categorization/merchant-key.test.ts`
Expected: PASS, 12 tests

- [ ] **Step 5: Commit**

```bash
git add lib/categorization/merchant-key.ts lib/categorization/merchant-key.test.ts
git commit -m "feat: chiave merchant normalizzata per la categorizzazione"
```

---

### Task 2: Rules table

**Files:**
- Create: `lib/db/schema/categorization-rules.ts`
- Modify: `lib/db/schema/index.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `categorizationRules`, `ruleMatchTypeEnum`, `ruleSourceEnum`, types `CategorizationRule` / `NewCategorizationRule`, constants `RULE_MATCH_TYPES` / `RULE_SOURCES`

- [ ] **Step 1: Create the schema**

```ts
// lib/db/schema/categorization-rules.ts
import { index, integer, numeric, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authUser } from "./auth";
import { categories } from "./categories";

export const RULE_MATCH_TYPES = ["merchant", "contains"] as const;
export const RULE_SOURCES = ["appresa", "manuale"] as const;

export const ruleMatchTypeEnum = pgEnum("rule_match_type", RULE_MATCH_TYPES);
export const ruleSourceEnum = pgEnum("rule_source", RULE_SOURCES);

/**
 * Categorization rule: maps a pattern (already normalized with `merchantKey`) to a
 * category. It is the only memory that writes on its own at import — it comes from an explicit
 * user confirmation (`appresa`, learned) or from the management page (`manuale`, manual), never from an inference.
 */
export const categorizationRules = pgTable(
  "categorization_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    matchType: ruleMatchTypeEnum("match_type").notNull(),
    // Pattern already normalized: compared with merchantKey(description), never with the raw text.
    pattern: text("pattern").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    // "Dividi" (split) share to propose again as a fraction of the amount (0-1); null = no split.
    splitPercentage: numeric("split_percentage", { precision: 5, scale: 4 }),
    source: ruleSourceEnum("source").notNull().default("appresa"),
    hitCount: integer("hit_count").notNull().default(0),
    lastAppliedAt: timestamp("last_applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("categorization_rules_user_type_pattern_unique").on(table.userId, table.matchType, table.pattern),
    index("categorization_rules_user_idx").on(table.userId),
  ]
);

export type CategorizationRule = typeof categorizationRules.$inferSelect;
export type NewCategorizationRule = typeof categorizationRules.$inferInsert;
```

- [ ] **Step 2: Export from the barrel**

In `lib/db/schema/index.ts`, add at the bottom:

```ts
export * from "./categorization-rules";
```

- [ ] **Step 3: Apply the schema to the database**

Run: `pnpm db:push`

Expected: the `categorization_rules` table and the two enums are created.

**If `db:push` fails** because of the already known pre-existing unique constraint (log of 2026-07-27): **stop and report to the controller instead of working around it with a direct `ALTER TABLE`.** A whole table is at stake here, not two columns: an unversioned fix would be lost at the next reset of the shared DB, exactly as happened to `raw_description`/`note`.

- [ ] **Step 4: Verify that the table really exists**

Run:
```bash
pnpm exec tsx --env-file=.env.local -e "import('./lib/db/client').then(async ({db}) => { const r = await db.execute(\"select column_name from information_schema.columns where table_name='categorization_rules'\"); console.log(r); process.exit(0); })"
```
Expected: list of the 10 columns. Do not trust the `db:push` output: verify it yourself.

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema/categorization-rules.ts lib/db/schema/index.ts
git commit -m "feat: tabella categorization_rules"
```

---

### Task 3: Selection of the winning rule (pure)

**Files:**
- Create: `lib/categorization/match-rule.ts`
- Test: `lib/categorization/match-rule.test.ts`

**Interfaces:**
- Consumes: `merchantKey` (Task 1)
- Produces: `RuleCandidate`, `selectMatchingRule(key: string, isIncome: boolean, rules: RuleCandidate[]): RuleCandidate | null`, `isDirectionCompatible(categoryType, isIncome, isFallback): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/categorization/match-rule.test.ts
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
    const newer = makeRule({ id: "newer", matchType: "contains", pattern: "coop", createdAt: new Date("2026-05-01") });
    expect(selectMatchingRule("coop conad", false, [older, newer])?.id).toBe("newer");
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
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm exec vitest run lib/categorization/match-rule.test.ts`
Expected: FAIL — "Failed to resolve import ./match-rule"

- [ ] **Step 3: Implement the module**

```ts
// lib/categorization/match-rule.ts

export interface RuleCandidate {
  id: string;
  matchType: "merchant" | "contains";
  pattern: string;
  categoryId: string;
  categoryType: "fissa" | "variabile" | "entrata";
  categoryIsFallback: boolean;
  splitPercentage: number | null;
  createdAt: Date;
}

/**
 * A category is usable for a transaction only if its direction matches: `entrata`
 * categories apply to positive amounts, the others to negative ones. The fallback category has no
 * direction of its own and accepts both signs — same invariant enforced by PATCH /api/transactions/[id].
 */
export function isDirectionCompatible(
  categoryType: "fissa" | "variabile" | "entrata",
  isIncome: boolean,
  isFallback: boolean
): boolean {
  if (isFallback) return true;
  return (categoryType === "entrata") === isIncome;
}

/**
 * Winning rule for a merchant key, evaluating first the `merchant` rules on an exact
 * match and then the `contains` ones as a substring (with several matches the longest pattern wins, i.e. the most
 * specific; at equal length the most recent rule). Rules incompatible with the transaction's
 * direction are skipped without stopping the evaluation. `null` if no rule applies.
 */
export function selectMatchingRule(
  key: string,
  isIncome: boolean,
  rules: RuleCandidate[]
): RuleCandidate | null {
  const usable = rules.filter((rule) =>
    isDirectionCompatible(rule.categoryType, isIncome, rule.categoryIsFallback)
  );

  const exact = usable.find((rule) => rule.matchType === "merchant" && rule.pattern === key);
  if (exact) return exact;

  const containsMatches = usable.filter(
    (rule) => rule.matchType === "contains" && rule.pattern.length > 0 && key.includes(rule.pattern)
  );
  if (containsMatches.length === 0) return null;

  return containsMatches.reduce((best, candidate) => {
    if (candidate.pattern.length !== best.pattern.length) {
      return candidate.pattern.length > best.pattern.length ? candidate : best;
    }
    return candidate.createdAt > best.createdAt ? candidate : best;
  });
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm exec vitest run lib/categorization/match-rule.test.ts`
Expected: PASS, 15 tests

- [ ] **Step 5: Commit**

```bash
git add lib/categorization/match-rule.ts lib/categorization/match-rule.test.ts
git commit -m "feat: selezione della regola di categorizzazione vincente"
```

---

### Task 4: Resolution pipeline and hooking into the sync

**Files:**
- Create: `lib/categorization/fallback.ts`, `lib/categorization/resolve.ts`
- Modify: `lib/gocardless/sync.ts:70` and `:83`, `lib/gocardless/categorize.ts` (removed), `lib/gocardless/categorize.test.ts` (removed)
- Test: `lib/categorization/resolve.test.ts`

**Interfaces:**
- Consumes: `merchantKey` (Task 1), `categorizationRules` (Task 2), `selectMatchingRule` / `RuleCandidate` (Task 3)
- Produces: `getFallbackCategoryId(userId: string): Promise<string>`, `resolveCategorization(userId: string, input: { description: string; amount: number }): Promise<ResolvedCategorization | null>` with `ResolvedCategorization = { categoryId: string; excludedAmount: number; ruleId: string }`

- [ ] **Step 1: Create the fallback module**

This closes the technical debt opened on 2026-07-21: the fallback is resolved by the `isFallback` flag, no longer by literal name.

```ts
// lib/categorization/fallback.ts
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";

export const FALLBACK_CATEGORY_NAME = "Da categorizzare";

/**
 * Id of the user's fallback category, resolved by the `isFallback` flag (not by name: the name
 * is only the default at creation). Created on the fly if it does not exist yet.
 */
export async function getFallbackCategoryId(userId: string): Promise<string> {
  const [existing] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.isFallback, true)));
  if (existing) return existing.id;

  const [created] = await db
    .insert(categories)
    .values({
      userId,
      name: FALLBACK_CATEGORY_NAME,
      type: "variabile",
      color: "red",
      icon: "help-circle",
      isFallback: true,
    })
    .returning();
  return created.id;
}
```

- [ ] **Step 2: Write the failing integration tests**

The tests touch the real DB, as `lib/gocardless/categorize.test.ts` already does. Read that file before writing, to reuse the same setup/teardown scheme (creation of the test user, categories and account, cleanup in `afterEach`).

```ts
// lib/categorization/resolve.test.ts — required structure, complete the setup following
// lib/gocardless/categorize.test.ts (creation of authUser + categories + cleanup)
import { describe, expect, it } from "vitest";
import { resolveCategorization } from "./resolve";

describe("resolveCategorization", () => {
  it("ritorna null quando l'utente non ha regole", async () => {
    // ... setup of a user without rules
    expect(await resolveCategorization(userId, { description: "ESSELUNGA VIA ROMA", amount: -30 })).toBeNull();
  });

  it("applica una regola merchant sulla chiave normalizzata, non sul testo grezzo", async () => {
    // rule: matchType "merchant", pattern "esselunga via roma", spending category
    const result = await resolveCategorization(userId, {
      description: "PAGAMENTO POS ESSELUNGA SPA VIA ROMA COD.4471",
      amount: -30,
    });
    expect(result?.categoryId).toBe(spesaCategoryId);
  });

  it("incrementa hitCount e aggiorna lastAppliedAt quando una regola vince", async () => {
    await resolveCategorization(userId, { description: "ESSELUNGA VIA ROMA", amount: -30 });
    // read the rule back from the DB
    expect(rule.hitCount).toBe(1);
    expect(rule.lastAppliedAt).not.toBeNull();
  });

  it("non applica una regola di categoria entrata a una spesa", async () => {
    // rule on an "entrata" category with pattern "stipendio acme"
    expect(await resolveCategorization(userId, { description: "STIPENDIO ACME", amount: -50 })).toBeNull();
  });

  it("deriva excludedAmount dallo splitPercentage della regola col segno dell'importo", async () => {
    // rule with splitPercentage 0.5 on a 30 expense
    const result = await resolveCategorization(userId, { description: "AFFITTO CASA", amount: -30 });
    expect(result?.excludedAmount).toBe(-15);
  });

  it("ritorna excludedAmount 0 quando la regola non ha splitPercentage", async () => {
    const result = await resolveCategorization(userId, { description: "ESSELUNGA VIA ROMA", amount: -30 });
    expect(result?.excludedAmount).toBe(0);
  });

  it("non vede le regole di un altro utente", async () => {
    // rule created on otherUserId with the same pattern
    expect(await resolveCategorization(userId, { description: "ESSELUNGA VIA ROMA", amount: -30 })).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests and verify they fail**

Run: `pnpm exec vitest run lib/categorization/resolve.test.ts`
Expected: FAIL — "Failed to resolve import ./resolve"

If the DB is not reachable (ECONNREFUSED), **stop and report it to the controller**: do not rewrite the tests to avoid the database.

- [ ] **Step 4: Implement the pipeline**

```ts
// lib/categorization/resolve.ts
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import { merchantKey } from "./merchant-key";
import { selectMatchingRule, type RuleCandidate } from "./match-rule";

export interface ResolvedCategorization {
  categoryId: string;
  excludedAmount: number;
  ruleId: string;
}

/** The user's rules with the category data needed by the direction guard. */
async function loadRuleCandidates(userId: string): Promise<RuleCandidate[]> {
  const rows = await db
    .select({
      id: categorizationRules.id,
      matchType: categorizationRules.matchType,
      pattern: categorizationRules.pattern,
      categoryId: categorizationRules.categoryId,
      categoryType: categories.type,
      categoryIsFallback: categories.isFallback,
      splitPercentage: categorizationRules.splitPercentage,
      createdAt: categorizationRules.createdAt,
    })
    .from(categorizationRules)
    .innerJoin(categories, eq(categorizationRules.categoryId, categories.id))
    .where(eq(categorizationRules.userId, userId));

  return rows.map((row) => ({
    ...row,
    splitPercentage: row.splitPercentage === null ? null : Number(row.splitPercentage),
  }));
}

export interface RuleResolver {
  /** Resolves a transaction in memory, without touching the DB. */
  resolve(input: { description: string; amount: number }): ResolvedCategorization | null;
  /** Ids of the rules that acted, in the order in which they won (with repetitions). */
  appliedRuleIds(): string[];
}

/**
 * Resolver that loads the user's rules **only once** and then works in memory: meant for
 * the import loop, where one query per transaction would degrade the sync linearly with the number of
 * movements. `hitCount` increments are not written here: they accumulate and are applied in a
 * single final update with `flushRuleHits`.
 */
export async function buildRuleResolver(userId: string): Promise<RuleResolver> {
  const rules = await loadRuleCandidates(userId);
  const applied: string[] = [];

  return {
    resolve(input) {
      if (rules.length === 0) return null;
      const rule = selectMatchingRule(merchantKey(input.description), input.amount > 0, rules);
      if (!rule) return null;

      applied.push(rule.id);
      const magnitude =
        rule.splitPercentage === null
          ? 0
          : Math.round(Math.abs(input.amount) * rule.splitPercentage * 100) / 100;

      return {
        categoryId: rule.categoryId,
        excludedAmount: input.amount >= 0 ? magnitude : -magnitude,
        ruleId: rule.id,
      };
    },
    appliedRuleIds: () => applied,
  };
}

/** Writes the usages accumulated during an import in a single update per rule. */
export async function flushRuleHits(ruleIds: string[]): Promise<void> {
  if (ruleIds.length === 0) return;
  const countById = new Map<string, number>();
  for (const id of ruleIds) countById.set(id, (countById.get(id) ?? 0) + 1);

  const now = new Date();
  for (const [id, count] of countById) {
    await db
      .update(categorizationRules)
      .set({ hitCount: sql`${categorizationRules.hitCount} + ${count}`, lastAppliedAt: now })
      .where(eq(categorizationRules.id, id));
  }
}

/**
 * Single-call variant, for contexts outside the import loop (a single transaction, tests).
 * Inside a loop always use `buildRuleResolver`: this function queries the DB on every call.
 */
export async function resolveCategorization(
  userId: string,
  input: { description: string; amount: number }
): Promise<ResolvedCategorization | null> {
  const resolver = await buildRuleResolver(userId);
  const resolved = resolver.resolve(input);
  await flushRuleHits(resolver.appliedRuleIds());
  return resolved;
}
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `pnpm exec vitest run lib/categorization/resolve.test.ts`
Expected: PASS

- [ ] **Step 6: Hook up the sync**

In `lib/gocardless/sync.ts`, replace the import on line 8:

```ts
import { getFallbackCategoryId } from "@/lib/categorization/fallback";
import { buildRuleResolver, flushRuleHits } from "@/lib/categorization/resolve";
```

Right after `const fallbackCategoryId = await getFallbackCategoryId(link.userId);` (line ~70, **before** the loop) build the resolver only once:

```ts
    const ruleResolver = await buildRuleResolver(link.userId);
```

In the loop, instead of `const categoryId = await resolveCategoryId(link.userId, description);`:

```ts
      const amount = Number(bankTransaction.transactionAmount.amount);
      const resolved = ruleResolver.resolve({ description, amount });
      const categoryId = resolved?.categoryId ?? fallbackCategoryId;
```

and in the object passed to `.values({...})` add, right after `amount`:

```ts
          excludedAmount: (resolved?.excludedAmount ?? 0).toFixed(2),
```

After the end of the loop, write the accumulated usages in bulk:

```ts
    await flushRuleHits(ruleResolver.appliedRuleIds());
```

**No queries inside the loop**: `fallbackCategoryId` and `ruleResolver` are both computed beforehand. A sync that queries the DB once per transaction degrades linearly with the number of movements — that is the problem the parallel plan `2026-09-10-gocardless-sync-performance.md` is solving, and this task must not reintroduce it.

- [ ] **Step 7: Delete the old module**

```bash
git rm lib/gocardless/categorize.ts lib/gocardless/categorize.test.ts
```

Then check that no other file imports it:

Run: `grep -rn "gocardless/categorize\|resolveCategoryId" --include=*.ts --include=*.tsx . | grep -v node_modules`
Expected: no results.

- [ ] **Step 8: Check the suite and the types**

Run: `pnpm tsc --noEmit && pnpm exec vitest run lib/categorization lib/gocardless`
Expected: tsc clean; the `lib/gocardless/scheduler.test.ts` tests may have 3 pre-existing, unrelated failures, already known from the log — everything else must pass.

- [ ] **Step 9: Commit**

```bash
git add -A lib/categorization lib/gocardless
git commit -m "feat: pipeline di categorizzazione a regole nel sync GoCardless"
```

---

### Task 5: Initial population of the rules

**Files:**
- Create: `lib/db/backfill-categorization-rules.ts`
- Test: `lib/db/backfill-categorization-rules.test.ts`

**Interfaces:**
- Consumes: `merchantKey` (Task 1), `categorizationRules` (Task 2)
- Produces: `buildRulesFromHistory(transactions, categoriesById): NewRuleSeed[]` (pure, testable without a DB) with `NewRuleSeed = { pattern: string; categoryId: string; splitPercentage: number | null }`, and `backfillCategorizationRules(userId): Promise<number>`

- [ ] **Step 1: Write the tests of the pure function**

```ts
// lib/db/backfill-categorization-rules.test.ts
import { describe, expect, it } from "vitest";
import { buildRulesFromHistory } from "./backfill-categorization-rules";

function makeTx(description: string, categoryId: string, date: string, amount = "-10.00", excludedAmount = "0.00") {
  return { description, categoryId, date, amount, excludedAmount };
}

describe("buildRulesFromHistory", () => {
  it("crea una regola per chiave merchant con la categoria più frequente", () => {
    const rules = buildRulesFromHistory([
      makeTx("ESSELUNGA VIA ROMA", "cat-spesa", "2026-01-01"),
      makeTx("PAGAMENTO POS ESSELUNGA VIA ROMA 998", "cat-spesa", "2026-02-01"),
      makeTx("ESSELUNGA VIA ROMA", "cat-altro", "2026-03-01"),
    ]);
    expect(rules).toEqual([{ pattern: "esselunga via roma", categoryId: "cat-spesa", splitPercentage: null }]);
  });

  it("a parità di frequenza sceglie la categoria della transazione più recente", () => {
    const rules = buildRulesFromHistory([
      makeTx("NETFLIX", "cat-vecchia", "2026-01-01"),
      makeTx("NETFLIX", "cat-recente", "2026-06-01"),
    ]);
    expect(rules[0].categoryId).toBe("cat-recente");
  });

  it("propone lo split solo quando tutte le transazioni della categoria vincente hanno la stessa quota", () => {
    const coerenti = buildRulesFromHistory([
      makeTx("AFFITTO", "cat-casa", "2026-01-01", "-100.00", "-50.00"),
      makeTx("AFFITTO", "cat-casa", "2026-02-01", "-200.00", "-100.00"),
    ]);
    expect(coerenti[0].splitPercentage).toBe(0.5);

    const incoerenti = buildRulesFromHistory([
      makeTx("AFFITTO", "cat-casa", "2026-01-01", "-100.00", "-50.00"),
      makeTx("AFFITTO", "cat-casa", "2026-02-01", "-100.00", "-10.00"),
    ]);
    expect(incoerenti[0].splitPercentage).toBeNull();
  });

  it("ignora le transazioni con chiave merchant vuota", () => {
    expect(buildRulesFromHistory([makeTx("   ", "cat-spesa", "2026-01-01")])).toEqual([]);
  });

  it("ritorna un array vuoto senza transazioni", () => {
    expect(buildRulesFromHistory([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm exec vitest run lib/db/backfill-categorization-rules.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Implement the script**

```ts
// lib/db/backfill-categorization-rules.ts
import { and, eq } from "drizzle-orm";
import { db } from "./client";
import { categories } from "./schema/categories";
import { transactions } from "./schema/transactions";
import { categorizationRules } from "./schema/categorization-rules";
import { merchantKey } from "@/lib/categorization/merchant-key";

export interface HistoryTransaction {
  description: string;
  categoryId: string;
  date: string;
  amount: string;
  excludedAmount: string;
}

export interface NewRuleSeed {
  pattern: string;
  categoryId: string;
  splitPercentage: number | null;
}

/** Excluded share as a fraction of the amount, rounded to compare transactions with different amounts. */
function splitPercentageOf(transaction: HistoryTransaction): number {
  const amount = Math.abs(Number(transaction.amount));
  if (amount === 0) return 0;
  return Math.round((Math.abs(Number(transaction.excludedAmount)) / amount) * 10000) / 10000;
}

/**
 * `appresa` rules that can be inferred from the already categorized history: one per merchant key, with the
 * most frequent category (ties broken on the most recent transaction) and the split proposed again only
 * if consistent across all transactions of the winning category.
 */
export function buildRulesFromHistory(history: HistoryTransaction[]): NewRuleSeed[] {
  const byKey = new Map<string, HistoryTransaction[]>();
  for (const transaction of history) {
    const key = merchantKey(transaction.description);
    if (key.length === 0) continue;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(transaction);
    else byKey.set(key, [transaction]);
  }

  const seeds: NewRuleSeed[] = [];
  for (const [pattern, group] of byKey) {
    const countByCategory = new Map<string, number>();
    const latestDateByCategory = new Map<string, string>();
    for (const transaction of group) {
      countByCategory.set(transaction.categoryId, (countByCategory.get(transaction.categoryId) ?? 0) + 1);
      const latest = latestDateByCategory.get(transaction.categoryId);
      if (!latest || transaction.date > latest) latestDateByCategory.set(transaction.categoryId, transaction.date);
    }

    let winningCategoryId = "";
    let winningCount = -1;
    let winningDate = "";
    for (const [categoryId, count] of countByCategory) {
      const latest = latestDateByCategory.get(categoryId) ?? "";
      if (count > winningCount || (count === winningCount && latest > winningDate)) {
        winningCategoryId = categoryId;
        winningCount = count;
        winningDate = latest;
      }
    }

    const winning = group.filter((transaction) => transaction.categoryId === winningCategoryId);
    const percentages = winning.map(splitPercentageOf);
    const uniform = percentages.every((percentage) => percentage === percentages[0]);

    seeds.push({
      pattern,
      categoryId: winningCategoryId,
      splitPercentage: uniform && percentages[0] > 0 ? percentages[0] : null,
    });
  }

  return seeds;
}

/**
 * Populates a user's `appresa` rules from their already categorized history (fallback
 * categories excluded). Idempotent: rules already present on the same pattern are not duplicated.
 * Returns the number of rules created.
 */
export async function backfillCategorizationRules(userId: string): Promise<number> {
  const userCategories = await db.select().from(categories).where(eq(categories.userId, userId));
  const fallbackIds = new Set(userCategories.filter((category) => category.isFallback).map((c) => c.id));

  const history = await db.select().from(transactions).where(eq(transactions.userId, userId));
  const categorized = history.filter((transaction) => !fallbackIds.has(transaction.categoryId));

  const seeds = buildRulesFromHistory(categorized);
  if (seeds.length === 0) return 0;

  const inserted = await db
    .insert(categorizationRules)
    .values(
      seeds.map((seed) => ({
        userId,
        matchType: "merchant" as const,
        pattern: seed.pattern,
        categoryId: seed.categoryId,
        splitPercentage: seed.splitPercentage === null ? null : seed.splitPercentage.toFixed(4),
        source: "appresa" as const,
      }))
    )
    .onConflictDoNothing({
      target: [categorizationRules.userId, categorizationRules.matchType, categorizationRules.pattern],
    })
    .returning({ id: categorizationRules.id });

  return inserted.length;
}

/** Command-line run: populates the rules of all users and prints the count. */
async function main() {
  const users = await db.selectDistinct({ userId: transactions.userId }).from(transactions);
  let total = 0;
  for (const { userId } of users) {
    const created = await backfillCategorizationRules(userId);
    console.log(`utente ${userId}: ${created} regole create`);
    total += created;
  }
  console.log(`totale: ${total} regole create`);
  process.exit(0);
}

if (process.argv[1]?.includes("backfill-categorization-rules")) {
  void main();
}
```

Note: `and` is imported for consistency with the project's other scripts but is not needed here — remove it if ESLint flags the unused import.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm exec vitest run lib/db/backfill-categorization-rules.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Actually run the backfill and report the count**

Run: `pnpm exec tsx --env-file=.env.local lib/db/backfill-categorization-rules.ts`

**Report the number of rules created in the task report.** A backfill written and never run is the 2026-07-22 mistake with `backfill-category-appearance.ts`: the code looked complete and the data stayed inconsistent for weeks. If the DB is not reachable, state it explicitly as a step not run instead of passing it off as done.

- [ ] **Step 6: Commit**

```bash
git add lib/db/backfill-categorization-rules.ts lib/db/backfill-categorization-rules.test.ts
git commit -m "feat: backfill delle regole di categorizzazione dallo storico"
```

---

### Task 6: Suggestion engine

**Files:**
- Create: `lib/categorization/suggest.ts`
- Test: `lib/categorization/suggest.test.ts`
- Delete: `lib/calc/categorize-suggestions.ts`, `lib/calc/categorize-suggestions.test.ts` (after Task 7, which is its last consumer — here only the replacement is created)

**Interfaces:**
- Consumes: `merchantKey`, `merchantKeyTokens`, `jaccardSimilarity` (Task 1), `isDirectionCompatible` (Task 3)
- Produces:
  - `type SuggestionSource = "regola" | "storico" | "assistente"`
  - `interface CategorizeSuggestion { transactionId: string; merchantKey: string; suggestedCategoryId: string; source: SuggestionSource; confidence: number; reason: string; suggestedSplitPercentage: number | null }`
  - `interface SuggestionGroup { merchantKey: string; label: string; transactionIds: string[]; totalAmount: number; suggestion: CategorizeSuggestion | null; hasDivergentSuggestions: boolean }`
  - `computeSuggestions(input: SuggestInput): CategorizeSuggestion[]`
  - `groupByMerchant(uncategorized: SuggestTransaction[], suggestions: CategorizeSuggestion[]): SuggestionGroup[]`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/categorization/suggest.test.ts
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
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm exec vitest run lib/categorization/suggest.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Implement the engine**

```ts
// lib/categorization/suggest.ts
import { isDirectionCompatible } from "./match-rule";
import { jaccardSimilarity, merchantKey, merchantKeyTokens } from "./merchant-key";

const SIMILARITY_THRESHOLD = 0.5;

export type SuggestionSource = "regola" | "storico" | "assistente";

export interface SuggestTransaction {
  id: string;
  description: string;
  amount: number;
  excludedAmount: number;
  date: string;
  categoryId: string;
}

export interface SuggestCategory {
  id: string;
  type: "fissa" | "variabile" | "entrata";
  isFallback: boolean;
}

export interface SuggestRule {
  id: string;
  pattern: string;
  categoryId: string;
  splitPercentage: number | null;
}

export interface SuggestInput {
  uncategorized: SuggestTransaction[];
  rules: SuggestRule[];
  history: SuggestTransaction[];
  categories: SuggestCategory[];
}

export interface CategorizeSuggestion {
  transactionId: string;
  merchantKey: string;
  suggestedCategoryId: string;
  source: SuggestionSource;
  confidence: number;
  reason: string;
  suggestedSplitPercentage: number | null;
}

export interface SuggestionGroup {
  merchantKey: string;
  label: string;
  transactionIds: string[];
  totalAmount: number;
  suggestion: CategorizeSuggestion | null;
  hasDivergentSuggestions: boolean;
}

/** Excluded share as a fraction of the amount, rounded for comparisons between different amounts. */
function splitPercentageOf(transaction: SuggestTransaction): number {
  const amount = Math.abs(transaction.amount);
  if (amount === 0) return 0;
  return Math.round((Math.abs(transaction.excludedAmount) / amount) * 10000) / 10000;
}

/** A category can be suggested only if it exists, is not the fallback and has the right direction. */
function canSuggest(categoryId: string, isIncome: boolean, categories: SuggestCategory[]): boolean {
  const category = categories.find((c) => c.id === categoryId);
  if (!category || category.isFallback) return false;
  return isDirectionCompatible(category.type, isIncome, false);
}

/** Suggestion derived from the rule most similar to the transaction's key, if above threshold. */
function suggestFromRules(
  transaction: SuggestTransaction,
  key: string,
  input: SuggestInput
): CategorizeSuggestion | null {
  const isIncome = transaction.amount > 0;
  const keyTokens = merchantKeyTokens(key);

  let best: { rule: SuggestRule; similarity: number } | null = null;
  for (const rule of input.rules) {
    if (!canSuggest(rule.categoryId, isIncome, input.categories)) continue;
    const similarity = jaccardSimilarity(keyTokens, merchantKeyTokens(rule.pattern));
    if (similarity < SIMILARITY_THRESHOLD) continue;
    if (!best || similarity > best.similarity) best = { rule, similarity };
  }
  if (!best) return null;

  return {
    transactionId: transaction.id,
    merchantKey: key,
    suggestedCategoryId: best.rule.categoryId,
    source: "regola",
    confidence: Math.round(best.similarity * 100) / 100,
    reason: `Simile alla regola "${best.rule.pattern}"`,
    suggestedSplitPercentage: best.rule.splitPercentage,
  };
}

/** Suggestion derived from past transactions with a similar merchant key. */
function suggestFromHistory(
  transaction: SuggestTransaction,
  key: string,
  input: SuggestInput
): CategorizeSuggestion | null {
  const isIncome = transaction.amount > 0;
  const keyTokens = merchantKeyTokens(key);

  const matches: { transaction: SuggestTransaction; similarity: number }[] = [];
  for (const candidate of input.history) {
    if (!canSuggest(candidate.categoryId, isIncome, input.categories)) continue;
    const similarity = jaccardSimilarity(keyTokens, merchantKeyTokens(merchantKey(candidate.description)));
    if (similarity >= SIMILARITY_THRESHOLD) matches.push({ transaction: candidate, similarity });
  }
  if (matches.length === 0) return null;

  const countByCategory = new Map<string, number>();
  const latestDateByCategory = new Map<string, string>();
  for (const match of matches) {
    const categoryId = match.transaction.categoryId;
    countByCategory.set(categoryId, (countByCategory.get(categoryId) ?? 0) + 1);
    const latest = latestDateByCategory.get(categoryId);
    if (!latest || match.transaction.date > latest) latestDateByCategory.set(categoryId, match.transaction.date);
  }

  let winningCategoryId = "";
  let winningCount = -1;
  let winningDate = "";
  for (const [categoryId, count] of countByCategory) {
    const latest = latestDateByCategory.get(categoryId) ?? "";
    if (count > winningCount || (count === winningCount && latest > winningDate)) {
      winningCategoryId = categoryId;
      winningCount = count;
      winningDate = latest;
    }
  }

  const winning = matches.filter((match) => match.transaction.categoryId === winningCategoryId);
  const percentages = winning.map((match) => splitPercentageOf(match.transaction));
  const uniform = percentages.every((percentage) => percentage === percentages[0]);
  const averageSimilarity =
    Math.round((winning.reduce((sum, match) => sum + match.similarity, 0) / winning.length) * 100) / 100;

  return {
    transactionId: transaction.id,
    merchantKey: key,
    suggestedCategoryId: winningCategoryId,
    source: "storico",
    confidence: averageSimilarity,
    reason: `Come ${winning.length} ${winning.length === 1 ? "transazione passata" : "transazioni passate"}`,
    suggestedSplitPercentage: uniform && percentages[0] > 0 ? percentages[0] : null,
  };
}

/**
 * Suggestions for the transactions still to categorize, in cascade: first similarity with an existing
 * rule, then with the already categorized history. Each transaction receives at most one
 * suggestion, from the first source that produces one. It writes nothing: the assistant layer plugs in
 * downstream, on the transactions left without a suggestion.
 */
export function computeSuggestions(input: SuggestInput): CategorizeSuggestion[] {
  const suggestions: CategorizeSuggestion[] = [];
  for (const transaction of input.uncategorized) {
    const key = merchantKey(transaction.description);
    const suggestion =
      suggestFromRules(transaction, key, input) ?? suggestFromHistory(transaction, key, input);
    if (suggestion) suggestions.push(suggestion);
  }
  return suggestions;
}

const SOURCE_PRIORITY: Record<SuggestionSource, number> = { regola: 3, storico: 2, assistente: 1 };

/**
 * Transactions to categorize gathered by merchant key, so that a single choice categorizes
 * many. The group inherits the highest-source suggestion among those of its transactions (at equal
 * source, the highest confidence) and flags whether suggestions for different categories coexist inside it.
 * Sorted by descending size: the groups that save the most work are at the top.
 */
export function groupByMerchant(
  uncategorized: SuggestTransaction[],
  suggestions: CategorizeSuggestion[]
): SuggestionGroup[] {
  const suggestionByTransactionId = new Map(suggestions.map((s) => [s.transactionId, s]));
  const byKey = new Map<string, SuggestTransaction[]>();
  for (const transaction of uncategorized) {
    const key = merchantKey(transaction.description);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(transaction);
    else byKey.set(key, [transaction]);
  }

  const groups: SuggestionGroup[] = [];
  for (const [key, group] of byKey) {
    const groupSuggestions = group
      .map((transaction) => suggestionByTransactionId.get(transaction.id))
      .filter((suggestion): suggestion is CategorizeSuggestion => suggestion !== undefined);

    const best =
      groupSuggestions.length === 0
        ? null
        : groupSuggestions.reduce((winner, candidate) => {
            const byPriority = SOURCE_PRIORITY[candidate.source] - SOURCE_PRIORITY[winner.source];
            if (byPriority !== 0) return byPriority > 0 ? candidate : winner;
            return candidate.confidence > winner.confidence ? candidate : winner;
          });

    const mostRecent = group.reduce((latest, candidate) => (candidate.date > latest.date ? candidate : latest));

    groups.push({
      merchantKey: key,
      label: mostRecent.description,
      transactionIds: group.map((transaction) => transaction.id),
      totalAmount: Math.round(group.reduce((sum, transaction) => sum + transaction.amount, 0) * 100) / 100,
      suggestion: best,
      hasDivergentSuggestions:
        new Set(groupSuggestions.map((suggestion) => suggestion.suggestedCategoryId)).size > 1,
    });
  }

  return groups.sort((a, b) => b.transactionIds.length - a.transactionIds.length);
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm exec vitest run lib/categorization/suggest.test.ts`
Expected: PASS, 12 tests

- [ ] **Step 5: Commit**

```bash
git add lib/categorization/suggest.ts lib/categorization/suggest.test.ts
git commit -m "feat: motore delle proposte di categorizzazione con raggruppamento per merchant"
```

---

### Task 7: Suggestions endpoint

**Files:**
- Modify: `app/api/transactions/categorize-suggestions/route.ts`, `app/api/transactions/categorize-suggestions/route.test.ts`
- Delete: `lib/calc/categorize-suggestions.ts`, `lib/calc/categorize-suggestions.test.ts`

**Interfaces:**
- Consumes: `computeSuggestions`, `groupByMerchant`, types from `suggest.ts` (Task 6); `categorizationRules` (Task 2)
- Produces: response `{ groups: SuggestionGroup[] }` from `GET /api/transactions/categorize-suggestions`

- [ ] **Step 1: Update the endpoint tests**

Read `app/api/transactions/categorize-suggestions/route.test.ts` and adapt the existing setup. Required cases:

```ts
it("risponde 401 senza sessione", async () => { /* as in the existing test */ });

it("raggruppa le transazioni da categorizzare per chiave merchant", async () => {
  // two fallback transactions with different descriptions but the same key
  const response = await GET(request);
  const { groups } = await response.json();
  expect(groups).toHaveLength(1);
  expect(groups[0].transactionIds).toHaveLength(2);
});

it("include la proposta ricavata da una regola esistente", async () => {
  // merchant rule "esselunga via roma" -> spending category
  const { groups } = await (await GET(request)).json();
  expect(groups[0].suggestion.source).toBe("regola");
});

it("non include le transazioni di altri utenti", async () => {
  // fallback transaction created on otherUserId
  const { groups } = await (await GET(request)).json();
  expect(groups).toEqual([]);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm exec vitest run app/api/transactions/categorize-suggestions/route.test.ts`
Expected: FAIL — the response is still a flat array of suggestions, not `{ groups }`

- [ ] **Step 3: Rewrite the endpoint**

```ts
// app/api/transactions/categorize-suggestions/route.ts
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import { transactions } from "@/lib/db/schema/transactions";
import { computeSuggestions, groupByMerchant, type SuggestTransaction } from "@/lib/categorization/suggest";

/** DB transaction in the shape expected by the suggestion engine (numbers already converted). */
function toSuggestTransaction(row: typeof transactions.$inferSelect): SuggestTransaction {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    excludedAmount: Number(row.excludedAmount),
    date: row.date,
    categoryId: row.categoryId,
  };
}

/**
 * GET /api/transactions/categorize-suggestions — transactions still on the fallback category,
 * grouped by merchant key, each with the possible suggestion derived from existing rules or
 * from the already categorized history. It never queries the assistant (dedicated `ai` endpoint), so the
 * response does not depend on a model being available.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const userId = session.user.id;

  const userCategories = await db.select().from(categories).where(eq(categories.userId, userId));
  const fallbackIds = new Set(userCategories.filter((category) => category.isFallback).map((c) => c.id));

  const allTransactions = await db.select().from(transactions).where(eq(transactions.userId, userId));
  const uncategorized = allTransactions
    .filter((transaction) => fallbackIds.has(transaction.categoryId))
    .map(toSuggestTransaction);
  const history = allTransactions
    .filter((transaction) => !fallbackIds.has(transaction.categoryId))
    .map(toSuggestTransaction);

  const rules = await db
    .select({
      id: categorizationRules.id,
      pattern: categorizationRules.pattern,
      categoryId: categorizationRules.categoryId,
      splitPercentage: categorizationRules.splitPercentage,
    })
    .from(categorizationRules)
    .where(eq(categorizationRules.userId, userId));

  const suggestions = computeSuggestions({
    uncategorized,
    history,
    rules: rules.map((rule) => ({
      ...rule,
      splitPercentage: rule.splitPercentage === null ? null : Number(rule.splitPercentage),
    })),
    categories: userCategories.map((category) => ({
      id: category.id,
      type: category.type,
      isFallback: category.isFallback,
    })),
  });

  return Response.json({ groups: groupByMerchant(uncategorized, suggestions) });
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm exec vitest run app/api/transactions/categorize-suggestions/route.test.ts`
Expected: PASS

- [ ] **Step 5: Delete the old engine and the wizard that consumes it**

```bash
git rm lib/calc/categorize-suggestions.ts lib/calc/categorize-suggestions.test.ts components/domain/expenses/auto-categorize-wizard.tsx
```

The wizard must be removed **here and no later**: it consumes the old `CategorizeSuggestion` type, which had the shape `{ transaction: Transaction, ... }` while the new one exposes `transactionId`. It is not an import to repoint, it is an incompatible type — keeping it alive would break `tsc` until Task 13.

Consequently, in `components/domain/expenses/auto-categorize-button.tsx` replace the opening of the wizard with a `Link` to `/categorizza` (text unchanged: «Categorizza automaticamente» ("Categorize automatically")), and remove the wizard export lines from `components/domain/expenses/index.ts`.

**The `/categorizza` route does not exist yet**: it is born in Task 9. Between this task and that one the button leads to a 404 — acceptable inside the working branch, but it is the reason Task 9 must not be skipped or postponed.

Run: `pnpm tsc --noEmit && grep -rn "AutoCategorizeWizard\|calc/categorize-suggestions" --include=*.ts --include=*.tsx . | grep -v node_modules`
Expected: tsc clean, no remaining references.

- [ ] **Step 6: Commit**

```bash
git add -A app/api/transactions/categorize-suggestions lib/calc components/domain/expenses
git commit -m "feat: endpoint proposte raggruppate per merchant, rimosso il vecchio wizard"
```

---

### Task 8: Atomic batch apply

**Files:**
- Create: `lib/validation/categorization-rules.ts`, `lib/validation/categorization-rules.test.ts`, `app/api/transactions/categorize-apply/route.ts`, `app/api/transactions/categorize-apply/route.test.ts`

**Interfaces:**
- Consumes: `categorizationRules` (Task 2), `merchantKey` (Task 1), `isDirectionCompatible` (Task 3)
- Produces: `applyCategorizationSchema` / `ApplyCategorizationInput` with shape `{ groups: { transactionIds: string[]; categoryId: string; excludedPercentage: number; createRule: boolean; merchantKey: string }[] }`; response `{ applied: number; rulesCreated: number }`

- [ ] **Step 1: Write the Zod schema and its tests**

```ts
// lib/validation/categorization-rules.ts
import { z } from "zod";
import { RULE_MATCH_TYPES } from "@/lib/db/schema/categorization-rules";

export const applyCategorizationSchema = z.object({
  groups: z
    .array(
      z.object({
        transactionIds: z.array(z.uuid()).min(1),
        categoryId: z.uuid(),
        // Excluded share as a fraction of the amount (0-1), applied to every transaction in the group.
        excludedPercentage: z.number().min(0).max(1).default(0),
        createRule: z.boolean().default(true),
        merchantKey: z.string().trim().min(1),
      })
    )
    .min(1),
});
export type ApplyCategorizationInput = z.infer<typeof applyCategorizationSchema>;

export const createRuleSchema = z.object({
  matchType: z.enum(RULE_MATCH_TYPES),
  pattern: z.string().trim().min(1),
  categoryId: z.uuid(),
  splitPercentage: z.number().min(0).max(1).nullable().optional(),
});
export type CreateRuleInput = z.infer<typeof createRuleSchema>;

export const updateRuleSchema = z
  .object({
    matchType: z.enum(RULE_MATCH_TYPES).optional(),
    pattern: z.string().trim().min(1).optional(),
    categoryId: z.uuid().optional(),
    splitPercentage: z.number().min(0).max(1).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nessun campo da aggiornare" });
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
```

```ts
// lib/validation/categorization-rules.test.ts
import { describe, expect, it } from "vitest";
import { applyCategorizationSchema, createRuleSchema, updateRuleSchema } from "./categorization-rules";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("applyCategorizationSchema", () => {
  it("accetta un gruppo valido e applica i default", () => {
    const parsed = applyCategorizationSchema.parse({
      groups: [{ transactionIds: [uuid], categoryId: uuid, merchantKey: "esselunga" }],
    });
    expect(parsed.groups[0].excludedPercentage).toBe(0);
    expect(parsed.groups[0].createRule).toBe(true);
  });

  it("rifiuta un gruppo senza transazioni", () => {
    expect(
      applyCategorizationSchema.safeParse({ groups: [{ transactionIds: [], categoryId: uuid, merchantKey: "x" }] }).success
    ).toBe(false);
  });

  it("rifiuta una quota esclusa fuori dall'intervallo 0-1", () => {
    expect(
      applyCategorizationSchema.safeParse({
        groups: [{ transactionIds: [uuid], categoryId: uuid, merchantKey: "x", excludedPercentage: 1.5 }],
      }).success
    ).toBe(false);
  });

  it("rifiuta una lista di gruppi vuota", () => {
    expect(applyCategorizationSchema.safeParse({ groups: [] }).success).toBe(false);
  });
});

describe("createRuleSchema", () => {
  it("accetta una regola contains senza split", () => {
    expect(createRuleSchema.parse({ matchType: "contains", pattern: "esselunga", categoryId: uuid }).pattern).toBe("esselunga");
  });

  it("rifiuta un matchType sconosciuto", () => {
    expect(createRuleSchema.safeParse({ matchType: "regex", pattern: "x", categoryId: uuid }).success).toBe(false);
  });
});

describe("updateRuleSchema", () => {
  it("rifiuta un aggiornamento vuoto", () => {
    expect(updateRuleSchema.safeParse({}).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the schema tests**

Run: `pnpm exec vitest run lib/validation/categorization-rules.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 3: Write the failing endpoint tests**

Model the setup on `app/api/transactions/[id]/route.test.ts`. Required cases:

```ts
it("risponde 401 senza sessione", async () => { /* ... */ });

it("categorizza tutte le transazioni del gruppo in una sola chiamata", async () => {
  // 3 fallback transactions, one group, spending category
  const response = await POST(request);
  expect(await response.json()).toMatchObject({ applied: 3 });
  // read the 3 transactions back: all on the spending category
});

it("crea la regola merchant quando createRule è true", async () => {
  const { rulesCreated } = await (await POST(request)).json();
  expect(rulesCreated).toBe(1);
  // the rule has matchType "merchant", pattern equal to the merchantKey sent, source "appresa"
});

it("non crea la regola quando createRule è false", async () => { /* rulesCreated === 0 */ });

it("aggiorna la regola esistente invece di duplicarla", async () => {
  // apply the same merchantKey twice with different categories
  // -> a single rule, with the category of the second application
});

it("applica la quota esclusa proporzionalmente a ogni transazione del gruppo", async () => {
  // two transactions of -100 and -50, excludedPercentage 0.5
  // -> excludedAmount -50 and -25
});

it("rifiuta con 400 una categoria incompatibile con la direzione di una transazione del gruppo", async () => {
  // group with one expense, income-type category
  expect((await POST(request)).status).toBe(400);
});

it("non applica niente se una sola transazione del gruppo non è dell'utente", async () => {
  // group with 2 own transactions + 1 from another user
  expect((await POST(request)).status).toBe(404);
  // the 2 own transactions must NOT end up modified: the write is atomic
});
```

- [ ] **Step 4: Run the tests and verify they fail**

Run: `pnpm exec vitest run app/api/transactions/categorize-apply/route.test.ts`
Expected: FAIL — route does not exist

- [ ] **Step 5: Implement the endpoint**

```ts
// app/api/transactions/categorize-apply/route.ts
import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import { transactions } from "@/lib/db/schema/transactions";
import { isDirectionCompatible } from "@/lib/categorization/match-rule";
import { applyCategorizationSchema } from "@/lib/validation/categorization-rules";

/**
 * POST /api/transactions/categorize-apply — applies in bulk the choices made on the review
 * page: updates the category and excluded share of every transaction in the received groups and, where
 * requested, creates or updates the corresponding `appresa` rule. All in a single DB transaction:
 * either the whole batch goes through, or nothing does.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response(null, { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json();
  const parsed = applyCategorizationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const requestedCategoryIds = [...new Set(parsed.data.groups.map((group) => group.categoryId))];
  const ownedCategories = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), inArray(categories.id, requestedCategoryIds)));
  if (ownedCategories.length !== requestedCategoryIds.length) {
    return new Response(null, { status: 404 });
  }

  const requestedTransactionIds = parsed.data.groups.flatMap((group) => group.transactionIds);
  const ownedTransactions = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), inArray(transactions.id, requestedTransactionIds)));
  if (ownedTransactions.length !== new Set(requestedTransactionIds).size) {
    return new Response(null, { status: 404 });
  }

  const transactionById = new Map(ownedTransactions.map((transaction) => [transaction.id, transaction]));
  const categoryById = new Map(ownedCategories.map((category) => [category.id, category]));

  // Direction guard on every transaction before writing: a single incompatible case invalidates
  // the whole batch, instead of leaving half the work applied.
  for (const group of parsed.data.groups) {
    const category = categoryById.get(group.categoryId)!;
    for (const transactionId of group.transactionIds) {
      const transaction = transactionById.get(transactionId)!;
      const isIncome = Number(transaction.amount) > 0;
      if (!isDirectionCompatible(category.type, isIncome, category.isFallback)) {
        return Response.json(
          { error: "La categoria scelta non è compatibile con la direzione della transazione" },
          { status: 400 }
        );
      }
    }
  }

  let applied = 0;
  let rulesCreated = 0;

  await db.transaction(async (tx) => {
    for (const group of parsed.data.groups) {
      for (const transactionId of group.transactionIds) {
        const transaction = transactionById.get(transactionId)!;
        const amount = Number(transaction.amount);
        const magnitude = Math.round(Math.abs(amount) * group.excludedPercentage * 100) / 100;
        const excludedAmount = amount >= 0 ? magnitude : -magnitude;

        await tx
          .update(transactions)
          .set({
            categoryId: group.categoryId,
            excludedAmount: excludedAmount.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, transactionId));
        applied += 1;
      }

      if (!group.createRule) continue;

      const splitPercentage = group.excludedPercentage > 0 ? group.excludedPercentage.toFixed(4) : null;
      const [rule] = await tx
        .insert(categorizationRules)
        .values({
          userId,
          matchType: "merchant",
          pattern: group.merchantKey,
          categoryId: group.categoryId,
          splitPercentage,
          source: "appresa",
        })
        .onConflictDoUpdate({
          target: [categorizationRules.userId, categorizationRules.matchType, categorizationRules.pattern],
          set: { categoryId: group.categoryId, splitPercentage, updatedAt: new Date() },
        })
        .returning({ id: categorizationRules.id, createdAt: categorizationRules.createdAt, updatedAt: categorizationRules.updatedAt });

      // Distinguishing creation from update: on an insert both columns take the Postgres
      // transaction's `now()` and coincide; on a conflict `updatedAt` gets the JS
      // `new Date()`, always different from `createdAt`. If this comparison turns out to be fragile
      // in tests, replace it with an upfront SELECT of the already existing patterns.
      if (rule && rule.createdAt.getTime() === rule.updatedAt.getTime()) rulesCreated += 1;
    }
  });

  return Response.json({ applied, rulesCreated });
}
```

- [ ] **Step 6: Run the tests and verify they pass**

Run: `pnpm exec vitest run app/api/transactions/categorize-apply/route.test.ts lib/validation/categorization-rules.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/validation/categorization-rules.ts lib/validation/categorization-rules.test.ts app/api/transactions/categorize-apply
git commit -m "feat: applicazione batch atomica della categorizzazione"
```

---

### Task 9: Client hooks and review page

**Files:**
- Create: `lib/queries/categorization.ts`, `app/(app)/categorizza/page.tsx`, `components/domain/categorization/categorize-group-row.tsx`, `components/domain/categorization/index.ts`
- Modify: `components/domain/expenses/auto-categorize-button.tsx`

**Interfaces:**
- Consumes: `SuggestionGroup` (Task 6), endpoints of Tasks 7 and 8
- Produces: `useCategorizeSuggestionsQuery()`, `useApplyCategorizationMutation()`, `CategorizeGroupRow` component

- [ ] **Step 1: Create the hooks**

```ts
// lib/queries/categorization.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SuggestionGroup } from "@/lib/categorization/suggest";
import type { ApplyCategorizationInput } from "@/lib/validation/categorization-rules";

const SUGGESTIONS_QUERY_KEY = ["categorize-suggestions"] as const;

async function fetchSuggestions(): Promise<SuggestionGroup[]> {
  const response = await fetch("/api/transactions/categorize-suggestions");
  if (!response.ok) {
    throw new Error("Impossibile caricare le proposte di categorizzazione");
  }
  const body = (await response.json()) as { groups: SuggestionGroup[] };
  return body.groups;
}

/** Groups of transactions to categorize with their suggestions from rules and history. */
export function useCategorizeSuggestionsQuery() {
  return useQuery({ queryKey: SUGGESTIONS_QUERY_KEY, queryFn: fetchSuggestions });
}

/** Applies the categorization choices in bulk and invalidates suggestions and transactions on success. */
export function useApplyCategorizationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ApplyCategorizationInput) => {
      const response = await fetch("/api/transactions/categorize-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Impossibile applicare la categorizzazione");
      }
      return response.json() as Promise<{ applied: number; rulesCreated: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUGGESTIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
```

Check the exact key used by `lib/queries/transactions.ts` and use it instead of `["transactions"]` if it differs.

- [ ] **Step 2: Create the group row**

`components/domain/categorization/categorize-group-row.tsx`: controlled component, no state of its own except expansion. Props:

```ts
export interface CategorizeGroupRowProps {
  group: SuggestionGroup;
  categories: Category[];
  currency: string;
  selected: boolean;
  categoryId: string;
  excludedPercentage: number;
  onToggleSelected: (selected: boolean) => void;
  onCategoryChange: (categoryId: string) => void;
  onExcludedPercentageChange: (value: number) => void;
}
```

Rendering requirements:

- Selection checkbox, group label (`group.label`) and count (`«7 transazioni»`, correct singular at 1), total amount with `formatCurrency`.
- Category `Select` filtered by direction, with `CategoryAvatar` and the render-prop inside `SelectValue` — **mandatory** with `@base-ui/react`, otherwise the raw id shows up (a bug that already happened in the project). Copy the pattern from `auto-categorize-wizard.tsx:90-125`.
- The group's direction is inferred from the sign of `group.totalAmount`.
- Badge of the suggestion's origin: `Regola simile` / `Storico` / `Assistente` (Similar rule / History / Assistant), with the confidence percentage and `group.suggestion.reason` as secondary text. No badge if `suggestion` is `null`.
- If `group.hasDivergentSuggestions`, a warning line: «Le transazioni di questo gruppo avevano proposte diverse — controlla prima di applicare» ("The transactions in this group had different suggestions — check before applying").
- Split control collapsed behind a toggle, reusing `SplitSlider` if the props allow it, otherwise a 0-100% `Slider`.
- Expansion listing the group's individual descriptions.

Keep the file under ~150 lines of JSX; if it grows, extract the badge into a sub-component.

- [ ] **Step 3: Create the page**

`app/(app)/categorizza/page.tsx`: client component that orchestrates, with no business logic (rule from `CLAUDE.md`: no computations in routes).

- Local state: `Map<merchantKey, { selected, categoryId, excludedPercentage }>`, initialized from the suggestions when the data arrives.
- Header: title «Categorizza», subtitle with the number of pending transactions, back link to Transazioni.
- Action bar: «Seleziona tutto» / «Deseleziona tutto» ("Select all" / "Deselect all"), button **«Applica selezionate (N)»** ("Apply selected (N)") disabled at N = 0 or during the mutation.
- Loading state with skeleton, empty state («Nessuna transazione da categorizzare», "No transactions to categorize"), mutation error visible on the page.
- On success: `sonner` toast with «N transazioni categorizzate, M regole create» ("N transactions categorized, M rules created").
- No group is selected by default: selection is an explicit user choice.

- [ ] **Step 4: Verify that the button really leads to the page**

The `Link` to `/categorizza` was already added in Task 7: here the route finally exists, so check that the path matches the created folder (`app/(app)/categorizza/page.tsx` → `/categorizza`, the `(app)` route group does not appear in the URL).

- [ ] **Step 5: Check types, lint and build**

Run: `pnpm tsc --noEmit && pnpm lint && pnpm build`
Expected: tsc clean; lint with only the 2 pre-existing, already known `react-hooks/set-state-in-effect` errors (`theme-toggle.tsx`, `CategoryLegendRow`), no new ones; build completed.

- [ ] **Step 6: Commit**

```bash
git add lib/queries/categorization.ts app/\(app\)/categorizza components/domain/categorization components/domain/expenses/auto-categorize-button.tsx
git commit -m "feat: pagina di revisione della categorizzazione raggruppata per merchant"
```

---

### Task 10: Rules CRUD

**Files:**
- Create: `app/api/categorization-rules/route.ts`, `app/api/categorization-rules/route.test.ts`, `app/api/categorization-rules/[id]/route.ts`, `app/api/categorization-rules/[id]/route.test.ts`
- Modify: `lib/queries/categorization.ts`

**Interfaces:**
- Consumes: `createRuleSchema` / `updateRuleSchema` (Task 8), `merchantKey` (Task 1)
- Produces: `useCategorizationRulesQuery()`, `useCreateRuleMutation()`, `useUpdateRuleMutation()`, `useDeleteRuleMutation()`

- [ ] **Step 1: Write the failing tests**

Required cases, with the ownership pattern of `app/api/categories/[id]/route.test.ts`:

```ts
// route.test.ts (collection)
it("risponde 401 senza sessione", async () => { /* ... */ });
it("elenca solo le regole dell'utente autenticato", async () => { /* ... */ });
it("crea una regola normalizzando il pattern con merchantKey", async () => {
  // POST with pattern "ESSELUNGA SPA" -> the saved rule has pattern "esselunga"
});
it("rifiuta con 404 una categoria di un altro utente", async () => { /* ... */ });
it("rifiuta con 409 una regola duplicata su stesso tipo e pattern", async () => { /* ... */ });

// [id]/route.test.ts
it("aggiorna il tipo di match di una regola propria", async () => {
  // PATCH matchType "contains" -> the rule is now contains
});
it("risponde 404 sulla regola di un altro utente", async () => { /* PATCH and DELETE */ });
it("elimina una regola propria", async () => { /* ... */ });
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm exec vitest run app/api/categorization-rules`
Expected: FAIL — routes do not exist

- [ ] **Step 3: Implement the endpoints**

`GET` returns the user's rules sorted by descending `hitCount`, enriched with the category name (join on `categories`) because the UI has to show it.

`POST`: validates with `createRuleSchema`, checks the ownership of the `categoryId` (404 if not owned), **normalizes the pattern with `merchantKey()` before saving** — a non-normalized pattern would never match, since the comparison always happens on normalized keys — and sets `source: "manuale"`. Unique constraint violation → 409 with the message «Esiste già una regola con questo pattern» ("A rule with this pattern already exists").

`PATCH`/`DELETE` in `[id]/route.ts`: fetch the rule only if `userId` matches (404 otherwise), same pattern normalization on update, same ownership check on the new `categoryId`.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm exec vitest run app/api/categorization-rules`
Expected: PASS

- [ ] **Step 5: Add the hooks**

In `lib/queries/categorization.ts`, add `useCategorizationRulesQuery`, `useCreateRuleMutation`, `useUpdateRuleMutation`, `useDeleteRuleMutation` on the `["categorization-rules"]` key, in the same style as `lib/queries/categories.ts` (invalidation on success, error message from the response body). The query's return type is `CategorizationRule & { categoryName: string }`.

- [ ] **Step 6: Commit**

```bash
git add app/api/categorization-rules lib/queries/categorization.ts
git commit -m "feat: CRUD delle regole di categorizzazione"
```

---

### Task 11: Rule management in `/categorie`

**Files:**
- Create: `components/domain/categorization/rules-manager.tsx`
- Modify: `app/(app)/categorie/page.tsx`, `components/domain/categorization/index.ts`

**Interfaces:**
- Consumes: hooks of Task 10, `RULE_MATCH_TYPES` (Task 2)
- Produces: `RulesManager` component with props `{ categories: Category[] }`

- [ ] **Step 1: Build the component**

`RulesManager` is a standalone `Card`, mounted below the existing category management. Requirements:

- Table or list of rows: pattern, match type badge (`Esatta` for `merchant`, `Contiene` for `contains` — "Exact" / "Contains"), category with `CategoryAvatar`, origin badge (`Appresa` / `Manuale`, "Learned" / "Manual"), «usata N volte» ("used N times").
- Inline editing: editable pattern, category `Select`, match type `Select`. Save on blur or on Enter, as `CategoryLegendRow` already does for the budget.
- **Short** explanatory text above the list: «Le regole si applicano da sole alle nuove transazioni. "Contiene" copre tutte le varianti: cambia `esselunga via roma` in `esselunga` per prendere ogni filiale.» ("Rules apply on their own to new transactions. "Contains" covers all variants: change `esselunga via roma` to `esselunga` to catch every branch.")
- Deletion with a confirmation `AlertDialog`, as «Distribuisci colori» ("Distribute colors") already does.
- Empty state: «Nessuna regola ancora. Le regole nascono quando categorizzi le transazioni dalla pagina Categorizza.» ("No rules yet. Rules are created when you categorize transactions from the Categorizza page.")
- Manual addition of a rule at the bottom of the list (pattern + category + type).

All strings in Italian, colors only from theme tokens, file under ~150 lines of JSX (extract the row into a sub-component if needed).

- [ ] **Step 2: Mount it in the page**

In `app/(app)/categorie/page.tsx`, add `<RulesManager categories={categories} />` below the existing section. No new sidebar entry.

- [ ] **Step 3: Check types, lint and build**

Run: `pnpm tsc --noEmit && pnpm lint && pnpm build`
Expected: tsc clean, no new lint errors, build completed.

- [ ] **Step 4: Commit**

```bash
git add components/domain/categorization app/\(app\)/categorie/page.tsx
git commit -m "feat: gestione delle regole di categorizzazione in Categorie"
```

---

### Task 12: Assistant layer (Ollama)

**Files:**
- Create: `lib/categorization/llm/index.ts`, `lib/categorization/llm/ollama.ts`, `lib/categorization/llm/ollama.test.ts`, `app/api/transactions/categorize-suggestions/ai/route.ts`, `app/api/transactions/categorize-suggestions/ai/route.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `Category` from the schema, `SuggestTransaction` (Task 6)
- Produces:
  - `interface SuggestInput { index: number; description: string; amount: number }`
  - `interface LlmSuggestion { index: number; categoryName: string; confidence: number }`
  - `interface CategorySuggester { suggest(input: SuggestInput[], categories: Category[]): Promise<LlmSuggestion[]> }`
  - `getSuggester(): CategorySuggester | null`
  - `createOllamaSuggester(baseUrl: string, model: string): CategorySuggester`

- [ ] **Step 1: Write the failing tests**

The global constraint «nessun modello collegato è uno stato normale» ("no connected model is a normal state") must be **proven**, not just stated.

```ts
// lib/categorization/llm/ollama.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSuggester } from "./index";
import { createOllamaSuggester } from "./ollama";

const categories = [
  { id: "cat-spesa", name: "Spesa alimentare", type: "variabile", isFallback: false },
  { id: "cat-casa", name: "Affitto & Mutuo", type: "fissa", isFallback: false },
] as never;

const input = [{ index: 0, description: "esselunga via roma", amount: -30 }];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getSuggester", () => {
  it("ritorna null quando OLLAMA_BASE_URL non è configurata", () => {
    vi.stubEnv("OLLAMA_BASE_URL", "");
    expect(getSuggester()).toBeNull();
  });

  it("ritorna un suggester quando la configurazione è presente", () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
    vi.stubEnv("OLLAMA_MODEL", "llama3.2");
    expect(getSuggester()).not.toBeNull();
  });
});

describe("createOllamaSuggester", () => {
  it("mappa la risposta del modello sulle categorie dell'utente", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ response: JSON.stringify([{ index: 0, categoryName: "Spesa alimentare", confidence: 0.8 }]) }))
    );
    const result = await createOllamaSuggester("http://localhost:11434", "llama3.2").suggest(input, categories);
    expect(result).toEqual([{ index: 0, categoryName: "Spesa alimentare", confidence: 0.8 }]);
  });

  it("ritorna un array vuoto quando la connessione fallisce", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(createOllamaSuggester("http://localhost:11434", "llama3.2").suggest(input, categories)).resolves.toEqual([]);
  });

  it("ritorna un array vuoto su risposta HTTP di errore", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    await expect(createOllamaSuggester("http://localhost:11434", "llama3.2").suggest(input, categories)).resolves.toEqual([]);
  });

  it("ritorna un array vuoto quando la risposta non è JSON valido", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ response: "non sono json" })));
    await expect(createOllamaSuggester("http://localhost:11434", "llama3.2").suggest(input, categories)).resolves.toEqual([]);
  });

  it("scarta le proposte su categorie che non esistono fra quelle dell'utente", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ response: JSON.stringify([{ index: 0, categoryName: "Categoria Inventata", confidence: 0.9 }]) }))
    );
    await expect(createOllamaSuggester("http://localhost:11434", "llama3.2").suggest(input, categories)).resolves.toEqual([]);
  });

  it("ritorna un array vuoto senza transazioni da valutare, senza chiamare il modello", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(createOllamaSuggester("http://localhost:11434", "llama3.2").suggest([], categories)).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
```

Also add a timeout test: `fetch` mocked with a promise that never resolves and fake timers, to check that after 10s the call returns `[]`.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `pnpm exec vitest run lib/categorization/llm/ollama.test.ts`
Expected: FAIL — modules do not exist

- [ ] **Step 3: Implement the interface and the implementation**

```ts
// lib/categorization/llm/index.ts
import type { Category } from "@/lib/db/schema/categories";
import { createOllamaSuggester } from "./ollama";

export interface SuggestInput {
  index: number;
  description: string;
  amount: number;
}

export interface LlmSuggestion {
  index: number;
  categoryName: string;
  confidence: number;
}

export interface CategorySuggester {
  suggest(input: SuggestInput[], categories: Category[]): Promise<LlmSuggestion[]>;
}

/**
 * Configured suggester, or `null` if no model is connected. A missing model is a normal
 * state of the product, not a failure: the caller simply skips the layer, with no
 * errors or warnings to the user.
 */
export function getSuggester(): CategorySuggester | null {
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim();
  if (!baseUrl) return null;
  return createOllamaSuggester(baseUrl, process.env.OLLAMA_MODEL?.trim() || "llama3.2");
}
```

```ts
// lib/categorization/llm/ollama.ts
import { z } from "zod";
import type { Category } from "@/lib/db/schema/categories";
import type { CategorySuggester, LlmSuggestion, SuggestInput } from "./index";

const TIMEOUT_MS = 10_000;

const llmResponseSchema = z.array(
  z.object({
    index: z.number().int().min(0),
    categoryName: z.string(),
    confidence: z.number().min(0).max(1),
  })
);

/** Prompt in a single block: available categories and transactions to classify, without account data. */
function buildPrompt(input: SuggestInput[], categories: Category[]): string {
  const categoryList = categories
    .filter((category) => !category.isFallback)
    .map((category) => `- ${category.name} (${category.type})`)
    .join("\n");
  const transactionList = input
    .map((item) => `${item.index}. "${item.description}" — importo ${item.amount.toFixed(2)}`)
    .join("\n");

  return [
    "Classifica ogni transazione bancaria nella categoria più adatta fra quelle elencate.",
    "Le categorie di tipo 'entrata' valgono solo per importi positivi, le altre solo per importi negativi.",
    "",
    "Categorie disponibili:",
    categoryList,
    "",
    "Transazioni:",
    transactionList,
    "",
    'Rispondi solo con un array JSON: [{"index": 0, "categoryName": "<nome esatto dalla lista>", "confidence": 0.0-1.0}].',
    "Ometti le transazioni di cui non sei ragionevolmente sicuro. Nessun testo fuori dal JSON.",
  ].join("\n");
}

/**
 * Suggester based on an Ollama instance reachable via HTTP. Any problem — connection
 * refused, timeout, non-conforming response, non-existent category — turns into zero suggestions,
 * never into an error propagated to the caller: the deterministic layer must never get worse
 * because of this.
 */
export function createOllamaSuggester(baseUrl: string, model: string): CategorySuggester {
  return {
    async suggest(input: SuggestInput[], categories: Category[]): Promise<LlmSuggestion[]> {
      if (input.length === 0) return [];

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const response = await fetch(`${baseUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prompt: buildPrompt(input, categories),
            stream: false,
            format: "json",
          }),
          signal: controller.signal,
        });
        if (!response.ok) return [];

        const body = (await response.json()) as { response?: string };
        if (!body.response) return [];

        const parsed = llmResponseSchema.safeParse(JSON.parse(body.response));
        if (!parsed.success) return [];

        const validNames = new Set(
          categories.filter((category) => !category.isFallback).map((category) => category.name)
        );
        const validIndexes = new Set(input.map((item) => item.index));
        return parsed.data.filter(
          (suggestion) => validNames.has(suggestion.categoryName) && validIndexes.has(suggestion.index)
        );
      } catch {
        return [];
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
```

`JSON.parse` can throw on a non-JSON response: it is inside the `try`, so it falls back to the `return []` of the `catch`. Do not add a second nested try.

- [ ] **Step 4: Implement the endpoint**

`app/api/transactions/categorize-suggestions/ai/route.ts`: `POST`, session required, receives `{ transactionIds: string[] }`, checks the ownership of all transactions (404 otherwise), calls `getSuggester()`. **If it is `null`, it responds `Response.json({ groups: [] })` with status 200** — it is not an error. Otherwise it builds the input from the descriptions normalized with `merchantKey`, calls `suggest`, converts the `categoryName`s into `categoryId`s discarding those that do not match, applies the direction guard and returns suggestions with `source: "assistente"` and `confidence` from the model, already grouped with `groupByMerchant`.

Required tests:

```ts
it("risponde 401 senza sessione", async () => { /* ... */ });
it("risponde 200 con lista vuota quando nessun modello è configurato", async () => {
  vi.stubEnv("OLLAMA_BASE_URL", "");
  const response = await POST(request);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ groups: [] });
});
it("risponde 404 se una transazione non è dell'utente", async () => { /* ... */ });
it("scarta una proposta incompatibile con la direzione della transazione", async () => { /* ... */ });
```

- [ ] **Step 5: Document the configuration**

In `.env.example` add, with the comment:

```bash
# Assisted categorization (optional): without these variables the layer is simply off
# and categorization stays purely deterministic (rules + similarity).
OLLAMA_BASE_URL=
OLLAMA_MODEL=llama3.2
```

- [ ] **Step 6: Run the tests and verify they pass**

Run: `pnpm exec vitest run lib/categorization/llm app/api/transactions/categorize-suggestions`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/categorization/llm app/api/transactions/categorize-suggestions/ai .env.example
git commit -m "feat: livello assistente Ollama opzionale per la categorizzazione"
```

---

### Task 13: Plugging the assistant into the review page

**Files:**
- Modify: `app/(app)/categorizza/page.tsx`, `lib/queries/categorization.ts`

**Interfaces:**
- Consumes: `ai` endpoint (Task 12), page from Task 9
- Produces: `useAiSuggestionsMutation()`

- [ ] **Step 1: Add the hook**

In `lib/queries/categorization.ts`:

```ts
/** Additional suggestions from the assistant for the groups left without a suggestion. Silent if the layer is off. */
export function useAiSuggestionsMutation() {
  return useMutation({
    mutationFn: async (transactionIds: string[]) => {
      const response = await fetch("/api/transactions/categorize-suggestions/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionIds }),
      });
      if (!response.ok) return { groups: [] as SuggestionGroup[] };
      return response.json() as Promise<{ groups: SuggestionGroup[] }>;
    },
  });
}
```

Note the difference from the other hooks: here a failure does **not** throw. An error response counts as «no additional suggestions», because the absence of the assistant must never produce a visible error.

- [ ] **Step 2: Plug it into the page**

In the `/categorizza` page, once the query data has arrived, invoke the mutation **only once** with the ids of the transactions of the groups whose `suggestion` is `null`. If there are none, do not call the endpoint. The suggestions that come back are plugged into their respective groups, without touching those that already have a suggestion and without overwriting a choice already made by the user.

No blocking spinner: at most a discreet indication next to the pending groups, which disappears anyway when the mutation ends, however it ends.

- [ ] **Step 3: Full verification**

Run: `pnpm tsc --noEmit && pnpm lint && pnpm exec vitest run && pnpm build`
Expected: tsc clean; lint with only the 2 known pre-existing errors; all tests green except the 3 pre-existing, unrelated failures in `lib/gocardless/scheduler.test.ts`; build completed.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: proposte dell'assistente nella pagina di categorizzazione, rimosso il vecchio wizard"
```

---

## Manual verification (user)

Not executable by an agent: no real browser nor guaranteed Postgres in the sandbox of agentic sessions, a constant constraint of this project.

- [ ] A merchant already categorized once is assigned on its own at the next sync, without going through "Da categorizzare".
- [ ] The `/categorizza` page correctly groups the variants of the same merchant, and applying a group categorizes all its transactions.
- [ ] The origin badge and the reason for the suggestion match what is expected (rule / history / assistant).
- [ ] Applying creates the rule, which shows up in `/categorie` with a usage count that grows after subsequent syncs.
- [ ] Changing a rule from «Esatta» to «Contiene» while shortening the pattern actually catches the other branches.
- [ ] An income transaction never receives spending-category suggestions, and vice versa.
- [ ] **Without `OLLAMA_BASE_URL` configured**: the page works the same, no errors, no warnings, groups without a suggestion simply stay without one.
- [ ] With Ollama configured and then turned off halfway: same behavior, no blocking of the page.
