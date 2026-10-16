# Rule-based automatic categorization — design

Date: 2026-09-10
Status: approved in brainstorming, to be turned into an implementation plan

## Problem

The current automatic categorization system is made of two disconnected mechanisms, neither of which keeps any memory of the user's decisions:

1. **On GoCardless import** (`lib/gocardless/categorize.ts`): `resolveCategoryId` looks for the latest already-categorized transaction with an **identical** description (`ilike`). Any variation — a trailing transaction code, a different branch, `SPA` instead of `S.p.A.` — sends the transaction to "Da categorizzare" ("To categorize").
2. **"Categorizza automaticamente" ("Categorize automatically") button** (`lib/calc/categorize-suggestions.ts` + `AutoCategorizeWizard`): Jaccard similarity on the tokens of the raw description, threshold 0.5, presented in a modal wizard that asks for confirmation **one transaction at a time**.

Flaws found in real use, confirmed by the user during brainstorming:

- **It doesn't learn**: a confirmation in the wizard only applies to that transaction. The same merchant comes back as "Da categorizzare" at the next sync.
- **Wrong or missing suggestions**: Jaccard works on the raw text, so shared banking noise (`pagamento`, `pos`, `carta`) counts as real similarity between different merchants — a limitation already noted in the 2026-07-24 log and never fixed. Conversely, a known merchant with a variable suffix may not reach the threshold.
- The suggestion engine **ignores the direction** of the transaction (income/expense): this is the root cause of the bug found by the whole-branch review of 2026-07-28, in which the wizard proposed an expense category for an income and the PATCH answered 400 with no way out other than "Salta" ("Skip").

## Product decisions (from brainstorming)

| Question | Decision |
|---|---|
| LLM or deterministic logic? | **Hybrid**: rules first, LLM only as a safety net for never-seen cases. |
| Autonomy | **The system never applies what it infers.** Inferences (similarity, LLM) are only suggestions. |
| Exception to autonomy | **A rule already approved by the user applies by itself** at the next sync: you don't reconfirm ESSELUNGA every month. |
| How memory is created | **Learned from confirmations, but materialized as visible rules the user can edit.** |
| Where the model runs | **Local Ollama in the cluster.** If no model is connected, the layer switches off and everything else works the same. |

Approach chosen among three alternatives discussed:

- **A (chosen)** — rules on a normalized merchant key, learned from confirmations, inspectable.
- **B (discarded)** — implicit memory recomputed from transactions, with no rule entity: neither inspectable nor correctable, a wrong inference feeds itself.
- **C (discarded)** — rules with free-form regex and manual priority: a developer tool; automatically generated regexes would be unpredictable and hard to explain. The `contains` match type covers the real need (generalizing over a chain) without the cost.

## Data model

New table `categorization_rules` (`lib/db/schema/categorization-rules.ts`):

| field | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `userId` | text → `auth_user.id` on delete cascade | |
| `matchType` | enum `merchant` \| `contains` | new `rule_match_type` enum |
| `pattern` | text | already normalized with the same function as the merchant key |
| `categoryId` | uuid → `categories.id` | |
| `splitPercentage` | numeric(5,4) nullable | "Dividi" ("Split") share to propose again; `null` = none |
| `source` | enum `appresa` \| `manuale` | new `rule_source` enum |
| `hitCount` | integer default 0 | how many times the rule has acted |
| `lastAppliedAt` | timestamptz nullable | |
| `createdAt` / `updatedAt` | timestamptz | |

Constraints: `unique(userId, matchType, pattern)` — reconfirming the same merchant updates the rule instead of duplicating it; index on `userId`.

No change to the `transactions` table.

### Merchant key

New pure module `lib/categorization/merchant-key.ts`, function `merchantKey(description: string): string`:

1. lowercase and diacritics removal (NFD normalization)
2. split on non-alphanumerics, discarding purely numeric tokens
3. removal of banking-noise tokens (`MERCHANT_NOISE_TOKENS`: `pos`, `pagamento`, `pagam`, `carta`, `acquisto`, `addebito`, `bonifico`, `sepa`, `sdd`, `rif`, `cod`, `operazione`, `ricarica`, …)
4. removal of company suffixes (`spa`, `srl`, `snc`, `sas`, `ltd`, `inc`, `bv`, `gmbh`)
5. join of the surviving tokens with a single space

Example: `"PAGAMENTO POS ESSELUNGA SPA VIA ROMA COD.4471"` → `esselunga via roma`.

If no token remains after normalization (description entirely numeric or made only of noise), the key is the description normalized to lowercase/trim — the same fallback already used today by `descriptionSimilarity`, so as not to collapse different descriptions onto a shared empty key.

## Resolution pipeline

New module `lib/categorization/resolve.ts`. It replaces `resolveCategoryId` as called by `lib/gocardless/sync.ts`.

