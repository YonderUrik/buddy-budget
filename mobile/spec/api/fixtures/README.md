# API fixtures

Real responses captured from a local `buddy-budget` dev server (branch `feat/mobile-api-foundations`, commit
`4b39b2ce`, 2026-10-18) for the apps' decoding and snapshot tests. Each file is the exact JSON body of one call unless
noted. All data is invented (the public demo's sample account); ids are real UUIDs of the local database and mean
nothing elsewhere.

**User:** `mobile-dev@buddybudget.test` ("Giulia Demo", IT, `it`, EUR) created with
`pnpm dev:mobile-session --email mobile-dev@buddybudget.test --demo` (sample data: 4 accounts, 345 transactions, budgets,
13 investment positions, 1 pension fund, 3 loans). For the captures its linked account "Conto corrente" also had a
**dev-only fake bank connection** ("Banca Demo", consent expiring in ~5 days, last sync 3 h before), added by hand so
that `health` and `renewalAlerts` are populated; `pnpm dev:mobile-session` does not create it.
`*-de*` files and the German rows of `errors-country.json` use `mobile-dev-de@buddybudget.test` (DE, `de`, EUR, German sample data, `pnpm dev:mobile-session --email mobile-dev-de@buddybudget.test --demo --language de`).
`*-en*` files use `mobile-dev-en@buddybudget.test` (IT, `en`, no data, categories stored in Italian).
`today` is `2026-10-18` where the endpoint takes it.

| File | Call |
|---|---|
| `auth-email-otp.json` | `POST /api/auth/email-otp/send-verification-otp`, a wrong code, `POST /api/auth/sign-in/email-otp` (token values replaced by placeholders), then `GET /api/me/bootstrap` with the new token (a new user → `gate: "onboarding_required"`) |
| `me-bootstrap.json` | `GET /api/me/bootstrap` |
| `support.json` | `POST /api/support` (400 IT, 502/429 DE localized, 401) and `POST /api/client-errors` (204, 400); `created` is the contract example because the dev server's placeholder Resend key makes every valid report a 502 (2026-10-19) |
| `overview.json` | `GET /api/overview?period=3mesi&includePension=1&today=2026-10-18` |
| `overview-1anno-no-pension.json` | `GET /api/overview?period=1anno&includePension=0&today=2026-10-18` |
| `liquidity-month.json` | `GET /api/liquidity/month?today=2026-10-18` |
| `liquidity-month-account.json` | same, `&accountId=<linked account>` |
| `liquidity-month-en-empty.json` | same, English user without accounts or transactions |
| `liquidity-analysis.json` | `GET /api/liquidity/analysis?period=mese&today=2026-10-18` |
| `liquidity-analysis-previous-month.json` | same, `&ref=2026-09-15` |
| `liquidity-analysis-anno.json` | `GET /api/liquidity/analysis?period=anno&ref=2026-10-18&today=2026-10-18` |
| `investments-view.json` | `GET /api/investments/view?period=3mesi&today=2026-10-18` |
| `investments-view-ytd-excluded.json` | `GET /api/investments/view?period=ytd&excludeBrokers=manual&today=2026-10-18` |
| `investments-performance.json` | `GET /api/investments/performance?period=3mesi&today=2026-10-18` |
| `investments-performance-max.json` | `GET /api/investments/performance?period=max&today=2026-10-18` |
| `investments-income.json` | `GET /api/investments/income?today=2026-10-18` |
| `investments-taxes.json` | `GET /api/investments/taxes?today=2026-10-18` |
| `investments-simulate-sale.json` | `POST /api/investments/taxes/simulate-sale?today=2026-10-18` body `{ "instrumentId": "<an ETF held>", "quantity": 5 }` |
| `analytics-base.json` | `GET /api/analytics/base?today=2026-10-18` |
| `goals.json` | `GET /api/goals` (2026-10-19, server today; 3 open goals with account and position sources, FIRE comparison) |
| `financial-planning-results-de.json` | `GET /api/financial-planning?include=results` (German user, see below) |
| `financial-planning-results-preview-de.json` | `POST /api/financial-planning/results` with the saved plan and `tax.historyConfirmed: true` |
| `errors-country.json` | country-gate 403s: German user on `/api/investments/{taxes,income}`, `/api/pension/view`, `/api/analytics/base`; Italian user on `/api/financial-planning` |
| `meta-public-en.json` | `GET /api/meta?language=en` without a session |
| `meta-onboarding-de.json` | `GET /api/meta?country=DE&language=de` without a session |
| `meta.json` | `GET /api/meta` with the Italian user's session |
| `whats-new.json` | `GET /api/whats-new` |
| `debts-insights.json` | `GET /api/debts?include=insights` |
| `pension-view.json` | `GET /api/pension/view?today=2026-10-18` (first fund) |
| `transactions-page.json` | `GET /api/transactions?limit=20` |
| `transactions-page-2.json` | `GET /api/transactions?limit=20&cursor=<nextCursor of the first page>` |
| `transactions-page-filtered.json` | `GET /api/transactions?limit=20&type=uscita&q=supermercato` |
| `transactions-page-uncategorized.json` | `GET /api/transactions?limit=20&uncategorized=1` |
| `accounts.json` | `GET /api/accounts` (raw rows) |
| `accounts-include.json` | `GET /api/accounts?include=trend,health&today=2026-10-18` |
| `categories.json` | `GET /api/categories` (Italian user) |
| `categories-en.json` | `GET /api/categories` (English user: default names localized by the server) |
| `budgets.json` | `GET /api/budgets` |
| `categorization-rules.json` | `GET /api/categorization-rules` |
| `gocardless-native-flow.json` | R6 bank linking from the apps: `POST /api/gocardless/connections` with `client: "native"`, the public `GET /api/gocardless/callback/native` 302s (`location` = `buddybudget://bank/return?…`), `POST /api/gocardless/connections/{id}/complete` and `finalize`, with their errors. Only partly captured (`captured: true`): the dev server has no GoCardless credentials, so the success bodies follow the server's zod contracts (see the file's `_note`) |
| `errors.json` | error bodies with their `code`: `{ request, requestBody?, status, body }` per case (bad query params, not found, validation, conflict, no session) |

