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
| Auto-apply | proposals at 70% or more | category with origin and confidence | [`auto-apply.ts`](../../lib/categorization/auto-apply.ts) |
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
                       │ >= 0.70 and autoApply on ──────────> regola | storico | assistente
                       └ otherwise ─> Categorizza «Da decidere» ─> utente (+ learned rule)
```

## 2. Principles

**P1 — The fallback is a flag, not a name.** The uncategorised category is the one with `isFallback = true`; `getFallbackCategoryId` creates it as «Da categorizzare» if missing. Renaming it changes nothing.

**P2 — Rules always apply.** User rules are explicit choices: they categorise new rows on sync, after CSV and broker imports, after a manual add and right after a rule is created or edited, whatever the auto-apply setting.

**P3 — Only likely proposals act alone.** A proposal is applied without the user only at confidence 0.70 or more (0.90 until 2026-10-19, lowered because nobody went through the cards: a wrong category costs one tap in «Messe dall'app» or Movimenti) (`AUTO_APPLY_THRESHOLD`), only if the user's `categorizationAutoApply` is on, only if no other transaction of the same group points elsewhere and, for AI proposals, only while the consent is active.

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
| `budgets` | `monthlyAmount` per category (the amount that repeats from now on), `rollover` and `rolloverFrom` (`YYYY-MM`), unique per user and category | [`budgets.ts`](../../lib/db/schema/budgets.ts) |
| `budget_months` | Month amounts of a budget: standing rows (`singleMonth = false`, from that month on) keep the past when the amount changes; single-month rows replace one month | [`budgets.ts`](../../lib/db/schema/budgets.ts) |
| `subscriptions` | only the user's decisions (`confermato`, `escluso`, `terminato`) and manual subscriptions, keyed by `key` | [`subscriptions.ts`](../../lib/db/schema/subscriptions.ts) |
| `auth_user` columns | `aiCategorizationConsentAt` (the «Assistente AI» consent in Impostazioni, shared since 2026-10-25 with «Chiedi all'AI» in «Cerca», overview §4.19), `aiCategorizationInstructions`, `categorizationAutoApply` (default true), `autoCategorizedSeenAt` (unused since 2026-10-19, to drop in a later migration) | [`auth.ts`](../../lib/db/schema/auth.ts) |

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

A history proposal counts as confident only if it reaches 0.70 and at least 3 past rows agree (`MIN_HISTORY_AGREEING`).

Example: key `esselunga`. Five past rows have key `esselunga`, four in Spesa and one in Svago. `confidence = 4/5 * 1.0 * 1 = 0.80`: shown as a proposal, not applied. With six rows all in Spesa, `confidence = 1.00` and 6 agree: applied when auto-apply is on.

Example (rule similarity): key `esselunga milano` against a rule pattern `esselunga` gives `1/2 = 0.50`: a weak proposal.

If a rule proposal is already confident, history is skipped; otherwise the better of the two wins (confident first, then source priority `regola` > `storico` > `assistente`, then confidence).

`groupByMerchant` groups uncategorised rows by `merchantKey::direction` (a purchase and its refund are separate groups). A group takes its best proposal and is flagged `hasDivergentSuggestions` if its rows point to different categories. `withAssistantSuggestions` then fills groups without a proposal from stored AI rows (`status = in_attesa`), and replaces an uncertain proposal when the AI one is confident.

### 4.5 AI proposals

`suggestCategoriesForUser` runs only with `aiCategorizationConsentAt` set and `OPENROUTER_API_KEY` present. It:

1. Groups fallback rows with `groupForModel` and skips groups already in `categorization_suggestions` (any status).
2. Runs `prepareMerchantForModel` on the raw bank text: cuts card boilerplate («Carta N.», «Data op»), extracts the name, blocks `operazione` texts (bonifico, giroconto, prelievo, F24, stipendio…) and blocks `persona` (2 to 4 words of letters only, no business word, not a card payment, no company ending). Blocked groups are counted and never sent.
3. Sends up to 120 groups per automatic run (600 and a 240 s budget for the manual «Categorizza con l'AI»), in batches of 5, to the OpenRouter Decisions endpoint with model `CATEGORIZATION_MODEL` (default `typesafe/jev-1.13`) and `provider: OPENROUTER_PRIVACY` (`{ zdr: true, data_collection: "deny" }`, `lib/llm/openrouter.ts`): only zero data retention endpoints, otherwise OpenRouter rejects the request.
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
| «Messe dall'app» (Set by the app) | rows with an automatic `categorySource` and `categorizedAt` in the last 30 days (`AUTO_CATEGORIZED_RECENT_DAYS`), at most 1000, grouped by merchant, direction, category and origin; group confidence is the lowest of its rows | `/api/transactions/auto-categorized`, `groupAutoCategorized` |

«Messe dall'app» is a history, not a to-do list: those categories are already on the transactions and count everywhere, nothing asks to confirm them, the tab has no counter and the page always opens on «Da decidere». The user only corrects what is wrong. Applying a choice (`POST /api/transactions/categorize-apply`, in batches of 5 groups from the client) checks ownership and direction of every row first, then in one transaction sets the category, the excluded amount, `categorySource = utente`, and optionally upserts the learned rule. Moving rows that had an automatic origin is counted as a correction (metric `categorization_auto_total` and log `categorization.auto.corrected`): this measures the errors of the 70% threshold.

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

A budget is an amount per month on an expense category. It is set in two places: the category's detail window (Liquidità → Categorie, `CategoryBudgetField`) and the **Budget** tab (`/liquidita/budget`), which is where budgets are followed. `PUT /api/budgets/[categoryId]` (`saveBudget` in [`lib/budgets/store.server.ts`](../../lib/budgets/store.server.ts)) takes any of `monthlyAmount`, `rollover` and `singleMonth: { month, amount | null }`; transfer categories are refused, a single month in the past is refused (`past_month`), and changing rollover or a single month on a category without a budget is `budget_not_found`. `DELETE` removes the budget and its month amounts.

**Month amounts.** The amount of a month (`budgetAmountFor` in [`lib/calc/budget-plan.ts`](../../lib/calc/budget-plan.ts)) is the single-month amount if there is one, otherwise the latest standing amount set on or before that month (the earliest one before the first change, the budget's current amount without history). The first time an amount changes, `saveBudget` writes the old amount at the month the budget was created and the new one at the current month, so past months keep what they had.

**Rollover.** With rollover on, the month gets the leftover of every month from `rolloverFrom` (at most 24 months back, `ROLLOVER_MAX_MONTHS`) to the month before: Σ(amount − spent), negative when past overspending ate into it. Switching it on sets `rolloverFrom` to the current month, so it never rewrites the past; switching it off and on again starts over. A new budget on a Saltuarie category starts with rollover on (`defaultRollover`); every other group starts with it off.

**The month plan** (`buildBudgetMonth`, served by `GET /api/budgets/month?month=YYYY-MM`, `lib/views/budget-month.ts`): for each budgeted category, `available` = max(0, amount + carried), `spent` (effective expense amounts of the month), `left` = available − spent and, for the current month and not for Saltuarie, `projected` = spent + the average spending of the previous 3 complete months *after today's day*. A rent paid on the 1st therefore projects to the rent, not to 30 times it. Totals add the budgeted categories; `perDay` = left / days to the end of the month (today included); `income` is the average income of the previous 3 months with data (transfers excluded), or the real one for a past month. Categories with spending and no budget are listed apart («Da categorizzare» is never one).

**Proposals** (`proposeBudgets`, current month only, categories without a budget): Dovute and Volute get the median of the last 3 complete months, Saltuarie the total of the last 12 months with data divided by those months, with rollover on; amounts are rounded up (5 € under 50 €, then 10 €). «Te futuro» and the fallback category get none. Nothing is proposed before a complete month of data. «Usa questi budget» posts the kept ones to `POST /api/budgets/accept-proposals`, which never overwrites a budget set meanwhile.

Panoramica's «Budget» and the mobile overview read the same month totals. Analisi reads the month's `available` per category when it shows one month, and scales the standing amount for longer periods (`scaleBudgetForPeriod`). The «Primi passi» step `budget` ticks when the user has any budget; the account export writes `budget.csv` (with rollover) and `budget-mesi.csv`.

Budget alert emails ([`lib/notifications/alerts.ts`](../../lib/notifications/alerts.ts)) fire at 80% and 100% of the month's `available`, once per category, month and threshold (Rome time); a single alert also says where the month is heading when `projected` is over the budget. The monthly summary counts the budgets gone over in the same plan and adds «Messi da parte per i mesi dopo» (the positive `left` of rollover budgets).

Example: Regali & Donazioni (Saltuarie), 50 € a month, rollover from July. July spent 20 (+30), August 110 (−60), September 0 (+50): October carries 20, so it has 70. On 22 October Spesa (420 €) has spent 300; in the last three months it spent 250 after the 22nd on average, so `projected` = 550 and the row reads «restano 120 € · a questo ritmo arrivi a 550 €».

### 4.12 Merchant logos

`resolveMerchantLogo` picks, in order of reliability:

1. The brand dictionary (`MERCHANT_LOGO_DOMAINS`, domains only for known brands) on the label and all texts.
2. A website written in the text (`domainFromText`: closed list of TLDs, registrable domain, payment intermediaries such as PayPal, SumUp, Stripe or Satispay skipped).
3. For expense groups that are not transfers, a name search key.

`merchantLogoPath` builds `/api/merchant-logos/<domain>` (dictionary, unsigned) or a path signed with an HMAC derived from `BETTER_AUTH_SECRET`, so the server only fetches what it found in the user's own rows. Logos come from Logo.dev with the publishable key and a Redis cache (browser cache one day, misses one hour). A name is searched on Logo.dev (`/v2/search`, `LOGODEV_SECRET_KEY`) only if at least 3 different users have it (`MIN_USERS_FOR_NAME_SEARCH`, counted with hashed user ids), within 100 searches per day, and only an exact name match is accepted. Found domains are cached 30 days, misses 7 days.

### 4.13 Subscription detection

`detectSubscriptions` ([`lib/calc/subscriptions.ts`](../../lib/calc/subscriptions.ts)) reads expenses of the last 26 months, excluding categories of type `futuro`, `entrata` and `trasferimento`. It groups them by `subscriptionKey`, which gives every spelling of one merchant the same key, and tries each cadence from the most frequent:

| Cadence | Gap (days) | Min charges | Max amount spread | Grace |
|---|---|---|---|---|
| settimanale | 6-8 | 5 | 0.08 | 3 |
| mensile | 27-34 | 3 | 0.08 | 7 |
| trimestrale | 86-96 | 3 | 0.15 | 14 |
| semestrale | 174-190 | 3 | 0.25 | 21 |
| annuale | 355-376 | 2 | 0.25 | 30 |

`subscriptionKey` tries, in order: a non-generic brand of the merchant dictionary (`APPLE.COM/BILL 800915904 IE` and `Apple.com/bill` → `apple`; `CLAUDE.AI SUBSCRIPTION ANTHROPIC.COM` and `Anthropic Claude Sub` → `claude`; `PAYPAL *NOW 1292C SPOR` → `now`), then the last website in the text that is not a payment processor (`foostream.com` → `foostream`), then the words of the text without digit-bearing tokens, the card and booking-date tail («Carta N. ***** 249 Data operazione 01/02/26»), country codes and single letters. Generic dictionary entries (cash withdrawal, stamp duty, fees, salary…) never key a merchant. The detected name is the brand when the dictionary knows it, else the bank text of the last charge.

A series passes if every gap fits the window (one skipped charge at double distance is forgiven), the day of the month stays within 5 days of the median for monthly or longer cadences, and amounts are constant (`(max - min) / median` within the spread) or move in at most 3 clean price changes (runs of one price, each but the last with at least 2 charges, each change between 0.5x and 2x; the latest change is reported). If the whole series fails, charges are clustered by amount (1% tolerance, at least 3 charges) to separate several subscriptions billed by one merchant, oldest cluster first. A cluster that comes out stopped is followed into the merchant's later charges: each next charge must fall in the cadence window (or one period later) and be within 0.5x-2x of the previous one, and charges of a cluster with 2 or more charges inside the stopped series' dates are a parallel subscription and are never taken. If the continued series passes, it replaces the stopped one (`continued`). A stopped series followed later by an active one of the same merchant at a price within 0.5x-2x (a plan changed after a pause) is not listed: the active one takes its keys.

Example: `PAYPAL *NOW 1292C …` at 29.99 from November to February and `PAYPAL *NOW X5105 …` at 19.99 from March, with a 9.99 one-off in May, is one active «NOW» at 19.99 with a price change from 29.99; until October 2026 it was a stopped 29.99 plus an active 19.99.

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

`buildSubscriptionsView` ([`lib/subscriptions/view.ts`](../../lib/subscriptions/view.ts)) merges detection with the stored decisions and manual rows. `matchStoredRows` pairs a series with its decision by key, then by one of its `aliases`: the keys the previous detection gave each bank spelling (`legacySubscriptionKey`, alone and per amount cluster), the per-amount keys of the merchant, and the keys of a stopped series it replaced. Decisions saved before the new keys therefore keep applying, and a second decision under another older key of the same series is a duplicate and is hidden instead of showing as «non addebitato da un po'». Manual rows match only by key. A saved name that is the untouched bank snapshot gives way to the detected name; a name the user typed is kept. Totals count only `confermato` and active items; detected items without a decision appear as «da confermare» and are totalled separately. Upcoming charges cover 30 days; price rises are shown for 365 days. Nothing detected is stored.

A decision («È un abbonamento», «Non lo è», «È terminato») is an upsert on `(user, key)` with a snapshot of what the user saw. The detected name is the raw bank description of the last charge, often longer than the 80 characters allowed for a typed name, so for decisions it is shortened to 80 characters instead of being rejected; the key is matched as is (up to 1000 characters). A refused save is logged as `subscriptions.save.rejected` (`reason`, and `field` for invalid input) and the list shows the error as a toast.

`subscriptions.detect.completed` logs, besides the counts per state, `continued` (series followed across a price or plan change), `matchedOlderKey` (decisions found under an older key) and `mergedDuplicates` (duplicate decisions hidden).

### 4.13 Transaction detail

Tapping a transaction opens its detail: a bottom sheet on the phone, a window on desktop. It opens from the Movimenti list (anywhere on the row except the category icon, «Dividi» and «⋯»), from the transaction lines under a group in Categorizza (cards, list and «Messe dall'app») and from «Ultimi addebiti» in a subscription. The dialog is [`movement-detail-dialog.tsx`](../../components/domain/liquidity/movement-detail-dialog.tsx), loaded with `next/dynamic` and exported from the light barrel [`liquidity/light.ts`](../../components/domain/liquidity/light.ts).

`GET /api/transactions/[id]` ([`load-detail.ts`](../../lib/transactions/load-detail.ts)) returns, for the owner only (404 otherwise, also for a malformed id):

| Field | How |
| --- | --- |
| `transaction` | the row with `logoPath`, as in the list |
| `account` | id and name |
| `origin` | `banca` (source `auto`, with the linked bank's name), `file` (external id `personal:<formatId>:…`, with the format's name), `broker` (`trade-republic:…`), `esempio` (sample-data account) or `manuale` ([`detail.ts`](../../lib/transactions/detail.ts)) |
| `rule` | only when `categorySource = regola`: the user's rule that matches the description (or the bank text) today, if it still gives the same category |
| `merchant` | the same `merchantKey` and direction over the last 365 days: count, total of the counted amounts and the five most recent others; null when the merchant appears once |

The list row is shown at once as placeholder data; origin and merchant summary fill in when the response arrives. Inside the detail the user changes the category (same flow as the row, `useTransactionCategory`), splits, writes the note (saved on blur), and for hand-typed transactions edits or deletes. A line of the merchant summary opens that transaction in the same window. Amounts go through `formatCurrency`, so «Nascondi importi» hides them.

«Chiedi all'AI», under the category card (not for transfers, hidden when the server has no `OPENROUTER_API_KEY`), asks the model about this one transaction: `POST /api/transactions/[id]/ai-suggestion` ([`suggest-one.ts`](../../lib/categorization/ai/suggest-one.ts)). It sends what the batch run sends for a merchant (cleaned name, MCC, direction, the user's categories, instructions and examples), with the examples of the same merchant left out so the answer is a second opinion rather than the user's own choice echoed back. It runs inside the request (one call, 30 s timeout, an exception to the job standard), writes nothing and returns `ok` with category and confidence, or `disabled` (no consent: the detail links to the setting), `no_key`, `blocked` (privacy filter: transfers, people), `limited` (30 questions per user per hour, Redis counter) or `failed`. «Usa questa» saves the category through the normal PATCH, so its source becomes `utente`; the answer is not stored in `categorization_suggestions`.

Example: a bank transaction «PAGAMENTO POS ESSELUNGA 0412», −60,40 €, with the rule «esselunga». The detail shows «Messa dalla tua regola per «esselunga»», «Dalla banca collegata, Intesa Sanpaolo», the bank text, and «51 movimenti nell'ultimo anno, −2.749,65 € in tutto» with the last five.

Signals: log `transactions.detail.loaded` (`outcome` = origin kind) and `transactions.detail.not_found`; for «Chiedi all'AI» `categorization.ai.single.suggested` or `categorization.ai.single.skipped` (`outcome` = status), `categorization.ai.single.failed` on a model error, and the existing `buddybudget_categorization_ai_requests_total`; Umami `transaction_detail_opened` (`from`: movimenti, categorizza, abbonamenti, esercente), `transaction_note_saved`, `transaction_deleted`, `transaction_ai_asked` (`outcome`), `transaction_ai_used`, and `categorization_auto_corrected` with `from: dettaglio`.

## 5. Limits and out of scope

- The 70% threshold is fixed; it is not adjustable by the user.
- Bank categories are read only from personal CSV imports (GoCardless does not send a usable category). The dictionary covers common Italian, English and German labels and is maintained by hand; a bank label it does not know falls back to the usual flow until the user's corrections teach it. Privacy policy and Terms describe the 70% threshold and the bank's category since `LEGAL_VERSION` 2026-10-19; they still await the professional legal review.
- A rule-similarity proposal reaches 0.70 only when most tokens match, so most automatic decisions come from exact rules, history or the AI.
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
- [`lib/transactions/detail.test.ts`](../../lib/transactions/detail.test.ts), [`transactions/[id]/route.test.ts`](../../app/api/transactions/[id]/route.test.ts): origin of a transaction, merchant summary, detail texts, detail route ownership.
- [`lib/categorization/ai/suggest-one.test.ts`](../../lib/categorization/ai/suggest-one.test.ts), [`ai-suggestion/route.test.ts`](../../app/api/transactions/[id]/ai-suggestion/route.test.ts): «Chiedi all'AI» answer, same merchant left out of the examples, consent/key/privacy/limit checks, ownership.
- [`lib/calc/budget-plan.test.ts`](../../lib/calc/budget-plan.test.ts), [`budgets/[categoryId]/route.test.ts`](../../app/api/budgets/[categoryId]/route.test.ts), [`accept-proposals/route.test.ts`](../../app/api/budgets/accept-proposals/route.test.ts), the budget cases of [`notifications/alerts.test.ts`](../../lib/notifications/alerts.test.ts): month amounts and history, rollover, projection with a rent on the 1st, proposals, ownership, alerts on the carried budget.
- [`eval-metrics.test.ts`](../../lib/categorization/eval-metrics.test.ts) supports the offline evaluation script [`scripts/eval-categorization.ts`](../../scripts/eval-categorization.ts).

## 7. Related

- [overview.md](overview.md), [bank-sync-and-imports.md](bank-sync-and-imports.md), [background-jobs.md](background-jobs.md), [analytics-and-goals.md](analytics-and-goals.md), [net-worth.md](net-worth.md)
- Decisions: [`2026-10-19-categorie-della-banca-negli-import.md`](../decisioni/2026-10-19-categorie-della-banca-negli-import.md), [`2026-10-12-categorizzazione-soglia-90.md`](../decisioni/2026-10-12-categorizzazione-soglia-90.md), [`2026-10-11-categorizzazione-llm-fase-0.md`](../decisioni/2026-10-11-categorizzazione-llm-fase-0.md), [`2026-10-11-categorizzazione-llm-fase-1.md`](../decisioni/2026-10-11-categorizzazione-llm-fase-1.md), [`2026-10-11-categorie-di-default-e-onboarding.md`](../decisioni/2026-10-11-categorie-di-default-e-onboarding.md), [`2026-10-10-abbonamenti.md`](../decisioni/2026-10-10-abbonamenti.md), [`2026-10-10-email-riepilogo-e-avvisi.md`](../decisioni/2026-10-10-email-riepilogo-e-avvisi.md), [`2026-10-11-trasferimenti-e-istruzioni-ai.md`](../decisioni/2026-10-11-trasferimenti-e-istruzioni-ai.md); archive [`decision-log.md`](../decision-log.md) (2026-09-20 rules, 2026-09-23 spending groups)
- Specs: [`2026-09-10-categorizzazione-regole-design.md`](../superpowers/specs/2026-09-10-categorizzazione-regole-design.md), [`2026-09-22-categorie-gruppi-spesa-design.md`](../superpowers/specs/2026-09-22-categorie-gruppi-spesa-design.md), [`2026-07-28-cashflow-entrate-dividi-design.md`](../superpowers/specs/2026-07-28-cashflow-entrate-dividi-design.md)
