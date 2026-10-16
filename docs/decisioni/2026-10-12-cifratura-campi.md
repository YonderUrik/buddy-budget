# Encryption of sensitive fields in the database (2026-10-12)

- **Decision (Daniele)**: encrypt the most sensitive text fields in the database without breaking existing data. `encryptedText` columns (AES-256-GCM, key `DATA_ENCRYPTION_KEY`, value `enc:v1:…`): description, raw text and note of transactions, notes of debts, operations and capital losses, GoCardless tokens. Google tokens encrypted by better-auth (`encryptOAuthTokens`).
- **Compatibility**: no migration (the columns remain `text`); without a key, plaintext is written as before; plaintext rows are always readable; `pnpm db:encrypt-fields` (dry run, then `--execute`) encrypts the old ones, idempotent. Tested with the whole suite with the key on.
- **Constraints**: no SQL filters, sorting or GROUP BY on these columns (random IV): the examples for the AI assistant are now grouped in memory over the last 5,000 transactions. Once active, the key must not be lost or changed and there is no going back to previous images.
- **Infra**: optional Secret `app-data-encryption`, script `crea-chiave-dati.sh`, suspended CronJobs `encrypt-fields(-prova)`, runbook `docs/runbooks/cifratura-dati.md` in the infra repo.
- **Postponed**: VPS disk encryption (on a single server either the key is typed at every reboot, or it is kept on the same disk); key rotation.