Money: raw rows carry numeric **strings** (`"-250.00"`), view endpoints carry JSON **numbers** (see README §7). Don't
assert on full float equality across server versions: views are recomputed from live data and prices.

To refresh: start `pnpm dev` in `buddy-budget`, run `pnpm -s dev:mobile-session --email mobile-dev@buddybudget.test --demo`
for a token, and repeat the calls above with `Authorization: Bearer <token>`.

### Imports (Phase 4c, 2026-10-19, `mobile-dev@buddybudget.test`, server branch `feat/mobile-api-foundations` with `pnpm worker:csv`)

| File | Call |
|---|---|
| `investments-import-parse-degiro.json` | `POST /api/investments/import/parse` with `imports/degiro-account.csv` (raw `text/csv`) |
| `investments-import-resolve.json` | `POST /api/investments/import/resolve` with the identities of the parse above |
| `investments-import-dry-run.json` | `POST /api/investments/import` `dryRun: true`, `statementCsv` = the DEGIRO file, the proposal of the resolve |
| `investments-statements.json` | `GET /api/investments/statements` right after importing the same file (deleted again afterwards) |
| `personal-imports-review.json` | `GET /api/personal-imports` after uploading `imports/banca-prova.csv` (format «Banca Prova»): the AI parser rejected 6 of 7 rows (`review_failed`) |
| `personal-import-preview.json` | `GET /api/personal-imports/{id}` of that job |
| `personal-imports-imported.json` | `GET /api/personal-imports` after «Rianalizza con l'AI» (`imported`, 6 movements) |
| `personal-import-deletion.json` | `GET /api/personal-imports/{id}?deletion=1` of the imported job (deleted afterwards) |

`imports/` holds the sample files (invented data) and `import-rules-vectors.json`, golden vectors of the broker-file and
XLSX rules generated from the web TypeScript (`lib/investments/import/*`, `lib/pension/import/xlsx.ts`) with today =
2026-10-19. `imports/sample.xlsx` is a hand-built workbook (shared, rich and inline strings, a custom date style, gaps,
entities, number edge cases).
