# Categorizzazione automatica basata su regole — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire il match esatto all'import e il wizard uno-per-uno con un sistema di regole merchant apprese dalle conferme dell'utente, ispezionabili e modificabili, affiancate da proposte mai auto-applicate e da un livello assistente locale opzionale.

**Architecture:** Una chiave merchant normalizzata (rumore bancario e suffissi societari rimossi) è l'unità su cui tutto ruota. Le regole (`merchant` esatta o `contains`) si applicano da sole all'import; tutto ciò che il sistema deduce (similarità, LLM) resta proposta finché l'utente non la applica, e applicare crea la regola. Il livello LLM è isolato dietro un'interfaccia e assente per default.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM + Postgres, Zod, TanStack Query, vitest, shadcn/ui su `@base-ui/react`, Ollama (opzionale, via HTTP).

**Spec:** `docs/superpowers/specs/2026-09-10-categorizzazione-regole-design.md`

## Global Constraints

- **Il sistema non applica mai ciò che deduce.** Solo le regole (create o confermate dall'utente) scrivono in autonomia. Similarità e LLM producono esclusivamente proposte.
- **Nessun modello collegato è uno stato normale, non un guasto.** Senza `OLLAMA_BASE_URL` il livello assistente non esiste: nessun errore, nessun log di allarme, nessun avviso in UI. L'app non deve mai degradare sotto il comportamento puramente deterministico.
- **Guard di direzione obbligatorio ovunque** si scelga una categoria: una categoria `entrata` vale solo per importi positivi, una categoria non-`entrata` solo per importi negativi. La categoria fallback (`isFallback`) accetta entrambi i segni. Stesso invariante già imposto da `PATCH /api/transactions/[id]`.
- **Ownership IDOR-safe su ogni endpoint**: ogni `id` che arriva dal client va verificato contro `userId` della sessione prima dell'uso, con lo stesso pattern di `app/api/categories/[id]/route.ts`.
- **Tutte le stringhe visibili all'utente in italiano.** Nessun colore esadecimale o raggio hardcoded: solo token del tema.
- **JSDoc di una riga** su ogni funzione e componente pubblico, come da `CLAUDE.md`.
- **Test con vitest**, file accanto al modulo (`nome.test.ts`), come `lib/calc/expenses.test.ts`.
- Commit frequenti, uno per task, in italiano, prefisso `feat:` / `fix:` / `test:` / `docs:`.

## Struttura dei file

**Nuovi:**

| File | Responsabilità |
|---|---|
| `lib/categorization/merchant-key.ts` | Normalizzazione descrizione → chiave merchant; tokenizzazione per similarità |
| `lib/db/schema/categorization-rules.ts` | Tabella `categorization_rules` + enum |
| `lib/categorization/match-rule.ts` | Selezione della regola vincente (puro, senza DB) |
| `lib/categorization/fallback.ts` | Categoria fallback risolta per flag `isFallback` |
| `lib/categorization/resolve.ts` | Pipeline con accesso DB, usata dal sync |
| `lib/categorization/suggest.ts` | Cascata delle proposte + raggruppamento per merchant |
| `lib/categorization/llm/index.ts` | Interfaccia `CategorySuggester` + `getSuggester()` |
| `lib/categorization/llm/ollama.ts` | Implementazione Ollama |
| `lib/validation/categorization-rules.ts` | Schemi Zod di regole e apply batch |
| `lib/queries/categorization.ts` | Hook TanStack per proposte, apply e regole |
| `lib/db/backfill-categorization-rules.ts` | Script one-shot di popolamento iniziale |
| `app/api/transactions/categorize-apply/route.ts` | Applicazione batch atomica |
| `app/api/transactions/categorize-suggestions/ai/route.ts` | Proposte dell'assistente |
| `app/api/categorization-rules/route.ts` + `[id]/route.ts` | CRUD regole |
| `app/(app)/categorizza/page.tsx` | Pagina di revisione raggruppata |
| `components/domain/categorization/*` | Componenti della pagina di revisione e della gestione regole |

**Modificati:** `lib/db/schema/index.ts`, `lib/gocardless/sync.ts`, `lib/gocardless/categorize.ts` (svuotato/rimosso), `app/api/transactions/categorize-suggestions/route.ts`, `app/(app)/categorie/page.tsx`, `components/domain/expenses/auto-categorize-button.tsx`.

---

### Task 1: Chiave merchant normalizzata

**Files:**
- Create: `lib/categorization/merchant-key.ts`
- Test: `lib/categorization/merchant-key.test.ts`

**Interfaces:**
- Consumes: niente (primo task)
- Produces: `merchantKey(description: string): string`, `merchantKeyTokens(key: string): Set<string>`, `jaccardSimilarity(a: Set<string>, b: Set<string>): number`, `MERCHANT_NOISE_TOKENS`, `COMPANY_SUFFIX_TOKENS`

- [ ] **Step 1: Scrivi i test che falliscono**

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

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `pnpm exec vitest run lib/categorization/merchant-key.test.ts`
Expected: FAIL — "Failed to resolve import ./merchant-key"

- [ ] **Step 3: Implementa il modulo**

```ts
// lib/categorization/merchant-key.ts

/**
 * Token di rumore bancario: parole che compaiono nelle descrizioni di movimento senza
 * identificare il merchant. Rimuoverle è ciò che impedisce a "PAGAMENTO POS" di far
 * sembrare simili due esercenti del tutto scorrelati.
 */
export const MERCHANT_NOISE_TOKENS: ReadonlySet<string> = new Set([
  "pagamento", "pagam", "pag", "pos", "carta", "cartasi", "acquisto", "addebito",
  "accredito", "bonifico", "sepa", "sdd", "rid", "rif", "cod", "codice", "operazione",
  "oper", "ricarica", "prelievo", "prelevamento", "bancomat", "contactless", "ecommerce",
  "internet", "online", "data", "ore", "del", "il", "su", "presso", "c", "spa", "eur",
]);

/** Suffissi di forma societaria: non distinguono un merchant da un altro. */
export const COMPANY_SUFFIX_TOKENS: ReadonlySet<string> = new Set([
  "spa", "srl", "srls", "sas", "snc", "spa", "sp", "ltd", "limited", "inc", "llc",
  "bv", "nv", "gmbh", "ag", "sa", "plc", "co",
]);

/** Descrizione ridotta a minuscolo, senza diacritici, con punteggiatura sostituita da spazi. */
function normalize(description: string): string {
  return description
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Chiave stabile che identifica un merchant a partire dalla descrizione di una transazione:
 * rimuove diacritici, punteggiatura, token puramente numerici, rumore bancario e suffissi
 * societari. Se dopo la pulizia non resta nulla di significativo (descrizione di solo rumore
 * o solo numeri) ricade sulla descrizione normalizzata, per non collassare movimenti diversi
 * su una chiave vuota condivisa.
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

/** Insieme dei token di una chiave merchant, per il confronto di similarità. */
export function merchantKeyTokens(key: string): Set<string> {
  return new Set(key.split(" ").filter((token) => token.length > 0));
}

/** Indice di Jaccard tra due insiemi di token: |intersezione| / |unione|; 0 se uno dei due è vuoto. */
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

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `pnpm exec vitest run lib/categorization/merchant-key.test.ts`
Expected: PASS, 12 test

- [ ] **Step 5: Commit**

```bash
git add lib/categorization/merchant-key.ts lib/categorization/merchant-key.test.ts
git commit -m "feat: chiave merchant normalizzata per la categorizzazione"
```

---

### Task 2: Tabella delle regole

**Files:**
- Create: `lib/db/schema/categorization-rules.ts`
- Modify: `lib/db/schema/index.ts`

**Interfaces:**
- Consumes: niente
- Produces: `categorizationRules`, `ruleMatchTypeEnum`, `ruleSourceEnum`, tipi `CategorizationRule` / `NewCategorizationRule`, costanti `RULE_MATCH_TYPES` / `RULE_SOURCES`

- [ ] **Step 1: Crea lo schema**

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
 * Regola di categorizzazione: associa un pattern (già normalizzato con `merchantKey`) a una
 * categoria. È l'unica memoria che scrive in autonomia all'import — nasce da una conferma
 * esplicita dell'utente (`appresa`) o dalla pagina di gestione (`manuale`), mai da una deduzione.
 */
export const categorizationRules = pgTable(
  "categorization_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    matchType: ruleMatchTypeEnum("match_type").notNull(),
    // Pattern già normalizzato: confrontato con merchantKey(description), mai con il testo grezzo.
    pattern: text("pattern").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    // Quota "Dividi" da riproporre come frazione dell'importo (0-1); null = nessuno split.
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

- [ ] **Step 2: Esporta dal barrel**

In `lib/db/schema/index.ts`, aggiungi in fondo:

```ts
export * from "./categorization-rules";
```

- [ ] **Step 3: Applica lo schema al database**

Run: `pnpm db:push`

Expected: la tabella `categorization_rules` e i due enum vengono creati.

**Se `db:push` fallisce** per il vincolo unique pre-esistente già noto (log del 2026-07-27): **fermati e segnala al controller invece di aggirarlo con un `ALTER TABLE` diretto.** Qui in gioco c'è una tabella intera, non due colonne: un fix non versionato si perderebbe al prossimo reset del DB condiviso, esattamente come è successo a `raw_description`/`note`.

- [ ] **Step 4: Verifica che la tabella esista davvero**

Run:
```bash
pnpm exec tsx --env-file=.env.local -e "import('./lib/db/client').then(async ({db}) => { const r = await db.execute(\"select column_name from information_schema.columns where table_name='categorization_rules'\"); console.log(r); process.exit(0); })"
```
Expected: elenco delle 10 colonne. Non fidarti dell'output di `db:push`: verifica in prima persona.

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema/categorization-rules.ts lib/db/schema/index.ts
git commit -m "feat: tabella categorization_rules"
```

---

### Task 3: Selezione della regola vincente (puro)

**Files:**
- Create: `lib/categorization/match-rule.ts`
- Test: `lib/categorization/match-rule.test.ts`

**Interfaces:**
- Consumes: `merchantKey` (Task 1)
- Produces: `RuleCandidate`, `selectMatchingRule(key: string, isIncome: boolean, rules: RuleCandidate[]): RuleCandidate | null`, `isDirectionCompatible(categoryType, isIncome, isFallback): boolean`

- [ ] **Step 1: Scrivi i test che falliscono**

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

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `pnpm exec vitest run lib/categorization/match-rule.test.ts`
Expected: FAIL — "Failed to resolve import ./match-rule"

- [ ] **Step 3: Implementa il modulo**

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
 * Una categoria è utilizzabile per una transazione solo se la sua direzione coincide: le categorie
 * `entrata` valgono per gli importi positivi, le altre per i negativi. La categoria fallback non ha
 * direzione propria e accoglie entrambi i segni — stesso invariante imposto da PATCH /api/transactions/[id].
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
 * Regola vincente per una chiave merchant, valutando prima le regole `merchant` sulla corrispondenza
 * esatta e poi le `contains` come sottostringa (a più match vince il pattern più lungo, cioè il più
 * specifico; a pari lunghezza la regola più recente). Le regole incompatibili con la direzione della
 * transazione vengono saltate senza interrompere la valutazione. `null` se nessuna regola si applica.
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

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `pnpm exec vitest run lib/categorization/match-rule.test.ts`
Expected: PASS, 15 test

- [ ] **Step 5: Commit**

```bash
git add lib/categorization/match-rule.ts lib/categorization/match-rule.test.ts
git commit -m "feat: selezione della regola di categorizzazione vincente"
```

---

### Task 4: Pipeline di risoluzione e aggancio al sync

**Files:**
- Create: `lib/categorization/fallback.ts`, `lib/categorization/resolve.ts`
- Modify: `lib/gocardless/sync.ts:70` e `:83`, `lib/gocardless/categorize.ts` (rimosso), `lib/gocardless/categorize.test.ts` (rimosso)
- Test: `lib/categorization/resolve.test.ts`

**Interfaces:**
- Consumes: `merchantKey` (Task 1), `categorizationRules` (Task 2), `selectMatchingRule` / `RuleCandidate` (Task 3)
- Produces: `getFallbackCategoryId(userId: string): Promise<string>`, `resolveCategorization(userId: string, input: { description: string; amount: number }): Promise<ResolvedCategorization | null>` con `ResolvedCategorization = { categoryId: string; excludedAmount: number; ruleId: string }`

- [ ] **Step 1: Crea il modulo fallback**

Chiude il debito tecnico aperto il 2026-07-21: la fallback si risolve per flag `isFallback`, non più per nome letterale.

```ts
// lib/categorization/fallback.ts
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema/categories";

export const FALLBACK_CATEGORY_NAME = "Da categorizzare";

/**
 * Id della categoria di fallback dell'utente, risolta per flag `isFallback` (non per nome: il nome
 * è solo il default alla creazione). Creata al volo se non esiste ancora.
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

- [ ] **Step 2: Scrivi i test di integrazione che falliscono**

I test toccano il DB reale, come già fa `lib/gocardless/categorize.test.ts`. Leggi quel file prima di scrivere, per riusare lo stesso schema di setup/teardown (creazione utente, categorie e conto di prova, cleanup in `afterEach`).

```ts
// lib/categorization/resolve.test.ts — struttura richiesta, completa il setup sul modello di
// lib/gocardless/categorize.test.ts (creazione authUser + categorie + cleanup)
import { describe, expect, it } from "vitest";
import { resolveCategorization } from "./resolve";

describe("resolveCategorization", () => {
  it("ritorna null quando l'utente non ha regole", async () => {
    // ... setup utente senza regole
    expect(await resolveCategorization(userId, { description: "ESSELUNGA VIA ROMA", amount: -30 })).toBeNull();
  });

  it("applica una regola merchant sulla chiave normalizzata, non sul testo grezzo", async () => {
    // regola: matchType "merchant", pattern "esselunga via roma", categoria spesa
    const result = await resolveCategorization(userId, {
      description: "PAGAMENTO POS ESSELUNGA SPA VIA ROMA COD.4471",
      amount: -30,
    });
    expect(result?.categoryId).toBe(spesaCategoryId);
  });

  it("incrementa hitCount e aggiorna lastAppliedAt quando una regola vince", async () => {
    await resolveCategorization(userId, { description: "ESSELUNGA VIA ROMA", amount: -30 });
    // rileggi la regola dal DB
    expect(rule.hitCount).toBe(1);
    expect(rule.lastAppliedAt).not.toBeNull();
  });

  it("non applica una regola di categoria entrata a una spesa", async () => {
    // regola su categoria "entrata" con pattern "stipendio acme"
    expect(await resolveCategorization(userId, { description: "STIPENDIO ACME", amount: -50 })).toBeNull();
  });

  it("deriva excludedAmount dallo splitPercentage della regola col segno dell'importo", async () => {
    // regola con splitPercentage 0.5 su una spesa di 30
    const result = await resolveCategorization(userId, { description: "AFFITTO CASA", amount: -30 });
    expect(result?.excludedAmount).toBe(-15);
  });

  it("ritorna excludedAmount 0 quando la regola non ha splitPercentage", async () => {
    const result = await resolveCategorization(userId, { description: "ESSELUNGA VIA ROMA", amount: -30 });
    expect(result?.excludedAmount).toBe(0);
  });

  it("non vede le regole di un altro utente", async () => {
    // regola creata su otherUserId con lo stesso pattern
    expect(await resolveCategorization(userId, { description: "ESSELUNGA VIA ROMA", amount: -30 })).toBeNull();
  });
});
```

- [ ] **Step 3: Esegui i test e verifica che falliscano**

Run: `pnpm exec vitest run lib/categorization/resolve.test.ts`
Expected: FAIL — "Failed to resolve import ./resolve"

Se il DB non è raggiungibile (ECONNREFUSED), **fermati e segnalalo al controller**: non riscrivere i test per evitare il database.

- [ ] **Step 4: Implementa la pipeline**

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

/** Regole dell'utente con i dati di categoria necessari al guard di direzione. */
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

/**
 * Categoria da assegnare a una transazione in import, secondo le sole regole dell'utente: prima la
 * regola `merchant` sulla chiave esatta, poi la `contains` più specifica. `null` quando nessuna regola
 * si applica — il chiamante ricade sulla categoria di fallback. Non deduce mai nulla: le proposte per
 * somiglianza e assistente vivono in `suggest.ts` e non scrivono.
 */
export async function resolveCategorization(
  userId: string,
  input: { description: string; amount: number }
): Promise<ResolvedCategorization | null> {
  const rules = await loadRuleCandidates(userId);
  if (rules.length === 0) return null;

  const key = merchantKey(input.description);
  const isIncome = input.amount > 0;
  const rule = selectMatchingRule(key, isIncome, rules);
  if (!rule) return null;

  await db
    .update(categorizationRules)
    .set({ hitCount: sql`${categorizationRules.hitCount} + 1`, lastAppliedAt: new Date() })
    .where(eq(categorizationRules.id, rule.id));

  const magnitude =
    rule.splitPercentage === null
      ? 0
      : Math.round(Math.abs(input.amount) * rule.splitPercentage * 100) / 100;

  return {
    categoryId: rule.categoryId,
    excludedAmount: input.amount >= 0 ? magnitude : -magnitude,
    ruleId: rule.id,
  };
}
```

- [ ] **Step 5: Esegui i test e verifica che passino**

Run: `pnpm exec vitest run lib/categorization/resolve.test.ts`
Expected: PASS

- [ ] **Step 6: Aggancia il sync**

In `lib/gocardless/sync.ts`, sostituisci l'import a riga 8:

```ts
import { getFallbackCategoryId } from "@/lib/categorization/fallback";
import { resolveCategorization } from "@/lib/categorization/resolve";
```

e il corpo del loop (riga ~83), dove oggi c'è `const categoryId = await resolveCategoryId(link.userId, description);`:

```ts
      const amount = Number(bankTransaction.transactionAmount.amount);
      const resolved = await resolveCategorization(link.userId, { description, amount });
      const categoryId = resolved?.categoryId ?? fallbackCategoryId;
```

e nell'oggetto passato a `.values({...})` aggiungi, subito dopo `amount`:

```ts
          excludedAmount: (resolved?.excludedAmount ?? 0).toFixed(2),
```

`fallbackCategoryId` è già calcolato a riga ~70 prima del loop: riusalo, non richiamare la funzione dentro il ciclo.

- [ ] **Step 7: Elimina il vecchio modulo**

```bash
git rm lib/gocardless/categorize.ts lib/gocardless/categorize.test.ts
```

Poi verifica che nessun altro file lo importi:

Run: `grep -rn "gocardless/categorize\|resolveCategoryId" --include=*.ts --include=*.tsx . | grep -v node_modules`
Expected: nessun risultato.

- [ ] **Step 8: Verifica la suite e i tipi**

Run: `pnpm tsc --noEmit && pnpm exec vitest run lib/categorization lib/gocardless`
Expected: tsc pulito; i test di `lib/gocardless/scheduler.test.ts` possono avere 3 fallimenti pre-esistenti e non correlati, già noti dal log — tutto il resto deve passare.

- [ ] **Step 9: Commit**

```bash
git add -A lib/categorization lib/gocardless
git commit -m "feat: pipeline di categorizzazione a regole nel sync GoCardless"
```

---

### Task 5: Popolamento iniziale delle regole

**Files:**
- Create: `lib/db/backfill-categorization-rules.ts`
- Test: `lib/db/backfill-categorization-rules.test.ts`

**Interfaces:**
- Consumes: `merchantKey` (Task 1), `categorizationRules` (Task 2)
- Produces: `buildRulesFromHistory(transactions, categoriesById): NewRuleSeed[]` (puro, testabile senza DB) con `NewRuleSeed = { pattern: string; categoryId: string; splitPercentage: number | null }`, e `backfillCategorizationRules(userId): Promise<number>`

- [ ] **Step 1: Scrivi i test della funzione pura**

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

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `pnpm exec vitest run lib/db/backfill-categorization-rules.test.ts`
Expected: FAIL — modulo inesistente

- [ ] **Step 3: Implementa lo script**

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

/** Quota esclusa come frazione dell'importo, arrotondata per confrontare transazioni di importo diverso. */
function splitPercentageOf(transaction: HistoryTransaction): number {
  const amount = Math.abs(Number(transaction.amount));
  if (amount === 0) return 0;
  return Math.round((Math.abs(Number(transaction.excludedAmount)) / amount) * 10000) / 10000;
}

/**
 * Regole `appresa` deducibili dallo storico già categorizzato: una per chiave merchant, con la
 * categoria più frequente (pareggio risolto sulla transazione più recente) e lo split riproposto solo
 * se coerente su tutte le transazioni della categoria vincente.
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
 * Popola le regole `appresa` di un utente a partire dal suo storico già categorizzato (categorie di
 * fallback escluse). Idempotente: le regole già presenti sullo stesso pattern non vengono duplicate.
 * Ritorna il numero di regole create.
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

/** Esecuzione da riga di comando: popola le regole di tutti gli utenti e stampa il conteggio. */
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

Nota: `and` è importato per coerenza con gli altri script del progetto ma non serve qui — rimuovilo se ESLint segnala l'import inutilizzato.

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `pnpm exec vitest run lib/db/backfill-categorization-rules.test.ts`
Expected: PASS, 5 test

- [ ] **Step 5: Esegui davvero il backfill e riporta il conteggio**

Run: `pnpm exec tsx --env-file=.env.local lib/db/backfill-categorization-rules.ts`

**Riporta il numero di regole create nel report del task.** Un backfill scritto e mai lanciato è l'errore del 2026-07-22 con `backfill-category-appearance.ts`: il codice risultava completo e i dati sono rimasti incoerenti per settimane. Se il DB non è raggiungibile, dichiaralo esplicitamente come passo non eseguito invece di darlo per fatto.

- [ ] **Step 6: Commit**

```bash
git add lib/db/backfill-categorization-rules.ts lib/db/backfill-categorization-rules.test.ts
git commit -m "feat: backfill delle regole di categorizzazione dallo storico"
```

---

### Task 6: Motore delle proposte

**Files:**
- Create: `lib/categorization/suggest.ts`
- Test: `lib/categorization/suggest.test.ts`
- Delete: `lib/calc/categorize-suggestions.ts`, `lib/calc/categorize-suggestions.test.ts` (dopo il Task 7, che ne è l'ultimo consumatore — qui si crea solo il sostituto)

**Interfaces:**
- Consumes: `merchantKey`, `merchantKeyTokens`, `jaccardSimilarity` (Task 1), `isDirectionCompatible` (Task 3)
- Produces:
  - `type SuggestionSource = "regola" | "storico" | "assistente"`
  - `interface CategorizeSuggestion { transactionId: string; merchantKey: string; suggestedCategoryId: string; source: SuggestionSource; confidence: number; reason: string; suggestedSplitPercentage: number | null }`
  - `interface SuggestionGroup { merchantKey: string; label: string; transactionIds: string[]; totalAmount: number; suggestion: CategorizeSuggestion | null; hasDivergentSuggestions: boolean }`
  - `computeSuggestions(input: SuggestInput): CategorizeSuggestion[]`
  - `groupByMerchant(uncategorized: SuggestTransaction[], suggestions: CategorizeSuggestion[]): SuggestionGroup[]`

- [ ] **Step 1: Scrivi i test che falliscono**

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

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `pnpm exec vitest run lib/categorization/suggest.test.ts`
Expected: FAIL — modulo inesistente

- [ ] **Step 3: Implementa il motore**

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

/** Quota esclusa come frazione dell'importo, arrotondata per confronti fra importi diversi. */
function splitPercentageOf(transaction: SuggestTransaction): number {
  const amount = Math.abs(transaction.amount);
  if (amount === 0) return 0;
  return Math.round((Math.abs(transaction.excludedAmount) / amount) * 10000) / 10000;
}

/** Una categoria è proponibile solo se esiste, non è la fallback e ha la direzione giusta. */
function canSuggest(categoryId: string, isIncome: boolean, categories: SuggestCategory[]): boolean {
  const category = categories.find((c) => c.id === categoryId);
  if (!category || category.isFallback) return false;
  return isDirectionCompatible(category.type, isIncome, false);
}

/** Proposta ricavata dalla regola più simile alla chiave della transazione, se sopra soglia. */
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

/** Proposta ricavata dalle transazioni passate con chiave merchant simile. */
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
 * Proposte per le transazioni ancora da categorizzare, in cascata: prima la somiglianza con una regola
 * esistente, poi quella con lo storico già categorizzato. Ogni transazione riceve al massimo una
 * proposta, dalla prima sorgente che ne produce una. Non scrive nulla: il livello assistente si innesta
 * a valle, sulle transazioni rimaste senza proposta.
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
 * Transazioni da categorizzare raccolte per chiave merchant, così che una scelta sola ne categorizzi
 * molte. Il gruppo eredita la proposta di sorgente più alta fra quelle delle sue transazioni (a pari
 * sorgente, la confidenza maggiore) e segnala se al suo interno convivono proposte di categorie diverse.
 * Ordinati per numerosità decrescente: i gruppi che fanno risparmiare più lavoro stanno in cima.
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

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `pnpm exec vitest run lib/categorization/suggest.test.ts`
Expected: PASS, 12 test

- [ ] **Step 5: Commit**

```bash
git add lib/categorization/suggest.ts lib/categorization/suggest.test.ts
git commit -m "feat: motore delle proposte di categorizzazione con raggruppamento per merchant"
```

---

### Task 7: Endpoint delle proposte

**Files:**
- Modify: `app/api/transactions/categorize-suggestions/route.ts`, `app/api/transactions/categorize-suggestions/route.test.ts`
- Delete: `lib/calc/categorize-suggestions.ts`, `lib/calc/categorize-suggestions.test.ts`

**Interfaces:**
- Consumes: `computeSuggestions`, `groupByMerchant`, tipi da `suggest.ts` (Task 6); `categorizationRules` (Task 2)
- Produces: risposta `{ groups: SuggestionGroup[] }` da `GET /api/transactions/categorize-suggestions`

- [ ] **Step 1: Aggiorna i test dell'endpoint**

Leggi `app/api/transactions/categorize-suggestions/route.test.ts` e adatta il setup esistente. I casi richiesti:

```ts
it("risponde 401 senza sessione", async () => { /* come nel test esistente */ });

it("raggruppa le transazioni da categorizzare per chiave merchant", async () => {
  // due transazioni fallback con descrizioni diverse ma stessa chiave
  const response = await GET(request);
  const { groups } = await response.json();
  expect(groups).toHaveLength(1);
  expect(groups[0].transactionIds).toHaveLength(2);
});

it("include la proposta ricavata da una regola esistente", async () => {
  // regola merchant "esselunga via roma" -> categoria spesa
  const { groups } = await (await GET(request)).json();
  expect(groups[0].suggestion.source).toBe("regola");
});

it("non include le transazioni di altri utenti", async () => {
  // transazione fallback creata su otherUserId
  const { groups } = await (await GET(request)).json();
  expect(groups).toEqual([]);
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `pnpm exec vitest run app/api/transactions/categorize-suggestions/route.test.ts`
Expected: FAIL — la risposta è ancora un array piatto di suggerimenti, non `{ groups }`

- [ ] **Step 3: Riscrivi l'endpoint**

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

/** Transazione del DB nella forma attesa dal motore delle proposte (numeri già convertiti). */
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
 * GET /api/transactions/categorize-suggestions — transazioni ancora sulla categoria di fallback,
 * raggruppate per chiave merchant, ciascuna con l'eventuale proposta ricavata dalle regole esistenti o
 * dallo storico già categorizzato. Non interroga mai l'assistente (endpoint `ai` dedicato), quindi la
 * risposta non dipende dalla disponibilità di un modello.
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

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `pnpm exec vitest run app/api/transactions/categorize-suggestions/route.test.ts`
Expected: PASS

- [ ] **Step 5: Elimina il vecchio motore e il wizard che lo consuma**

```bash
git rm lib/calc/categorize-suggestions.ts lib/calc/categorize-suggestions.test.ts components/domain/expenses/auto-categorize-wizard.tsx
```

Il wizard va rimosso **qui e non più tardi**: consuma il vecchio tipo `CategorizeSuggestion`, che aveva la forma `{ transaction: Transaction, ... }` mentre il nuovo espone `transactionId`. Non è un import da riappuntare, è un tipo incompatibile — tenerlo in vita romperebbe `tsc` fino al Task 13.

Di conseguenza, in `components/domain/expenses/auto-categorize-button.tsx` sostituisci l'apertura del wizard con un `Link` a `/categorizza` (testo invariato: «Categorizza automaticamente»), e togli le righe di export del wizard da `components/domain/expenses/index.ts`.

**La rotta `/categorizza` non esiste ancora**: nasce al Task 9. Fra questo task e quello il bottone porta a un 404 — accettabile dentro il branch di lavoro, ma è la ragione per cui il Task 9 non va saltato né rinviato oltre.

Run: `pnpm tsc --noEmit && grep -rn "AutoCategorizeWizard\|calc/categorize-suggestions" --include=*.ts --include=*.tsx . | grep -v node_modules`
Expected: tsc pulito, nessun riferimento residuo.

- [ ] **Step 6: Commit**

```bash
git add -A app/api/transactions/categorize-suggestions lib/calc components/domain/expenses
git commit -m "feat: endpoint proposte raggruppate per merchant, rimosso il vecchio wizard"
```

---

### Task 8: Applicazione batch atomica

**Files:**
- Create: `lib/validation/categorization-rules.ts`, `lib/validation/categorization-rules.test.ts`, `app/api/transactions/categorize-apply/route.ts`, `app/api/transactions/categorize-apply/route.test.ts`

**Interfaces:**
- Consumes: `categorizationRules` (Task 2), `merchantKey` (Task 1), `isDirectionCompatible` (Task 3)
- Produces: `applyCategorizationSchema` / `ApplyCategorizationInput` con forma `{ groups: { transactionIds: string[]; categoryId: string; excludedPercentage: number; createRule: boolean; merchantKey: string }[] }`; risposta `{ applied: number; rulesCreated: number }`

- [ ] **Step 1: Scrivi lo schema Zod e i suoi test**

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
        // Quota esclusa come frazione dell'importo (0-1), applicata a ogni transazione del gruppo.
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

- [ ] **Step 2: Esegui i test dello schema**

Run: `pnpm exec vitest run lib/validation/categorization-rules.test.ts`
Expected: PASS, 7 test

- [ ] **Step 3: Scrivi i test dell'endpoint che falliscono**

Modella il setup su `app/api/transactions/[id]/route.test.ts`. Casi richiesti:

```ts
it("risponde 401 senza sessione", async () => { /* ... */ });

it("categorizza tutte le transazioni del gruppo in una sola chiamata", async () => {
  // 3 transazioni fallback, un gruppo, categoria spesa
  const response = await POST(request);
  expect(await response.json()).toMatchObject({ applied: 3 });
  // rileggi le 3 transazioni: tutte sulla categoria spesa
});

it("crea la regola merchant quando createRule è true", async () => {
  const { rulesCreated } = await (await POST(request)).json();
  expect(rulesCreated).toBe(1);
  // la regola ha matchType "merchant", pattern uguale al merchantKey inviato, source "appresa"
});

it("non crea la regola quando createRule è false", async () => { /* rulesCreated === 0 */ });

it("aggiorna la regola esistente invece di duplicarla", async () => {
  // applica due volte lo stesso merchantKey con categorie diverse
  // -> una sola regola, con la categoria della seconda applicazione
});

it("applica la quota esclusa proporzionalmente a ogni transazione del gruppo", async () => {
  // due transazioni da -100 e -50, excludedPercentage 0.5
  // -> excludedAmount -50 e -25
});

it("rifiuta con 400 una categoria incompatibile con la direzione di una transazione del gruppo", async () => {
  // gruppo con una spesa, categoria di tipo entrata
  expect((await POST(request)).status).toBe(400);
});

it("non applica niente se una sola transazione del gruppo non è dell'utente", async () => {
  // gruppo con 2 transazioni proprie + 1 di un altro utente
  expect((await POST(request)).status).toBe(404);
  // le 2 transazioni proprie NON devono risultare modificate: la scrittura è atomica
});
```

- [ ] **Step 4: Esegui i test e verifica che falliscano**

Run: `pnpm exec vitest run app/api/transactions/categorize-apply/route.test.ts`
Expected: FAIL — route inesistente

- [ ] **Step 5: Implementa l'endpoint**

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
 * POST /api/transactions/categorize-apply — applica in blocco le scelte fatte nella pagina di
 * revisione: aggiorna categoria e quota esclusa di ogni transazione dei gruppi ricevuti e, dove
 * richiesto, crea o aggiorna la regola `appresa` corrispondente. Tutto in un'unica transazione DB:
 * o passa l'intero batch, o non passa nulla.
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

  // Guard di direzione su ogni transazione prima di scrivere: un solo caso incompatibile invalida
  // l'intero batch, invece di lasciare metà lavoro applicato.
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

      // Distinzione fra creazione e aggiornamento: su un insert entrambe le colonne prendono il
      // `now()` della transazione Postgres e coincidono; su un conflitto `updatedAt` riceve il
      // `new Date()` di JS, sempre diverso da `createdAt`. Se questo confronto si rivelasse fragile
      // in test, sostituiscilo con una SELECT preventiva dei pattern già esistenti.
      if (rule && rule.createdAt.getTime() === rule.updatedAt.getTime()) rulesCreated += 1;
    }
  });

  return Response.json({ applied, rulesCreated });
}
```

- [ ] **Step 6: Esegui i test e verifica che passino**

Run: `pnpm exec vitest run app/api/transactions/categorize-apply/route.test.ts lib/validation/categorization-rules.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/validation/categorization-rules.ts lib/validation/categorization-rules.test.ts app/api/transactions/categorize-apply
git commit -m "feat: applicazione batch atomica della categorizzazione"
```

---

### Task 9: Hook client e pagina di revisione

**Files:**
- Create: `lib/queries/categorization.ts`, `app/(app)/categorizza/page.tsx`, `components/domain/categorization/categorize-group-row.tsx`, `components/domain/categorization/index.ts`
- Modify: `components/domain/expenses/auto-categorize-button.tsx`

**Interfaces:**
- Consumes: `SuggestionGroup` (Task 6), endpoint dei Task 7 e 8
- Produces: `useCategorizeSuggestionsQuery()`, `useApplyCategorizationMutation()`, componente `CategorizeGroupRow`

- [ ] **Step 1: Crea gli hook**

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

/** Gruppi di transazioni da categorizzare con le relative proposte da regole e storico. */
export function useCategorizeSuggestionsQuery() {
  return useQuery({ queryKey: SUGGESTIONS_QUERY_KEY, queryFn: fetchSuggestions });
}

/** Applica in blocco le scelte di categorizzazione e invalida proposte e transazioni al successo. */
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

Verifica la chiave esatta usata da `lib/queries/transactions.ts` e usa quella al posto di `["transactions"]` se differisce.

- [ ] **Step 2: Crea la riga di gruppo**

`components/domain/categorization/categorize-group-row.tsx`: componente controllato, nessuno stato proprio se non l'espansione. Props:

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

Requisiti di resa:

- Checkbox di selezione, etichetta del gruppo (`group.label`) e conteggio (`«7 transazioni»`, singolare corretto a 1), importo totale con `formatCurrency`.
- `Select` categoria filtrato per direzione, con `CategoryAvatar` e la render-prop dentro `SelectValue` — **obbligatoria** con `@base-ui/react`, altrimenti compare l'id grezzo (bug già capitato nel progetto). Copia il pattern da `auto-categorize-wizard.tsx:90-125`.
- La direzione del gruppo si deduce dal segno di `group.totalAmount`.
- Badge dell'origine della proposta: `Regola simile` / `Storico` / `Assistente`, con la percentuale di confidenza e `group.suggestion.reason` come testo secondario. Nessun badge se `suggestion` è `null`.
- Se `group.hasDivergentSuggestions`, una riga di avviso: «Le transazioni di questo gruppo avevano proposte diverse — controlla prima di applicare».
- Controllo split collassato dietro un toggle, riusando `SplitSlider` se le props lo permettono, altrimenti uno `Slider` 0-100%.
- Espansione che elenca le singole descrizioni del gruppo.

Tieni il file sotto ~150 righe di JSX; se cresce, estrai il badge in un sotto-componente.

- [ ] **Step 3: Crea la pagina**

`app/(app)/categorizza/page.tsx`: client component che orchestra, senza logica di business (regola di `CLAUDE.md`: niente calcoli nelle route).

- Stato locale: `Map<merchantKey, { selected, categoryId, excludedPercentage }>`, inizializzata dalle proposte quando arrivano i dati.
- Testata: titolo «Categorizza», sottotitolo col numero di transazioni in attesa, link di ritorno a Transazioni.
- Barra azioni: «Seleziona tutto» / «Deseleziona tutto», bottone **«Applica selezionate (N)»** disabilitato a N = 0 o durante la mutation.
- Stato di caricamento con skeleton, stato vuoto («Nessuna transazione da categorizzare»), errore della mutation visibile in pagina.
- Al successo: toast `sonner` con «N transazioni categorizzate, M regole create».
- Nessun gruppo viene selezionato d'ufficio: la selezione è una scelta esplicita dell'utente.

- [ ] **Step 4: Verifica che il bottone porti davvero alla pagina**

Il `Link` a `/categorizza` è già stato messo al Task 7: qui la rotta esiste finalmente, quindi controlla che il percorso combaci con la cartella creata (`app/(app)/categorizza/page.tsx` → `/categorizza`, il route group `(app)` non compare nell'URL).

- [ ] **Step 5: Verifica tipi, lint e build**

Run: `pnpm tsc --noEmit && pnpm lint && pnpm build`
Expected: tsc pulito; lint con i soli 2 errori `react-hooks/set-state-in-effect` pre-esistenti e già noti (`theme-toggle.tsx`, `CategoryLegendRow`), nessuno nuovo; build completata.

- [ ] **Step 6: Commit**

```bash
git add lib/queries/categorization.ts app/\(app\)/categorizza components/domain/categorization components/domain/expenses/auto-categorize-button.tsx
git commit -m "feat: pagina di revisione della categorizzazione raggruppata per merchant"
```

---

### Task 10: CRUD delle regole

**Files:**
- Create: `app/api/categorization-rules/route.ts`, `app/api/categorization-rules/route.test.ts`, `app/api/categorization-rules/[id]/route.ts`, `app/api/categorization-rules/[id]/route.test.ts`
- Modify: `lib/queries/categorization.ts`

**Interfaces:**
- Consumes: `createRuleSchema` / `updateRuleSchema` (Task 8), `merchantKey` (Task 1)
- Produces: `useCategorizationRulesQuery()`, `useCreateRuleMutation()`, `useUpdateRuleMutation()`, `useDeleteRuleMutation()`

- [ ] **Step 1: Scrivi i test che falliscono**

Casi richiesti, con il pattern di ownership di `app/api/categories/[id]/route.test.ts`:

```ts
// route.test.ts (collezione)
it("risponde 401 senza sessione", async () => { /* ... */ });
it("elenca solo le regole dell'utente autenticato", async () => { /* ... */ });
it("crea una regola normalizzando il pattern con merchantKey", async () => {
  // POST con pattern "ESSELUNGA SPA" -> la regola salvata ha pattern "esselunga"
});
it("rifiuta con 404 una categoria di un altro utente", async () => { /* ... */ });
it("rifiuta con 409 una regola duplicata su stesso tipo e pattern", async () => { /* ... */ });

// [id]/route.test.ts
it("aggiorna il tipo di match di una regola propria", async () => {
  // PATCH matchType "contains" -> la regola risulta contains
});
it("risponde 404 sulla regola di un altro utente", async () => { /* PATCH e DELETE */ });
it("elimina una regola propria", async () => { /* ... */ });
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `pnpm exec vitest run app/api/categorization-rules`
Expected: FAIL — route inesistenti

- [ ] **Step 3: Implementa gli endpoint**

`GET` restituisce le regole dell'utente ordinate per `hitCount` decrescente, arricchite con il nome della categoria (join su `categories`) perché la UI le deve mostrare.

`POST`: valida con `createRuleSchema`, verifica l'ownership della `categoryId` (404 se non propria), **normalizza il pattern con `merchantKey()` prima di salvare** — un pattern non normalizzato non matcherebbe mai, dato che il confronto avviene sempre su chiavi normalizzate — e imposta `source: "manuale"`. Violazione del vincolo unique → 409 con messaggio «Esiste già una regola con questo pattern».

`PATCH`/`DELETE` in `[id]/route.ts`: recupera la regola solo se `userId` coincide (404 altrimenti), stessa normalizzazione del pattern su update, stessa verifica di ownership sulla nuova `categoryId`.

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `pnpm exec vitest run app/api/categorization-rules`
Expected: PASS

- [ ] **Step 5: Aggiungi gli hook**

In `lib/queries/categorization.ts`, aggiungi `useCategorizationRulesQuery`, `useCreateRuleMutation`, `useUpdateRuleMutation`, `useDeleteRuleMutation` sulla chiave `["categorization-rules"]`, con lo stesso stile di `lib/queries/categories.ts` (invalidazione al successo, messaggio d'errore dal body della risposta). Il tipo di ritorno della query è `CategorizationRule & { categoryName: string }`.

- [ ] **Step 6: Commit**

```bash
git add app/api/categorization-rules lib/queries/categorization.ts
git commit -m "feat: CRUD delle regole di categorizzazione"
```

---

### Task 11: Gestione regole in `/categorie`

**Files:**
- Create: `components/domain/categorization/rules-manager.tsx`
- Modify: `app/(app)/categorie/page.tsx`, `components/domain/categorization/index.ts`

**Interfaces:**
- Consumes: hook del Task 10, `RULE_MATCH_TYPES` (Task 2)
- Produces: componente `RulesManager` con props `{ categories: Category[] }`

- [ ] **Step 1: Costruisci il componente**

`RulesManager` è una `Card` autonoma, montata sotto la gestione categorie esistente. Requisiti:

- Tabella o lista di righe: pattern, badge del tipo di match (`Esatta` per `merchant`, `Contiene` per `contains`), categoria con `CategoryAvatar`, badge origine (`Appresa` / `Manuale`), «usata N volte».
- Modifica in riga: pattern editabile, `Select` categoria, `Select` tipo di match. Salvataggio su blur o su Enter, come già fa `CategoryLegendRow` per il budget.
- Testo esplicativo **breve** sopra la lista: «Le regole si applicano da sole alle nuove transazioni. "Contiene" copre tutte le varianti: cambia `esselunga via roma` in `esselunga` per prendere ogni filiale.»
- Eliminazione con `AlertDialog` di conferma, come già fa «Distribuisci colori».
- Stato vuoto: «Nessuna regola ancora. Le regole nascono quando categorizzi le transazioni dalla pagina Categorizza.»
- Aggiunta manuale di una regola in fondo alla lista (pattern + categoria + tipo).

Tutte le stringhe in italiano, colori solo da token del tema, file sotto ~150 righe di JSX (estrai la riga in un sotto-componente se serve).

- [ ] **Step 2: Montalo nella pagina**

In `app/(app)/categorie/page.tsx`, aggiungi `<RulesManager categories={categories} />` sotto la sezione esistente. Nessuna nuova voce di sidebar.

- [ ] **Step 3: Verifica tipi, lint e build**

Run: `pnpm tsc --noEmit && pnpm lint && pnpm build`
Expected: tsc pulito, nessun errore di lint nuovo, build completata.

- [ ] **Step 4: Commit**

```bash
git add components/domain/categorization app/\(app\)/categorie/page.tsx
git commit -m "feat: gestione delle regole di categorizzazione in Categorie"
```

---

### Task 12: Livello assistente (Ollama)

**Files:**
- Create: `lib/categorization/llm/index.ts`, `lib/categorization/llm/ollama.ts`, `lib/categorization/llm/ollama.test.ts`, `app/api/transactions/categorize-suggestions/ai/route.ts`, `app/api/transactions/categorize-suggestions/ai/route.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `Category` dallo schema, `SuggestTransaction` (Task 6)
- Produces:
  - `interface SuggestInput { index: number; description: string; amount: number }`
  - `interface LlmSuggestion { index: number; categoryName: string; confidence: number }`
  - `interface CategorySuggester { suggest(input: SuggestInput[], categories: Category[]): Promise<LlmSuggestion[]> }`
  - `getSuggester(): CategorySuggester | null`
  - `createOllamaSuggester(baseUrl: string, model: string): CategorySuggester`

- [ ] **Step 1: Scrivi i test che falliscono**

Il vincolo globale «nessun modello collegato è uno stato normale» va **provato**, non solo dichiarato.

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

Aggiungi anche un test di timeout: `fetch` mockata con una promise che non si risolve mai e timer finti, per verificare che dopo 10s la chiamata ritorni `[]`.

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `pnpm exec vitest run lib/categorization/llm/ollama.test.ts`
Expected: FAIL — moduli inesistenti

- [ ] **Step 3: Implementa l'interfaccia e l'implementazione**

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
 * Suggeritore configurato, oppure `null` se nessun modello è collegato. Un modello assente è uno
 * stato normale del prodotto, non un guasto: chi chiama salta semplicemente il livello, senza
 * errori né avvisi all'utente.
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

/** Prompt in un solo blocco: categorie disponibili e transazioni da classificare, senza dati di conto. */
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
 * Suggeritore basato su un'istanza Ollama raggiungibile via HTTP. Qualunque problema — connessione
 * rifiutata, timeout, risposta non conforme, categoria inesistente — si traduce in zero proposte,
 * mai in un errore propagato al chiamante: il livello deterministico non deve mai peggiorare
 * per colpa di questo.
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

`JSON.parse` può lanciare su risposta non-JSON: è dentro il `try`, quindi ricade sul `return []` del `catch`. Non aggiungere un secondo try annidato.

- [ ] **Step 4: Implementa l'endpoint**

`app/api/transactions/categorize-suggestions/ai/route.ts`: `POST`, sessione obbligatoria, riceve `{ transactionIds: string[] }`, verifica l'ownership di tutte le transazioni (404 altrimenti), chiama `getSuggester()`. **Se è `null`, risponde `Response.json({ groups: [] })` con status 200** — non è un errore. Altrimenti costruisce l'input dalle descrizioni normalizzate con `merchantKey`, chiama `suggest`, converte i `categoryName` in `categoryId` scartando i non corrispondenti, applica il guard di direzione e restituisce proposte con `source: "assistente"` e `confidence` dal modello, già raggruppate con `groupByMerchant`.

Test richiesti:

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

- [ ] **Step 5: Documenta la configurazione**

In `.env.example` aggiungi, con il commento:

```bash
# Categorizzazione assistita (opzionale): senza queste variabili il livello è semplicemente spento
# e la categorizzazione resta puramente deterministica (regole + somiglianza).
OLLAMA_BASE_URL=
OLLAMA_MODEL=llama3.2
```

- [ ] **Step 6: Esegui i test e verifica che passino**

Run: `pnpm exec vitest run lib/categorization/llm app/api/transactions/categorize-suggestions`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/categorization/llm app/api/transactions/categorize-suggestions/ai .env.example
git commit -m "feat: livello assistente Ollama opzionale per la categorizzazione"
```

---

### Task 13: Innesto dell'assistente nella pagina di revisione

**Files:**
- Modify: `app/(app)/categorizza/page.tsx`, `lib/queries/categorization.ts`

**Interfaces:**
- Consumes: endpoint `ai` (Task 12), pagina del Task 9
- Produces: `useAiSuggestionsMutation()`

- [ ] **Step 1: Aggiungi l'hook**

In `lib/queries/categorization.ts`:

```ts
/** Proposte aggiuntive dall'assistente per i gruppi rimasti senza proposta. Silenziosa se il livello è spento. */
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

Nota la differenza rispetto agli altri hook: qui un fallimento **non** lancia. Una risposta di errore vale come «nessuna proposta aggiuntiva», perché l'assenza dell'assistente non deve mai produrre un errore visibile.

- [ ] **Step 2: Innestalo nella pagina**

Nella pagina `/categorizza`, dopo che i dati della query sono arrivati, invoca la mutation **una sola volta** con gli id delle transazioni dei gruppi la cui `suggestion` è `null`. Se non ce ne sono, non chiamare l'endpoint. Le proposte che tornano si innestano nei rispettivi gruppi, senza toccare quelli che hanno già una proposta e senza sovrascrivere una scelta già fatta dall'utente.

Nessuno spinner bloccante: al più un'indicazione discreta accanto ai gruppi in attesa, che sparisce comunque quando la mutation finisce, in qualunque modo finisca.

- [ ] **Step 3: Verifica completa**

Run: `pnpm tsc --noEmit && pnpm lint && pnpm exec vitest run && pnpm build`
Expected: tsc pulito; lint con i soli 2 errori pre-esistenti noti; test tutti verdi salvo i 3 fallimenti pre-esistenti e non correlati di `lib/gocardless/scheduler.test.ts`; build completata.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: proposte dell'assistente nella pagina di categorizzazione, rimosso il vecchio wizard"
```

---

## Verifica manuale (utente)

Non eseguibile da un agente: nessun browser reale né Postgres garantito nel sandbox delle sessioni agentiche, vincolo costante di questo progetto.

- [ ] Un merchant già categorizzato una volta viene assegnato da solo al sync successivo, senza passare da "Da categorizzare".
- [ ] La pagina `/categorizza` raggruppa correttamente le varianti dello stesso merchant, e applicare un gruppo categorizza tutte le sue transazioni.
- [ ] Il badge di origine e il motivo della proposta corrispondono a ciò che ci si aspetta (regola / storico / assistente).
- [ ] Applicare crea la regola, che compare in `/categorie` con il conteggio di utilizzi che cresce dopo i sync successivi.
- [ ] Cambiare una regola da «Esatta» a «Contiene» accorciando il pattern cattura effettivamente le altre filiali.
- [ ] Un'entrata non riceve mai proposte di categorie di spesa, e viceversa.
- [ ] **Senza `OLLAMA_BASE_URL` configurata**: la pagina funziona identica, nessun errore, nessun avviso, i gruppi senza proposta restano semplicemente senza proposta.
- [ ] Con Ollama configurato e poi spento a metà: stesso comportamento, nessun blocco della pagina.
