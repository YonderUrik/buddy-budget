# CSV import: one flow, automatic recovery ladder

Status: implemented on 2026-10-31, branch `claude/csv-import-ladder`. Changed during the discussion: no Pro model, three Flash steps (the third with reasoning and a 128k output); the support report also goes out after a recovered import. §6 items 1–8 except the context table (§6.1) are the next PR.

## 1. Goal

The user picks a bank they already used (or types a new name), drops the file, and is done. They never see a row to fix, a preview to approve or a «rianalizza» button. Behind the scenes the worker tries harder models with more context; only when every attempt fails does the user see one error, pointing them to support, and the team receives a report.

Living doc of the current behaviour: [`docs/architecture/bank-sync-and-imports.md`](../../architecture/bank-sync-and-imports.md) §4.8–4.11.

## 2. User flow

1. `/importazioni`: name or existing bank, file. Same upload and consent as today (`openrouter-raw-zdr-v3`, unchanged: the same file goes to the same provider under ZDR).
2. «File ricevuto», then the island and the email report one of two outcomes:
   - **Imported**: «Importati N movimenti» (with the existing «N su M… gli altri c'erano già» counts).
   - **Failed**: one message, «Non siamo riusciti a leggere questo file. Abbiamo avvisato il team: scrivici a support@buddybudget.io se vuoi una mano.» No details, no actions besides contacting support.
3. Clean results are imported automatically, as today.

## 3. The recovery ladder

```
step 0  saved parser of this bank (latest version)                 no AI
step 1  Flash, fresh (old parser as reference if step 0 failed)    32k, no reasoning
step 2  Flash + the last rejection, 50 failing lines               32k, no reasoning
step 3  Flash + every rejection, 200 failing lines                 128k, reasoning on
fail    status failed, user message, support report
```

A step **passes** when all existing checks pass (`runCheckedParser`: schema, determinism, source amounts, Bitpanda settlements, `validateOutcomes` coverage) **and**:

- zero `error` outcomes;
- every column of every header the metadata declares is listed, mapped or with `mapsTo=[]` plus an `ignoredReason`. A header column missing from the metadata is a failure (`undeclared_columns`).

The first passing step wins: its parser is saved as a new version of the bank's format (`personal_parsers`), and becomes step 0 next time. This covers "same bank, new export layout": the old version fails at step 0, a new one is generated and saved, history and account stay the same.

**Failure classes.** Only a wrong parser climbs the ladder. Infrastructure failures (OpenRouter 5xx/429, timeout, network, sandbox unavailable, missing FX rate) retry the **same** step with the existing backoff (`attempts * 60 s`, max 3 per step). `ModelInputError` (input rejected) ends the job.

**Context for steps 2 and 3** (a second user message after the file):

- the code and metadata of the failed parser(s);
- the exact failure: validation message (`parserFailureDetail`), `undeclared_columns` list, non-deterministic output;
- the failing lines: row number plus raw line, at most 50, and the count of the others;
- for step 0 failures of a known bank, the previous working parser of that bank as reference ("this bank's earlier export was read like this").

All of this comes from the same file and the same job: nothing the model has not already been allowed to see.

**No Pro model** (owner, 2026-10-31): the newest DeepSeek Pro on OpenRouter (`deepseek-v4-pro-0813`) is a generation older than v4.1 Flash. The third step gives Flash reasoning and a 131,072-token output budget instead. An answer cut at 32k (`finish_reason: length`) jumps straight to step 3.

**Lease.** Step 3 can run up to 15 minutes: a keep-alive pushes the 5-minute lease forward every minute. Progress per step is persisted (`failureReport.attempts[]`), so a restarted worker resumes from the next step instead of step 1.

**Support report.** `notifyImportSupport` already emails `SUPPORT_EMAIL_TO` without file contents. It now lists every attempt: step, model, reason, detail, counts. Sent for every job with a failed attempt: every terminal failure, and every import that needed more than its first try (a saved parser that broke, or step ≥ 2). Skipped on self-hosted as today.

## 4. Deduplication

Kept: the whole-file fingerprint and the per-line receipts across all the user's sources.

Changed:

1. **Reinterpreted line → skip, not block.** A key already imported with a different `outcomeHash` (new parser reads the same line differently) is counted as already present instead of throwing «Una riga già importata ha una nuova interpretazione».
2. **Exact match on the parsed result**, for rows whose line key is new. Needed when a bank changes its layout: overlapping movements have different raw lines.
   - Cash key: `date | amount in cents (user currency, after FX) | normalised description` (trim, lowercase, collapsed spaces; compared with the stored `rawDescription`, decrypted in memory for the target account between the file's first and last date).
   - Investment key: `date | type | isin ?? lowercase name | quantity(8) | price(6) | grossAmount(2)` against the format's portfolio.
   - Multiset: for each key, `skip = min(unmatched file rows, rows already in the account − file rows of that key already matched by line key)`. Two identical coffees on the same day stay two.
   - Scope: only the bank's own account and portfolio (or the source adopted through `importedElsewhere`). No date tolerance, no similarity.
   - Skipped rows count in `alreadyPresent`.

Known limit: if the new parser builds the description differently (e.g. joins two columns the old one did not), the exact match misses and the row is imported again. Accepted; visible in support reports after step ≥ 2.

## 5. What is removed

- `review_failed` as a reachable state, `import_skipping_errors` and `reanalyze` actions on `PATCH /api/personal-imports/[id]`, `skipErrorRecords`, the «accepted-with-skips» parser path, the rows-to-check screen (`personal-import-review.tsx`, `personal-import-rows.tsx`, grouped reasons) and their email variant.
- Confirm-stage `ImportError`s (oversold history, profile currency changed, broker overlap) end in `failed` plus support report. Oversold can be legitimate (file starting mid-history): accepted for now, tracked through the reports.
- Existing `review_failed` jobs become `expired` (they expire within 7 days anyway). The enum value stays, no migration.

## 6. Improving the first call

Today step 1 sends the whole file and one long system prompt (parser contract + broker settlement rules + metadata), reasoning off, and asks the model to write a full CSV tokenizer in QuickJS. Proposed, in order of expected gain; each is measured with the eval set (§6 item 1) before shipping.

1. **Eval set first.** 20–30 synthetic files covering the main Italian/German banks and edge cases (preambles, `;` and `,` decimals, multiline quoted descriptions, sections, Excel conversions), with expected outcomes. A script reports first-attempt pass rate, tokens and latency per model and prompt. Without it, prompt changes are guesses.
2. **Helpers in the sandbox.** Preload tested functions: `csv.split(text, delimiter)` (quotes, CRLF, multiline), `num(cell, { decimal })`, `date(cell, format)`. The model writes the mapping, not the tokenizer, which is where most parser bugs come from. New parser signature `raw-csv-v2`; v1 parsers keep running.
3. **Deterministic hints in the input.** Compute in the host and pass alongside `rawCsv`: candidate delimiter, header line index, column count per line, decimal separator per numeric column, date patterns seen. The model confirms or overrides them.
4. **Bank prompt vs broker prompt.** A cheap deterministic check (ISIN-shaped cells, quantity/price headers, known broker headers) picks the prompt: bank files no longer carry the Bitpanda and investment rules. Ambiguous files get the full prompt.
5. **Metadata before code.** Require the JSON order `metadata` then `code`: declaring every column first gives the model a plan to follow, and feeds the `undeclared_columns` check.
6. **One worked example.** A short synthetic bank CSV with its expected parser using the helpers, as a few-shot.
7. **A small reasoning budget.** Reasoning was disabled because it ate the 32k budget on long files; with helpers and a shorter prompt, test `reasoning: { max_tokens: 4000 }` on the eval set.
8. **Optional, needs a decision: send a sample instead of the whole file.** Header, preamble, first 40 and last 20 lines plus one line per distinct shape. Cheaper, faster, less data to the model; the parser still runs on every line and step 2 sends the failing ones. Reverses the "full input, never sampled" choice of `generate.ts`, so not in the first pass.

The static system prompt stays first in the request so provider-side prefix caching applies.

### 6.1 Missing context (added to every call, step 1 included)

Today the model receives only `{ sourceName, rawCsv }`. Added, none of it personal data:

| Context | Why |
|---|---|
| `defaultCurrency` (the user's currency) | Most bank CSVs have no currency column, and the prompt forbids guessing it: today the model either guesses or errors. The field says: use it when the file shows no currency. |
| `today` and `dateOrderHint` (from the user's country: `dmy` for IT/DE) | `03/04/2026` is ambiguous when every day in the file is ≤ 12; the host refuses future dates, but the model cannot know today's date. The hint only breaks ties; cells win. |
| `origin`: `csv` or `xlsx` (first sheet, dates already ISO, numbers dot-decimal) | Excel files reach the model as CSV produced by `gridToCsv`: their numbers do not follow the bank's locale. **Deferred**: the job does not store it, and adding it needs a migration. |
| `previousParser` (code + metadata of the latest version) for a known bank | Already planned for steps 2–3; also at step 1 when step 0 failed, so a small layout change is a small edit. |
| The acceptance checks, stated in the prompt | Zero `error` rows, every header column declared, source amount column must match, two runs must be identical. The model is not told today how it will be judged. |
| `fileKind` hint from the deterministic classifier (§6 item 4) | Bank, card, broker or unknown. |

Not added: the holder's name, IBANs or other accounts (needed for perfect `transfer` detection, but personal data; transfers stay recognised from the text, and categorisation handles the rest).

## 7. Observability

- Logs: `personal_import.attempt.succeeded|failed` with `jobId`, `step` (0–3), `reason`; `personal_import.failed` gains `step`.
- Metric: `buddybudget_personal_import_attempts_total{step, outcome}` (`reused`, `accepted`, `rejected`) via `recordPersonalImportAttempt`.
- Umami: `personal_csv_imported` (rows, bank categories) and the new `personal_csv_failed`, both sent by the receipt only for a job seen finishing there.
- Alert (infra repo): share of jobs reaching `failed` over 24 h above a threshold; runbook in `docs/runbooks/`.

## 8. Tests

- `analysis.test.ts`: ladder order, which failures climb and which retry, `ModelInputError` jump, step persistence and resume, Pro unset.
- `confirm` unit and `import.integration.test.ts`: reinterpreted lines skipped, exact match after a layout change with multiset counts, no match across accounts, removal of skip/reanalyse paths.
- Contract: undeclared columns rejected.
- Eval set script (§6 item 1), run by hand and in a nightly job when an API key is available.

## 9. Out of scope (deferred)

- Parsers shared between users (decided 2026-10-31: few users, regenerate per user). Design notes in the conversation: layout fingerprint, literal scan, promotion after two users.
- Fuzzy duplicate detection, dedup against GoCardless or manual accounts, choosing an existing target account.
- Merging the broker wizard (IBKR, DEGIRO, Trade Republic) into this flow.

## 10. To do with the PR

Decision entry in `docs/decisioni/`, living doc §4.8–4.9 updated, `docs/personal-csv-import.md`, catalog check (no landing impact), `#bb-backlog` row. Infra repo: dashboard panel and alert on the attempts metric.
