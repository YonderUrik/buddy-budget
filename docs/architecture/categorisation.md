# Categorisation

This part turns a bank transaction into a category and a counted amount. A transaction arrives on the fallback category («Da categorizzare», to be categorised), or, from an imported file that carries the bank's own category, already in the matching category of the user; user rules, past choices and an optional AI assistant then propose a category, and only proposals that are certain enough are applied without the user. Each transaction records where its category came from. The same data feeds budgets per category, the «Dividi» (split) exclusion and subscription detection. The code lives in [`lib/categorization`](../../lib/categorization), [`lib/categories`](../../lib/categories), [`lib/llm`](../../lib/llm), [`lib/subscriptions`](../../lib/subscriptions) and [`lib/calc/subscriptions.ts`](../../lib/calc/subscriptions.ts).

> This is a living document: it describes the code as it is. Change it in the same PR that changes the behaviour it describes.

## 1. Overview

| Stage | Input | Output | Code |
|---|---|---|---|
| Merchant name | bank text, counterparty | cleaned `description` | [`merchant-name/extract.ts`](../../lib/categorization/merchant-name/extract.ts) `extractMerchantName` |
| Merchant key | description | normalised key | [`merchant-key.ts`](../../lib/categorization/merchant-key.ts) `merchantKey` |
| Rules | key, sign, user rules | category, excluded amount | [`match-rule.ts`](../../lib/categorization/match-rule.ts), [`resolve.ts`](../../lib/categorization/resolve.ts) |
| AI proposals | uncategorised merchant groups | rows in `categorization_suggestions` | [`ai/suggest-for-user.ts`](../../lib/categorization/ai/suggest-for-user.ts), [`lib/llm/jev.ts`](../../lib/llm/jev.ts) |
| Proposals | uncategorised rows, history, rules, stored AI rows | one proposal per merchant group | [`suggest.ts`](../../lib/categorization/suggest.ts), [`load-groups.ts`](../../lib/categorization/load-groups.ts) |
| Bank category | label the bank wrote in an imported file | one of the user's categories, `categorySource = banca` | [`bank-category.ts`](../../lib/categorization/bank-category.ts), [`load-bank-category-mapper.ts`](../../lib/categorization/load-bank-category-mapper.ts) |
| Auto-apply | proposals at 90% or more | category with origin and confidence | [`auto-apply.ts`](../../lib/categorization/auto-apply.ts) |
| Review | user choices | `categorySource = utente`, optional learned rule | [`categorize-apply/route.ts`](../../app/api/transactions/categorize-apply/route.ts) |
| Ricategorizza | categorised rows | changes with undo | [`recategorize-plan.ts`](../../lib/categorization/recategorize-plan.ts), [`recategorize.ts`](../../lib/categorization/recategorize.ts) |
| Logos | group label and texts | logo path on our server | [`merchant-logo`](../../lib/categorization/merchant-logo) |
| Subscriptions | expenses of the last 26 months | detected series + saved choices | [`lib/calc/subscriptions.ts`](../../lib/calc/subscriptions.ts), [`lib/subscriptions`](../../lib/subscriptions) |

```text
new rows (sync, CSV, manual) ─> fallback category
   CSV row with a bank category that maps (no rule takes it) ──> categorySource = banca
                │
                ├─ rules (always) ─────────────────────────> categorySource = regola
                ├─ AI proposals stored (consent only)
                └─ proposals: similar rule / history / AI
                       │ >= 0.90 and autoApply on ──────────> regola | storico | assistente
                       └ otherwise ─> Categorizza «Da decidere» ─> utente (+ learned rule)
```

## 2. Principles

**P1 — The fallback is a flag, not a name.** The uncategorised category is the one with `isFallback = true`; `getFallbackCategoryId` creates it as «Da categorizzare» if missing. Renaming it changes nothing.

**P2 — Rules always apply.** User rules are explicit choices: they categorise new rows on sync, after CSV and broker imports, after a manual add and right after a rule is created or edited, whatever the auto-apply setting.