```
resolveCategorization(userId, { description, amount }) 
  → { categoryId, excludedAmount, ruleId } | null
```

Strict order, the first that wins closes:

1. `merchant` rule with `pattern === merchantKey(description)` → apply
2. `contains` rule with `merchantKey(description).includes(pattern)` → apply; with multiple matches the longest (most specific) `pattern` wins, at equal length the most recent
3. no match → returns `null`, the caller assigns the fallback category

**Direction guard, mandatory in both branches**: a rule whose category is incompatible with the transaction's direction (an `entrata` (income) category on a negative amount, or a non-`entrata` category on a positive amount) is ignored and evaluation continues. It is the same invariant the server already enforces on `PATCH /api/transactions/[id]`; its absence in the current engine is the cause of the 2026-07-28 bug.

When a rule wins: `hitCount` is incremented and `lastAppliedAt` updated, in the same DB transaction as the transaction insert.

The rule's `splitPercentage`, if present, produces `excludedAmount = round(splitPercentage * |amount|)` with the sign of `amount`, consistent with `isValidExcludedAmount`.

### Technical debt closed along the way

`getFallbackCategoryId` currently resolves the fallback category **by literal name** (`"Da categorizzare"`) instead of by the `isFallback` flag — debt open in the log since 2026-07-21. Since this work rewrites the caller, resolution moves to the `isFallback` flag (with on-the-fly creation unchanged in behavior). The 409 guard on renaming the fallback stays where it is.

## Suggestions (never applied)

New module `lib/categorization/suggest.ts`. It works only on transactions still in the fallback category, in cascade; each transaction gets at most one suggestion, from the first source that produces one:

1. **Similar rule** — Jaccard between the tokens of `merchantKey(description)` and those of the existing `pattern`s, threshold 0.5. Reason shown: «simile alla regola `<pattern>`» ("similar to rule `<pattern>`").
2. **History** — the current engine (`computeCategorizeSuggestions`), rewritten to compare **normalized keys** instead of raw descriptions. Reason: «come N transazioni passate» ("like N past transactions").
3. **Assistant** — Ollama, only on what remains after 1 and 2.

Each suggestion carries `source` (`regola` | `storico` | `assistente`), `confidence` (0–1) and the data needed to show the reason. The direction guard applies here too: a suggestion incompatible with the transaction's direction is not emitted.

`confidence` is not an invented scale, it is the value already available for each source: the Jaccard similarity with the pattern for `regola`, the `averageSimilarity` of the winning category's matches for `storico` (the field the current engine already computes), the value declared by the model for `assistente`. These quantities are not comparable with each other: the UI always shows them with the origin badge, never as a single ranking.

Suggestions are computed **per transaction** and grouped downstream by merchant key. A group takes the suggestion from the highest source in the cascade among those of its transactions; if different proposed categories emerge within the same group (only possible between `storico` and `assistente`), the group shows the most frequent and flags that individual transactions diverge, remaining expandable to decide them one by one.

`splitPercentage` is proposed only when all reference transactions of the winning category have the same share — a rule already present today, kept.

## Assistant layer (Ollama)

`lib/categorization/llm/index.ts` exposes a narrow interface:

```ts
interface CategorySuggester {
  suggest(input: SuggestInput[], categories: Category[]): Promise<LlmSuggestion[]>;
}
getSuggester(): CategorySuggester | null
```

Single implementation: `OllamaSuggester`, configured by `OLLAMA_BASE_URL` and `OLLAMA_MODEL`.

**Explicit requirement — no connected model is a normal state, not a failure.** If `OLLAMA_BASE_URL` is not set, `getSuggester()` returns `null` and the layer is skipped: no error, no alarm log, no warning in the UI. The same applies at runtime for connection refused, timeout (10s) or a response that fails Zod validation: zero suggestions from this layer, suggestions from rules and history remain unchanged. **The app must never degrade below the purely deterministic behavior.**

Called in **a single batch** for all unresolved transactions, never one per transaction. The prompt contains: the list of the user's categories (name + type) and, for each transaction, normalized description, amount and direction. It contains no IBAN, balances, account identifiers or user data.

The output is validated with Zod (`[{ index, categoryName, confidence }]`); a category name that doesn't match an existing category of the user is **discarded**, never created.

## API

- `GET /api/transactions/categorize-suggestions` — existing, rewritten: responds with suggestions from **rules + history**, grouped by merchant key. It never calls the assistant, so it stays fast and doesn't depend on Ollama.
- `POST /api/transactions/categorize-suggestions/ai` — new: receives the transactions left without a suggestion, queries the assistant if configured, responds with the additional suggestions (empty array if the layer is off).
- `POST /api/transactions/categorize-apply` — new, batch: receives an array of groups `{ transactionIds[], categoryId, excludedAmount, createRule }` and writes **everything in a single DB transaction** (transaction updates + rule creation/update). Either everything goes through, or nothing does. Ownership verified on every `transactionId` and on `categoryId`, direction guard applied per transaction.
- Rules: `GET`/`POST /api/categorization-rules`, `PATCH`/`DELETE /api/categorization-rules/[id]`, with the same IDOR-safe ownership pattern already used by `/api/categories/[id]`.

