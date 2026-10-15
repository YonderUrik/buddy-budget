# Import fallback: end-to-end verification

Verified locally on 16 October 2026 (Europe/Berlin), with a real Chromium browser, Next.js app, worker, PostgreSQL, Redis and **real OpenRouter generation**. All inputs and users are synthetic. Resend requests were intercepted in the worker: recipient, body and idempotency key were checked; real email delivery was **not** tested.

## Results

| Scenario | Evidence |
| --- | --- |
| Personal upload using an existing parser that throws | Browser upload accepted (202), automatic AI replacement, final `imported` status |
| Unrecognized CSV uploaded through the broker dialog, with AI consent | Automatic fallback message, durable job, final `imported` status |
| Financial persistence | Exactly two cash movements per user: +1000.00 and -12.50 EUR, total 987.50 EUR |
| Format learning | Institution `Synthetic Bank`, evidence `document`; Date/Amount/Currency/Description columns mapped to normalized fields |
| Payload lifecycle | Raw CSV and preview removed after import; metadata remains |
| Support notification | One captured report per failed import path, addressed to support@buddybudget.io, with original failure reason and idempotency key; no transaction descriptions |

Machine-checked results, job IDs and captured report bodies: [result.json](result.json).

![Personal CSV imported](personal-imported.png)
![Broker fallback started](broker-fallback-started.png)
![Broker CSV imported](broker-imported.png)

## Defect found and fixed

The first live run generated a personal parser that stripped decimal dots, producing 100000.00 and -1250.00 instead of 1000.00 and -12.50. Comparing actual database amounts caught the problem; completing the UI flow alone would have missed it.

`validateSourceAmounts` now independently compares unambiguous, directly mapped cash amounts with the original CSV before accepting the parser. A mismatch rejects that attempt before financial writes. The prompt also explicitly distinguishes decimal dots and commas. Unit tests cover the observed failure and decimal notation; the database integration test checks that a rejected parser creates neither movements nor a reusable parser.

This guard is deliberately limited: composite amounts, multi-section mappings, ambiguous numeric formats and investment reconciliation are not covered by this comparison. It also depends on declared metadata and does not prove that every AI interpretation is correct. The browser fixture exercises cash imports through both entry points; broker-specific investment histories remain covered by the existing parser/integration suites, not this live fixture.

## Reproduce

Requirements: installed project dependencies, local PostgreSQL and Redis configured in `.env.local`, OpenRouter key/model with ZDR support, Playwright and Chromium. Port 3317 must be free; stop any other Next development process in this checkout first.

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
CHROMIUM_PATH=/absolute/path/to/chromium \
node scripts/e2e/run-import-fallback.cjs
```

The runner creates a uniquely named `buddy_e2e_*` database, migrates it, seeds two synthetic sessions and one broken saved parser, starts the app/worker, uploads through the UI, checks persistence and captures screenshots. It drops its database and stops its processes on completion. It makes real AI requests (provider charges apply), but intercepts all worker Resend requests. It never writes production data. Evidence is regenerated in this directory.

## Regression checks on the PR base

- 180 tests passed across 26 files: personal-import, import metadata, existing broker parsers and import API routes (16 October 2026).
- `tsc --noEmit`: passed.
- ESLint on personal-import, metadata, import APIs/UI and E2E scripts: passed.
- Reproducible runner repeated successfully after rebasing onto current main; screenshots and `result.json` in this directory are from that final run.

## Manual fixture

Upload [synthetic-bank.csv](synthetic-bank.csv) through Investments → Import, enabling automatic AI analysis. Expected result: two cash movements, +1000.00 EUR and -12.50 EUR; institution Synthetic Bank. The file intentionally has a preamble so the standard broker reader cannot map it. Re-uploading this same broker file is deduplicated.

## Bitpanda inclusive-fee regression

The AI can also mistake a separately displayed fee for an additional debit. For recognized Bitpanda crypto exports, `Amount Fiat` is now independently reconciled with quantity × pre-fee execution price plus/minus fees. Validation runs for reused and generated parsers and again when confirming an existing preview. Source quantities and fees must match; unsupported tax/fee-currency conventions fail closed.

The synthetic database test imports a 200 EUR purchase with a 1.99 EUR included fee, retaining that fee and deriving a 198.01 EUR principal. It verifies a 100 EUR remaining balance, a 200 EUR acquisition cost and no writes from a stale double-counting preview. No original user CSV or personal parser is included in this repository.

To generate a **fresh real AI parser**, without manual code changes, using the synthetic fixture:

```sh
node --env-file=.env.local --import tsx --conditions=react-server scripts/e2e/verify-bitpanda-ai.ts
```

This additional check exercises the improved prompt and deterministic reconciliation without modifying a database or sending emails. It uses up to three provider calls; invalid model outputs are rejected rather than silently accepted.

Live synthetic rerun with the strengthened prompt (16 October 2026): `deepseek/deepseek-v4.1-flash`, first attempt accepted, remaining balance 100 EUR, no manual parser edits. Unit and database regressions cover double fees, altered quantities/fees, omitted transactions, unsupported costs and stale previews.