**P3 — Only certain proposals act alone.** A proposal is applied without the user only at confidence 0.90 or more (`AUTO_APPLY_THRESHOLD`), only if the user's `categorizationAutoApply` is on, only if no other transaction of the same group points elsewhere and, for AI proposals, only while the consent is active.

**P4 — Automatic writes touch only the fallback.** Auto-apply updates a row only if it is still on a fallback category at write time. Ricategorizza never touches rows with `categorySource = utente`, and changes rows with `categorySource = banca` only through a rule.

**P4b — The bank's own category is applied without asking.** When an imported file carries the bank's category for a row and it maps clearly to one of the user's categories, the row is inserted there (`categorySource = banca`), whatever the auto-apply setting: it is data from the file, not a guess of the app. User rules still win, generic labels («Altro», «Other») never map, transfers are never targets, and every such row lists in «Messe dall'app» and stays editable.

**P5 — Every category has an origin.** `transactions.categorySource` is `regola`, `storico`, `assistente`, `banca`, `utente` or null (older rows, or back to the fallback), with `categoryConfidence` and `categorizedAt`.

**P6 — Direction is enforced.** `entrata` categories accept only positive amounts, spending groups only negative ones; the fallback and `trasferimento` accept both (`isDirectionCompatible`).

**P7 — Little leaves the server.** The AI receives only the cleaned merchant name, the MCC code, the direction, the user's category names and descriptions, up to 40 examples and the user's own instructions. Never amounts, dates, accounts or user ids; person names and transfers are blocked before sending.

**P8 — Pure engines, thin routes.** Matching, proposals, grouping, the recategorise plan and subscription detection are pure functions with unit tests; database and network calls sit around them.

## 3. Data model

| Table | Stores | Schema |
|---|---|---|
| `categories` | `name`, `type` (`dovuta`, `voluta`, `futuro`, `saltuaria`, `entrata`, `trasferimento`), `color`, `icon`, `description`, `isFallback`, `defaultKey` | [`categories.ts`](../../lib/db/schema/categories.ts) |
| `categorization_rules` | `matchType` (`merchant` exact, `contains` substring), normalised `pattern`, `categoryId`, `splitPercentage` (0-1), `source` (`appresa` learned, `manuale`), `hitCount`, `lastAppliedAt` | [`categorization-rules.ts`](../../lib/db/schema/categorization-rules.ts) |
| `categorization_suggestions` | AI proposal per `(userId, merchantKey, direction)`: `categoryId`, `confidence`, `status` (`in_attesa`, `confermata`, `corretta`), `model`, `promptVersion` | [`categorization-suggestions.ts`](../../lib/db/schema/categorization-suggestions.ts) |
| `categorization_runs`, `categorization_run_items` | one Ricategorizza run and, per transaction, the previous category, excluded amount, origin, confidence and time | [`categorization-runs.ts`](../../lib/db/schema/categorization-runs.ts) |
| `budgets` | `monthlyAmount` per category, unique per user and category | [`budgets.ts`](../../lib/db/schema/budgets.ts) |
| `subscriptions` | only the user's decisions (`confermato`, `escluso`, `terminato`) and manual subscriptions, keyed by `key` | [`subscriptions.ts`](../../lib/db/schema/subscriptions.ts) |
| `auth_user` columns | `aiCategorizationConsentAt`, `aiCategorizationInstructions`, `categorizationAutoApply` (default true), `autoCategorizedSeenAt` | [`auth.ts`](../../lib/db/schema/auth.ts) |