## Interface

### Review page `/categorizza`

Replaces `AutoCategorizeWizard`. Reached from the "Categorizza automaticamente" button already present in Transazioni (Transactions).

The change that matters: **grouping by merchant key**. Transactions with the same key are a single row («ESSELUNGA — 7 transazioni, 243,10 €»), expandable to see the individual ones. One choice categorizes the whole group.

Per group: category select prefilled with the suggestion, origin badge (`Regola simile` ("Similar rule") / `Storico` ("History") / `Assistente` ("Assistant")) with the confidence, optional collapsed split control, selection checkbox. At the top: "Seleziona tutto" ("Select all") and **"Applica selezionate (N)"** ("Apply selected (N)").

`createRule` is on by default: applying means teaching. The rule created is always `merchant` on the normalized key — it never generalizes beyond what the user has actually seen.

Assistant suggestions arrive later (background call after the first render) and slot into the groups still without a suggestion. If they don't arrive, the page stays exactly as it was: no endless spinner, no error message.

### Rule management

A section inside `/categorie`, not a new sidebar entry. List of rules with pattern, match type, category, number of uses. Actions: edit pattern and category, switch a rule from `merchant` to `contains` (that's how `esselunga via roma` becomes `esselunga` and covers all branches), delete.

## Initial population

Without pre-existing rules, level 1 would be empty and the whole load would fall on history and assistant. One-shot script `lib/db/backfill-categorization-rules.ts`: generates `appresa` (learned) rules from already-categorized transactions — one per merchant key, most frequent category, ties resolved by the most recent, fallback categories excluded.

**The script must be run in the session and the count of rules created reported to the user.** A backfill written and never run is exactly the 2026-07-22 mistake with `backfill-category-appearance.ts`, which left inconsistent data for weeks behind a "complete" plan.

## Testing

Pure functions with vitest, per project convention:

- `merchant-key`: noise, company suffixes, accents, numeric tokens, fallback on noise-only descriptions
- `resolve`: branch order, longest `contains` wins, direction guard in both branches, no match
- `suggest`: cascade among the three sources, direction guard, consistency of the proposed split
- grouping by merchant key
- fake `CategorySuggester` for the assistant layer, **including the "not configured" and "timeout" cases**, which must prove there is no degradation
- API: cross-user ownership on apply and rules, batch atomicity

## Implementation sequence

The work is large but has a natural order in which each phase leaves the system working:

1. **Foundations** — `merchant-key`, `categorization_rules` schema, migration. No visible behavior changes.
2. **Pipeline** — `resolve.ts` and replacement of `resolveCategoryId` in the sync, with the direction guard and the closing of the `isFallback` debt. From here rules act on import, even though there's no way yet to create them from the UI.
3. **Backfill** — script run in the session: level 1 stops being empty.
4. **Suggestions** — `suggest.ts` and rewrite of the `GET` endpoint, still consumed by the old UI.
5. **Review** — `/categorizza` page, `categorize-apply` batch endpoint, grouping by merchant. The wizard leaves the stage.
6. **Rule management** — section in `/categorie`, CRUD endpoints.
7. **Assistant** — `CategorySuggester`, `OllamaSuggester`, `ai` endpoint, background insertion into the review page. It's the last phase precisely because everything must work without it.

## Out of scope (decided, not forgotten)

- Regex in patterns and manual rule priority (approach C, discarded). The `contains` type covers the real need.
- Auto-applying inferred suggestions: it contradicts the product decision.
- Any change to KPIs, donut and charts of Transazioni.
- Removing the old `AutoCategorizeWizard` from the repository: it stays until the new page is manually verified by the user, then it is deleted.

## Known risks

- **Ollama on a single VPS**: a local model is the fragile point of the infrastructure (RAM/CPU shared with the rest of the cluster). Structural mitigation: the layer is isolated behind `CategorySuggester`, off by default without configuration, and replaceable with another implementation without touching the rest.
- **Wrongly learned rules**: a distracted confirmation creates a rule that then applies by itself. Mitigation: rules are visible, editable and deletable from the management page, with the usage counter making the most active ones evident.
- **DB migration**: the project has a pre-existing unique constraint that blocks `pnpm db:push` (log of 2026-07-27), worked around so far with direct, unversioned `ALTER TABLE`s. This new table should be added with the same method only as a last resort; if possible, fix the blocker at the root — otherwise the debt grows to a whole table instead of two columns.
