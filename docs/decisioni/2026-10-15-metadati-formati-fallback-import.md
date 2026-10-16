# Format metadata and import recovery

- We collect the institution (with how it was recognised), sections, original columns, declared mapping and the fields actually produced. Profiles are private per user and engine, versioned, deduplicated by signature and included in account export/reset. They contain no examples or transaction values; headers are protected by application-level encryption.
- A saved personal parser that fails execution, coverage, determinism or row recognition is replaced automatically by the AI. Before the call we withdraw the parser from the job persistently; retries do not restart from the faulty parser. Three attempts in total remain, plus the review of unresolved rows.
- The broker wizard offers consent to automatic AI recovery, for single files and batches. The server verifies the failure again. Financial errors require reconciliation: AI recovery cannot ignore them or duplicate earlier native imports. Files that are already readable stay in the broker flow.
- The consent moves to `openrouter-raw-zdr-v3`: the previous text promised that reuse did not send data to the AI. Earlier jobs do not trigger the new automatic regeneration; a new analysis collects the updated consent.
- Support receives a technical diagnosis without CSV, values or code, even when recovery succeeds. Claim, idempotency and email retry are separate from the import; the emailPending metric includes the support notifications. The normal emails to the user remain.
- Shared generic parsers are a future step: the collected profiles are observations, not an authorisation to share code or to automatically trust an institution inferred by the AI. The migrations are verified on a temporary Postgres; the current development DB has a pre-existing divergence (`product_country` already present), to be realigned before applying them there.

## End-to-end verification of 16 October

Real browser, local Postgres/Redis and real OpenRouter: tested the faulty saved personal parser and the unrecognised CSV from the broker dialog. Resend emails are intercepted by the test, with no real sending. Evidence and reproduction in `docs/evidence/import-fallback/README.md`.
The test found an AI parser that dropped the decimal point (`-12.50` became `-1250`). The independent check of directly mapped amount columns now rejects such results before persistence; the prompt clarifies both notations. It does not cover multi-column reconciliations, sections or ambiguous numbers: those remain an explicit limit, not an implicit guarantee of AI accuracy.

The unreleased migrations 0040 and 0041 were merged into 0040; the registry of the already migrated local database was realigned without changing data or schema. Drizzle snapshots are marked as generated in `.gitattributes`.

## Bitpanda inclusive fees

A local check found a second error: the AI parser added the fees to a price that already included them. The prompt now requires reconciling every debit/credit and explains how to derive the price before fees without altering quantities or zeroing costs. The convention is documented by [Bitpanda](https://support.bitpanda.com/hc/it/articles/360000902525-Quali-commissioni-e-sovrapprezzi-posso-aspettarmi-di-pagare-su-Bitpanda).
An independent check compares fiat amounts, quantities and fees of the recognised Bitpanda crypto exports both after running the parser and before confirming the preview. It also covers saved parsers; it does not assume the same convention for other brokers. Non-zero taxes, costs in another currency and unsupported classes require review. The committed fixtures are entirely synthetic.
