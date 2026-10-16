# Personal CSVs

From **Movimenti ("Transactions") → Importa un CSV personale ("Import a personal CSV")** or from the investment import picker, `/importazioni` opens. The user states the bank/broker and uploads a CSV file of at most 25 MB and 50,000 physical rows, with no requirements on headers, delimiters or number of columns. Explicit consent is recorded on the job with version `openrouter-raw-zdr-v2` and creation date.

The interface shows about one hour and the corresponding expected local completion time. It is an estimate: no artificial wait is introduced, and an overrun is reported. The page refreshes every 10 seconds. The worker saves automatically after the checks and sends a completion or error email; no human confirmation is required.

## Configuration and startup

App and worker: `DATABASE_URL`, `PERSONAL_CSV_ENCRYPTION_KEY` (32 random bytes in base64). Generate it once with `openssl rand -base64 32`; keep it as a secret and in backups. Rotation requires re-encrypting the data with the old and new key; replacing it directly makes existing parsers unreadable.

Chosen model: [DeepSeek V4.1 Flash](https://openrouter.ai/deepseek/deepseek-v4.1-flash), configured with `OPENROUTER_MODEL=deepseek/deepseek-v4.1-flash`. It can still be changed via an environment variable. For DeepSeek the worker disables optional reasoning, which on the full CSV can consume the whole budget without producing code, and reserves 32,768 total tokens for generation (240-second timeout); a truncated response is reported explicitly without importing data.

Worker only: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `RESEND_API_KEY`, `RESEND_FROM`, `APP_URL`; any credentials of the exchange-rate providers already used by the project. The model must support JSON mode through a provider that accepts `zdr: true`, `data_collection: deny`, `require_parameters: true`. There is no fallback to providers that retain data. The model's context must hold the entire CSV; if the provider rejects the input, the job fails with an explicit message, without truncating the file. The OpenRouter key is not needed in the web pod.

Run the migrations with `pnpm db:migrate`, the app with `pnpm dev`, the worker in another process with `pnpm worker:csv`. In production build the image with `docker build --target csv-worker ...`; the default final target remains the app. The release CI also publishes `buddy-budget-csv-worker` with the same version tag. Example Deployment in [deployment/personal-csv-worker.yaml](deployment/personal-csv-worker.yaml): replace the image and secret references in the infra repository before the release. Also configure the ingress body limit to at least 51 MiB: the 25 MiB CSV travels inside JSON. The Next proxy is configured at 51 MiB and the route checks the CSV's actual bytes. This change does not deploy anything or create production secrets.

## Execution and data

- Postgres: claim with `FOR UPDATE SKIP LOCKED`, 5-minute lease, fencing token, at most 3 attempts with increasing backoff. A worker runs one job at a time; additional pods can consume the same queue.
- File encrypted with AES-256-GCM, AAD bound to the user; deleted at the end or on final failure. Encrypted preview available for 7 days and deleted on save. TTL cleanup in the same worker; if the worker is down the API still denies access to expired payloads. Formats and versions persist until the account is reset/deleted.
- No private CSV in fixtures or logs. Only **the complete original text of the file (`rawCsv`) and the source name** go to the AI, without preliminary parsing, sampling, truncation or rewriting of the data. Any personal data also stays in the file: the updated consent states this; ZDR remains mandatory.
- The AI generates a synchronous JavaScript function that reads the raw file and interprets its structure, introductory rows, separators, headers and sections on its own. There are no rules specific to a bank or broker. The code is always validated and executed in the worker, never in the web request.
- Fresh QuickJS/WASM sandbox per invocation: 256 MiB heap, 512 KiB stack, interrupt after 3 seconds; child process without secret variables, Node heap limit 512 MiB, killed after 6 seconds even for non-interruptible regexes; maximum output 64 MiB. No host function, network, filesystem, `require` or `process` exposed to the model. The pod limits are a further boundary on resources.
- Physical rows serve only as references for coverage and preview; the model reads the original text. Each row produces exactly one outcome: movement, investment, justified exclusion, error. Real non-future dates, currencies and numeric limits are validated. Errors block everything and remain visible. Structural checks cannot prove the model's semantic correctness: saving is automatic after the checks, without a human review phase.
- Private parser per format, immutable versions. Choosing a personal format reuses its raw parser without AI; explicit regeneration creates a new version only if valid. The generated parser must recognize the file's structure; if the provider changes format the user can request a new analysis. The raw contract version distinguishes these parsers from the earlier table parsers.
- Cash, investments, private instruments and import receipts are written in the same transaction with a per-user lock; errors and sales exceeding the shares held roll back everything. Historical exchange rates are fetched in the worker and checked on save.
- Duplicates: hash of the original row and occurrence number in the file, per format. It keeps legitimate identical repetitions in the same file and recognizes reimports with shifted rows. Files with changed descriptions, different column orders or indistinguishable repetitions in partial exports require review. A different interpretation of an already imported row blocks the save; it does not silently correct the history.
- Email with an independent claim and retry every 15 minutes, Resend idempotency key per job; beyond the provider's deduplication window there may be a repeated notification if the process ends after sending and before saving.

## Financial scope

Cash: payments, income and internal transfers (excluded from the budget). Investments: buys, sells, dividends and coupons; commissions and taxes converted into the user's currency. Investment settlement movements are excluded from the budget so as not to duplicate expenses/income. A dedicated account and portfolio per source avoid implicit matches with linked accounts.

Opening balance zero: a complete history or a manual balance correction after the import is needed. We do not infer an official bank balance from a partial history. Private instruments with manual prices; the user can update the quotes in the existing flow. Corporate actions and bonds requiring nominal value/accrued interest are rejected: use the supported import or manual entry. We do not promise to interpret any CSV.

## Monitoring and checks

Structured `personal_import.*` events only with status, counts and job ID, never the source name, CSV or model response. Umami records request/reuse; the worker records the save. `/api/metrics` exposes the gauges `buddybudget_personal_csv_pending`, `_overdue`, `_failed`, `_emailPending`: alert when overdue/emailPending grow or the worker is unavailable. Apply the rules in the infra repository together with the Deployment.

Tests: `pnpm exec vitest run lib/personal-import`, with local Postgres and mocked provider/email. They cover the sandbox (loops, regexes, memory, host access), encryption, schema, user isolation, reuse, duplicates, concurrency, lease recovery, retry, email, TTL, atomic rollback and portability. The real OpenRouter test requires the worker's two secrets; it is not part of the automated tests.

## Management and deletion

In **Investimenti ("Investments") → Operazioni ("Transactions") → Gestisci importazioni ("Manage imports")** broker statements and personal CSVs are in the same list, sorted by upload date. Each personal CSV has a link to its detail and the Elimina ("Delete") command, even while the import is in progress.

Migration 0024 adds to the job the IDs of the movements and investments actually created and the deduplication receipts of the single upload. Deletion first shows the counts, verifies the confirmation again on the server and removes only that upload's data in one transaction. It updates the current account balances, preserves formats/parsers, accounts and instruments, and releases the receipts to allow reimporting. An upload made only of duplicates does not own the original movements and does not delete them. If other sales depend on the purchases to be removed, deletion is blocked until the dependent transactions are deleted. Uploads still being analyzed are removed and the worker can no longer publish their result.

The broker filter uses the name of the personal format chosen by the user, with separate groups per source. The intermediate `ready` state is a persistent saving phase: the worker resumes after a restart without repeating the analysis. The write is idempotent; validation errors become `review_failed`, transient errors are retried. Success emails concern only `imported` jobs.

## Coordinated activation in production

[Infra PR #29](https://github.com/YonderUrik/buddy-budget-infra/pull/29) prepares the SOPS Secrets, the Deployment at zero replicas, the resource quota and the upload limit. Merge it before the application release. The release CI updates the app, migrator and csv-worker tags together and scales the worker to one replica when the manifest is present. ArgoCD runs the migrations with the existing PreSync. The infra runbook describes cluster checks, email and shutdown. Opening the PRs alone does not deploy anything.

## Metadata and automatic recovery (October 2026)

New requests use the `openrouter-raw-zdr-v3` consent, which includes automatic regeneration when a saved parser fails. The promise not to send reused files to the AI still holds for jobs with the previous consent: those need a new authorised analysis. The sandbox and the financial checks remain mandatory.

`import_format_profiles` keeps format profiles per user and engine (AI, native, mapping): institution and how it was recognised, separator if known, sections, column indexes and names, mapping to normalised fields, and fields observed in the validated output. Native mappings that are not declared stay empty; the name of a generic CSV does not become an institution. Signature, count and dates make it possible to study recurring formats. No examples or financial values are stored. The payload uses application-level encryption (`encryptedText`) and is exported and removed together with the account data. Older parser versions stay readable without metadata; they are not sent to the AI just to enrich them.

Recovery of the personal parser is persistent: before regeneration the job drops its reference to the faulty parser and keeps the diagnosis. The new version is saved after the checks; rows that are still not recognised lead to the existing review. Network errors, changes or write errors are not resolved by altering how the data is interpreted.

In the broker wizard the optional consent enables the automatic start of a personal job when reading fails, verified again by the server. Repeated requests for the same file are deduplicated. The model reads the whole file and also produces the metadata. Original financial errors and a native history to be reconciled block saving, even after a successful AI analysis; no silent conversion of the broker history is attempted. The fallback does not change the destination of existing imports.

The support report uses `SUPPORT_EMAIL_TO` (default `support@buddybudget.io`), a separate idempotency key and a retry every 15 minutes. It contains reference, phase, classified cause, number of rows and their indexes, attempts and recovery outcome; it does not contain the CSV or raw errors from the parser. The events `personal_import.fallback.started`, `personal_import.support.sent/failed` and `import.metadata.failed` make the outcomes verifiable. `personal_csv_emailPending` includes the support notifications. No real email is sent by the tests.