On `transactions`: `categoryId`, `excludedAmount` (same sign as `amount`, magnitude not above it), `categorySource`, `categoryConfidence`, `categorizedAt`, `description` (cleaned name), `rawDescription` (bank text), `merchantCategoryCode` and `bankCategory` (the bank's own label from an imported file, encrypted, kept also when it did not map).

Always computed, never stored: proposals from rules and history, merchant groups, the «Messe dall'app» list, the recategorise plan, spending per category and group, budget remaining, and detected subscriptions.

## 4. How it works

### 4.1 Categories and spending groups

The four spending groups replace fixed and variable expenses ([`lib/categories/groups.ts`](../../lib/categories/groups.ts)):

| Type | Label | Meaning | Counted as |
|---|---|---|---|
| `dovuta` | Dovute (Needs) | necessary to live | expense |
| `voluta` | Volute (Wants) | improves life, could be skipped | expense |
| `futuro` | Te futuro (Future you) | saving and investing as a priority | expense |
| `saltuaria` | Saltuarie (Occasional) | necessary but not monthly | expense |
| `entrata` | Entrata | income | income |
| `trasferimento` | Trasferimenti tra conti | moves between the user's own accounts | excluded in full |
| fallback | Da categorizzare | not decided yet | bucket `daCategorizzare` |

New users get `DEFAULT_CATEGORIES` from [`defaults.ts`](../../lib/categories/defaults.ts): 24 categories plus the fallback (7 Dovute, 7 Volute, 2 Te futuro, 3 Saltuarie, 1 transfer, 4 income), each with a short description that is also sent to the AI. Five optional ones (`OPTIONAL_DEFAULT_CATEGORIES`) are off in the onboarding step. `LEGACY_CATEGORY_NAMES` maps old default names so a reset renames instead of deleting.

### 4.2 Merchant name and merchant key

`extractMerchantName` picks, in order: the bank's counterparty name (normalised through the alias dictionary), aliases and Italian patterns on the free text (`PAYPAL *SPOTIFY`, «A FAVORE DI …»), then the text stripped of codes and references, then `Movimento bancario`. Its `source` is logged as a metric.

`merchantKey` normalises a description: lower case, no diacritics, punctuation to spaces, then removes numeric tokens, bank noise (`pagamento`, `pos`, `carta`, `bonifico`, `sepa`…) and company suffixes (`srl`, `spa`, `gmbh`, single letters). If nothing remains it keeps the normalised text. Articles are kept on purpose.

```text
"PAGAMENTO POS ESSELUNGA S.P.A. 1234"  ->  "esselunga"
"Bonifico SEPA 0001"                    ->  "bonifico sepa 0001"   (only noise: kept whole)
```

### 4.3 Rules

`selectMatchingRule(key, isIncome, rules)`:

1. Drop rules whose category does not fit the direction.
2. A `merchant` rule whose pattern equals the key wins.
3. Otherwise among `contains` rules whose pattern is a substring of the key, the longest pattern wins; on equal length, the most recent rule.

The excluded amount follows the rule:

```text
transfer category: excluded = amount
split rule:        excluded = sign(amount) * round(|amount| * splitPercentage, 2)
otherwise:         excluded = 0
```

Example: a rule `esselunga` with `splitPercentage = 0.5` on a -80.00 expense gives `excludedAmount = -40.00`; the user counts 40.00.

`buildRuleResolver` loads rules once and resolves in memory; hits are counted only for rows actually written and flushed with one update per rule (`flushRuleHits`). On bank sync the resolver tries the legacy description (counterparty or raw text) first, then the extracted name. `applyRules` in auto-apply tries `description`, then `rawDescription`.

Rules are created by the user on the rules page (`manuale`) or learned when the user confirms a group in Categorizza with "remember" (`appresa`, upsert on `(user, merchant, pattern)` with the group's merchant key). After creating or editing a rule, the route applies all rules to the fallback rows and reports how many past rows the rule would change (`countPastMatchesSafely`).

### 4.4 Proposals from similar rules and from history

`computeSuggestions` gives at most one proposal per uncategorised transaction. Similarity is the Jaccard index of key tokens; candidates below 0.5 are ignored.

```text
jaccard(A, B) = |A ∩ B| / |A ∪ B|

rule proposal:    confidence = round(max jaccard(key, rule.pattern), 2)

history proposal: matches  = past categorised rows with jaccard >= 0.5 (direction-compatible)
                  winner   = category with most matches (ties: most recent date)
                  evidence = min(1, winning / 3)
                  confidence = round(winning / matches * avgSimilarity(winning) * evidence, 2)
```

A history proposal counts as confident only if it reaches 0.90 and at least 3 past rows agree (`MIN_HISTORY_AGREEING`).

Example: key `esselunga`. Five past rows have key `esselunga`, four in Spesa and one in Svago. `confidence = 4/5 * 1.0 * 1 = 0.80`: shown as a proposal, not applied. With six rows all in Spesa, `confidence = 1.00` and 6 agree: applied when auto-apply is on.

Example (rule similarity): key `esselunga milano` against a rule pattern `esselunga` gives `1/2 = 0.50`: a weak proposal.

If a rule proposal is already confident, history is skipped; otherwise the better of the two wins (confident first, then source priority `regola` > `storico` > `assistente`, then confidence).

`groupByMerchant` groups uncategorised rows by `merchantKey::direction` (a purchase and its refund are separate groups). A group takes its best proposal and is flagged `hasDivergentSuggestions` if its rows point to different categories. `withAssistantSuggestions` then fills groups without a proposal from stored AI rows (`status = in_attesa`), and replaces an uncertain proposal when the AI one is confident.

### 4.5 AI proposals

`suggestCategoriesForUser` runs only with `aiCategorizationConsentAt` set and `OPENROUTER_API_KEY` present. It:

1. Groups fallback rows with `groupForModel` and skips groups already in `categorization_suggestions` (any status).
2. Runs `prepareMerchantForModel` on the raw bank text: cuts card boilerplate («Carta N.», «Data op»), extracts the name, blocks `operazione` texts (bonifico, giroconto, prelievo, F24, stipendio…) and blocks `persona` (2 to 4 words of letters only, no business word, not a card payment, no company ending). Blocked groups are counted and never sent.
3. Sends up to 120 groups per automatic run (600 and a 240 s budget for the manual «Categorizza con l'AI»), in batches of 5, to the OpenRouter Decisions endpoint with model `CATEGORIZATION_MODEL` (default `typesafe/jev-1.13`) and `provider: { zdr: true, data_collection: "deny" }`.
4. Each merchant is a choice question limited to the user's categories of the right direction; transfer categories are never offered. Answers outside the list are dropped. Confidence is the model's probability for the chosen option.
5. Stores rows `in_attesa` inside a transaction that locks the user row and drops the batch if the consent was revoked or the instructions changed in the meantime.

A model error stops the run without throwing; the rows stay uncategorised. Saving new instructions deletes the pending AI rows. Revoking the consent stops new requests, and stored AI proposals stop being applied automatically. When the user decides a group, `recordSuggestionDecisions` marks the stored row `confermata` (same category) or `corretta` (different category, `source = utente`, confidence 1).

### 4.6 Bank categories in imported files

Many bank exports carry their own category column (Intesa Sanpaolo «Categoria», N26 «Category», Fineco «Moneymap», German «Kategorie»). The personal CSV import keeps it as `bankCategory` on each cash row (see [bank-sync-and-imports.md](bank-sync-and-imports.md) §4.8) and `confirmImport` maps it while inserting, with no AI and no confirmation:

1. A user rule that takes the row (on the cleaned name, then on the bank text) wins: the row stays on the fallback and the rule categorises it right after the import, with origin `regola`.
2. **Learned**: if at least 2 of the user's own choices (`categorySource = utente`) on rows with the same normalised label agree on one category, and it is the clear winner (`learnFromCorrections`), that category.
3. **Name**: a category of the user whose name, in any language or any part of a «Ristoranti & Bar» name, equals the label after normalisation and a light plural stem. Two matches are ambiguous and give nothing.
4. **Dictionary**: a list of Italian, English and German bank terms per default category key (`DICTIONARY` in [`bank-category.ts`](../../lib/categorization/bank-category.ts)), first entry whose category exists for the user wins. Defaults are found by `defaultKey`, or by a default name for older rows, so a renamed default still matches.

For «Casa > Bollette» labels each level is tried from the most specific. Candidates exclude the fallback, transfer categories and categories of the wrong direction (P6). Generic labels never map. An unmapped row stays on the fallback with its label stored and goes through the usual pass.

```text
normalise("Bar & Ristoranti") = "bar ristoranti"
"Ristorazione", -25.00 → dictionary "ristor" → Ristoranti & Bar      (banca)
"Supermercati", -40.00 + rule "esselunga" → fallback → rule after the import (regola)
"Ristorazione", +15.00 → no expense category for an income → fallback
"Altro" → generic → fallback
user moved two «Ristorazione» rows to Svago → next «Ristorazione» row → Svago (banca, learned)
```

The receipt of the import says how many rows took the bank's category (`importLedger.bankCategorized`). Origin label «Banca»; the tooltip quotes the bank's label. Moving such a row counts as a correction with source `banca`, and that choice teaches later imports.

### 4.7 Automatic pass

`categorizeNewMovementsSafely` runs after bank sync, personal CSV confirmation, broker statement imports and the manual AI run. It calls the AI step, then `autoApplyCategories`:

1. `applyRules` on all fallback rows: `categorySource = regola`, `categoryConfidence = null`.
2. `loadCategorizationState` and `autoApplicableGroups`: with auto-apply on, groups with a confident proposal and no divergence (AI proposals only with consent).
3. Each group is written with `categorySource` = the proposal's source, its confidence, `categorizedAt = now` and the excluded amount (full for transfers, else the proposal's split percentage).

Every write is conditional on the row still being on a fallback category. The pass is idempotent and never throws. Turning auto-apply on in Impostazioni runs it once in `after()`.

### 4.8 «Da decidere» and «Messe dall'app»

The Categorizza page (`/categorizza`) has two lists:

| List | Content | Source |
|---|---|---|
| «Da decidere» (To decide) | merchant groups still on the fallback, each with its best proposal and an origin line | `loadCategorizationState` via `/api/transactions/categorize-suggestions` |
| «Messe dall'app» (Set by the app) | rows with an automatic `categorySource` and `categorizedAt` after `autoCategorizedSeenAt`, at most 1000, grouped by merchant, direction, category and origin; group confidence is the lowest of its rows | `/api/transactions/auto-categorized`, `groupAutoCategorized` |

«Va tutto bene» moves `autoCategorizedSeenAt` forward. Applying a choice (`POST /api/transactions/categorize-apply`, in batches of 5 groups from the client) checks ownership and direction of every row first, then in one transaction sets the category, the excluded amount, `categorySource = utente`, and optionally upserts the learned rule. Moving rows that had an automatic origin is counted as a correction (metric `categorization_auto_total` and log `categorization.auto.corrected`): this measures the errors of the 90% threshold.

Origin labels ([`origin.ts`](../../lib/categorization/origin.ts)): «Regola», «Le tue scelte» (history), «AI» and «Banca». The percentage appears only in the tooltip text. A manual edit of the category, or of the split of an automatic row, makes the row `utente`; moving it back to the fallback clears the origin.

### 4.9 Ricategorizza

`planRecategorize` decides what BuddyBudget would choose today for rows that are already categorised. Candidates are rows with an automatic origin; with `includeLegacy`, also rows with no origin that were not split by hand (0 < |excluded| < |amount|). Rows chosen by the user are never candidates.

| Scope | Uses |
|---|---|
| `tutto` | rules first; then, with auto-apply on, confident proposals from history (only `utente` and legacy rows as history) and stored AI rows with consent; rows with the bank's category change only through a rule |
| `regola` | only the given rule; legacy rows always included |

Only rows whose category would change are kept, grouped by merchant, direction, from, to, source and percentage. `previewRecategorize` returns the groups without transaction ids (plus how many legacy rows would change if included). `applyRecategorize` recomputes the plan, writes the selected groups in one transaction only where the row is still in its original category and not `utente`, and stores one `categorization_run_items` row per change.

Undo: `undoRecategorize` acts only on the most recent run that is not undone and is less than 7 days old (`RECATEGORIZE_UNDO_DAYS`). It restores category, excluded amount, origin, confidence and time only where the row still has the category and `categorizedAt` written by the run and the previous category still exists. Runs older than 30 days are deleted at the next apply.

### 4.10 Split («Dividi») and exclusions

`excludedAmount` is the part of a transaction that does not count as the user's own. It has the same sign as `amount` and a magnitude not above it (`isValidExcludedAmount`). [`lib/liquidity/split.ts`](../../lib/liquidity/split.ts) offers the presets Tutta, Metà, Un terzo, Un quarto (1, 2, 3, 4 parts).

```text
ownShare = round(|amount| / parts, 2)
excluded = round(|amount| - ownShare, 2)   (stored with the sign of amount)
effective = |amount| - |excluded|
```

Example: a 60.00 dinner split in half: `excludedAmount = -30.00`, effective spend 30.00. Transfers are always excluded in full, so they never count as income or spending. Personal CSV rows marked `transfer` and the cash legs of investment trades are stored fully excluded and placed in the user's transfer category when one exists.

### 4.11 Budgets per category

The user sets a budget in the detail window of an expense category (Liquidità → Categorie, `CategoryBudgetField`): the amount is saved on blur and an empty field removes it. The tile on the board shows it as «420 €/mese», and Liquidità → Analisi draws each budgeted category's bar against its budget for the period («restano 101 € su 420 € di budget»). `PUT /api/budgets/[categoryId]` upserts a `monthlyAmount` (transfer categories are refused) and `DELETE` removes it. Spending per category is `sumByCategory` (effective amounts). In [`lib/calc/expenses.ts`](../../lib/calc/expenses.ts) `scaleBudgetForPeriod` scales the monthly total to the selected period (week = month / 30 * 7, quarter = month * 3, year = month * 12), and `budgetRimanente` (budget remaining) compares only categories that have a budget.

Budget alert emails ([`lib/notifications/alerts.ts`](../../lib/notifications/alerts.ts)) fire at 80% and 100% of the month's budget, once per category, month and threshold (Rome time).

Example: budget 300.00 on Ristoranti, spent 245.00. 80% is 240.00, so the 80% alert is sent once; the 100% alert waits for 300.00.

### 4.12 Merchant logos

`resolveMerchantLogo` picks, in order of reliability:

1. The brand dictionary (`MERCHANT_LOGO_DOMAINS`, domains only for known brands) on the label and all texts.
2. A website written in the text (`domainFromText`: closed list of TLDs, registrable domain, payment intermediaries such as PayPal, SumUp, Stripe or Satispay skipped).
3. For expense groups that are not transfers, a name search key.

`merchantLogoPath` builds `/api/merchant-logos/<domain>` (dictionary, unsigned) or a path signed with an HMAC derived from `BETTER_AUTH_SECRET`, so the server only fetches what it found in the user's own rows. Logos come from Logo.dev with the publishable key and a Redis cache (browser cache one day, misses one hour). A name is searched on Logo.dev (`/v2/search`, `LOGODEV_SECRET_KEY`) only if at least 3 different users have it (`MIN_USERS_FOR_NAME_SEARCH`, counted with hashed user ids), within 100 searches per day, and only an exact name match is accepted. Found domains are cached 30 days, misses 7 days.

### 4.13 Subscription detection

`detectSubscriptions` ([`lib/calc/subscriptions.ts`](../../lib/calc/subscriptions.ts)) reads expenses of the last 26 months, excluding categories of type `futuro`, `entrata` and `trasferimento`. It groups them by `subscriptionKey` (the merchant key without tokens that contain digits) and tries each cadence from the most frequent:

| Cadence | Gap (days) | Min charges | Max amount spread | Grace |
|---|---|---|---|---|
| settimanale | 6-8 | 5 | 0.08 | 3 |
| mensile | 27-34 | 3 | 0.08 | 7 |
| trimestrale | 86-96 | 3 | 0.15 | 14 |
| semestrale | 174-190 | 3 | 0.25 | 21 |
| annuale | 355-376 | 2 | 0.25 | 30 |

A series passes if every gap fits the window (one skipped charge at double distance is forgiven), the day of the month stays within 5 days of the median for monthly or longer cadences, and amounts are constant (`(max - min) / median` within the spread) or show one clean price change between 0.5x and 2x. If the whole series fails, charges are clustered by amount (1% tolerance, at least 3 charges) to separate several subscriptions billed by one merchant.

```text
confidence = min(1, 0.45 + 0.07 * min(charges, 6)
                 + (exact amounts ? 0.15 : 0.05)
                 + (no skipped charge ? 0.10 : 0)
                 - (price change ? 0.05 : 0))
kept if confidence >= 0.60 and last charge within 400 days
state = "fermo" (stopped) if overdue > grace days
monthly equivalent = amount * perMonth   (weekly 52/12, quarterly 1/3, half-yearly 1/6, yearly 1/12)
```

Example: 9.99 charged on the 5th of three consecutive months: `0.45 + 0.21 + 0.15 + 0.10 = 0.91`, next charge on the 5th of the following month. A yearly 120.00 charge counts 10.00 per month.

`buildSubscriptionsView` ([`lib/subscriptions/view.ts`](../../lib/subscriptions/view.ts)) merges detection with the stored decisions and manual rows. Totals count only `confermato` and active items; detected items without a decision appear as «da confermare» and are totalled separately. Upcoming charges cover 30 days; price rises are shown for 365 days. Nothing detected is stored.

A decision («È un abbonamento», «Non lo è», «È terminato») is an upsert on `(user, key)` with a snapshot of what the user saw. The detected name is the raw bank description of the last charge, often longer than the 80 characters allowed for a typed name, so for decisions it is shortened to 80 characters instead of being rejected; the key is matched as is (up to 1000 characters). A refused save is logged as `subscriptions.save.rejected` (`reason`, and `field` for invalid input) and the list shows the error as a toast.

## 5. Limits and out of scope

- The 90% threshold is fixed; it is not adjustable by the user.
- Bank categories are read only from personal CSV imports (GoCardless does not send a usable category). The dictionary covers common Italian, English and German labels and is maintained by hand; a bank label it does not know falls back to the usual flow until the user's corrections teach it. The Terms of service still say proposals are never applied without the user: to be aligned at the professional legal review, together with the 90% threshold.
- A rule-similarity proposal reaches 0.90 only when token sets are almost identical, so most automatic decisions come from exact rules, history or the AI.
- Ricategorizza runs synchronously in the request (no background job) and loads all of the user's transactions; very large accounts are a known risk. Undo covers only the latest run.
- The AI never sees amounts or dates and never proposes transfer categories. Blocked names (people, transfers) stay for the user to decide.
- Logos: no logo for names seen by fewer than 3 users, and the dictionary is maintained by hand.
- Subscriptions: no link with Debiti instalments and no alerts; detection uses descriptions, so a merchant renamed by the bank starts a new series.
- Known technical debt: the similarity wizard does not discard generic words such as "pagamento pos" beyond the noise list; there is no undo for bulk categorisation in Categorizza.
- The schema comment on `transactions.rawDescription` says it is never used for matching, but `applyRules` and Ricategorizza fall back to it when the cleaned description matches no rule.

## 6. Tests

- [`merchant-key.test.ts`](../../lib/categorization/merchant-key.test.ts), [`match-rule.test.ts`](../../lib/categorization/match-rule.test.ts), [`resolve.test.ts`](../../lib/categorization/resolve.test.ts): normalisation, direction guard, exact before contains, longest pattern, hit counting.
- [`suggest.test.ts`](../../lib/categorization/suggest.test.ts): rule and history proposals, confidence, grouping by direction, divergence, AI merge.
- [`auto-apply.test.ts`](../../lib/categorization/auto-apply.test.ts): rules and safe history applied with origin and confidence; rules only when the option is off; no history with fewer than 3 agreeing rows.
- [`auto-review.test.ts`](../../lib/categorization/auto-review.test.ts), [`origin.test.ts`](../../lib/categorization/origin.test.ts): «Messe dall'app» grouping, correction counts, origin labels and date ranges.
- [`recategorize-plan.test.ts`](../../lib/categorization/recategorize-plan.test.ts): user choices and fallback rows untouched, legacy rows only on request and never if split by hand, bank categories changed only by rules.
- [`bank-category.test.ts`](../../lib/categorization/bank-category.test.ts): name, dictionary and learned matches, hierarchical labels, direction, generic labels, renamed and deleted defaults; [`personal-import/bank-category-column.test.ts`](../../lib/personal-import/bank-category-column.test.ts) and the «bank categories» cases of [`import.integration.test.ts`](../../lib/personal-import/import.integration.test.ts): reading the column, rules winning, corrections learned, re-imports staying duplicates.
- [`privacy-filter.test.ts`](../../lib/categorization/privacy-filter.test.ts), [`ai/groups.test.ts`](../../lib/categorization/ai/groups.test.ts), [`ai/suggest-for-user.test.ts`](../../lib/categorization/ai/suggest-for-user.test.ts), [`lib/llm/jev.test.ts`](../../lib/llm/jev.test.ts): blocked persons and transfers, batches of five, instructions, in-flight responses dropped, direction-limited options.
- [`merchant-name/*.test.ts`](../../lib/categorization/merchant-name), [`merchant-logo/merchant-logo.test.ts`](../../lib/categorization/merchant-logo/merchant-logo.test.ts): name extraction, dictionary logos, domains in text, name search gating.
- [`lib/categories/*.test.ts`](../../lib/categories): groups, picker order, onboarding setup (unit and integration), spending sums.
- [`lib/calc/subscriptions.test.ts`](../../lib/calc/subscriptions.test.ts), [`lib/subscriptions/view.test.ts`](../../lib/subscriptions/view.test.ts): cadences, price changes, clustering, totals of confirmed items only.
- [`eval-metrics.test.ts`](../../lib/categorization/eval-metrics.test.ts) supports the offline evaluation script [`scripts/eval-categorization.ts`](../../scripts/eval-categorization.ts).

## 7. Related

- [overview.md](overview.md), [bank-sync-and-imports.md](bank-sync-and-imports.md), [background-jobs.md](background-jobs.md), [analytics-and-goals.md](analytics-and-goals.md), [net-worth.md](net-worth.md)
- Decisions: [`2026-10-19-categorie-della-banca-negli-import.md`](../decisioni/2026-10-19-categorie-della-banca-negli-import.md), [`2026-10-12-categorizzazione-soglia-90.md`](../decisioni/2026-10-12-categorizzazione-soglia-90.md), [`2026-10-11-categorizzazione-llm-fase-0.md`](../decisioni/2026-10-11-categorizzazione-llm-fase-0.md), [`2026-10-11-categorizzazione-llm-fase-1.md`](../decisioni/2026-10-11-categorizzazione-llm-fase-1.md), [`2026-10-11-categorie-di-default-e-onboarding.md`](../decisioni/2026-10-11-categorie-di-default-e-onboarding.md), [`2026-10-10-abbonamenti.md`](../decisioni/2026-10-10-abbonamenti.md), [`2026-10-10-email-riepilogo-e-avvisi.md`](../decisioni/2026-10-10-email-riepilogo-e-avvisi.md), [`2026-10-11-trasferimenti-e-istruzioni-ai.md`](../decisioni/2026-10-11-trasferimenti-e-istruzioni-ai.md); archive [`decision-log.md`](../decision-log.md) (2026-09-20 rules, 2026-09-23 spending groups)
- Specs: [`2026-09-10-categorizzazione-regole-design.md`](../superpowers/specs/2026-09-10-categorizzazione-regole-design.md), [`2026-09-22-categorie-gruppi-spesa-design.md`](../superpowers/specs/2026-09-22-categorie-gruppi-spesa-design.md), [`2026-07-28-cashflow-entrate-dividi-design.md`](../superpowers/specs/2026-07-28-cashflow-entrate-dividi-design.md)
