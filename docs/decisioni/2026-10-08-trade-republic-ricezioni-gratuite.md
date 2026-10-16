# 2026-10-08 — Trade Republic import: free crypto receipts and late taxes

The import failed with «Riga 225: amount non valido» ("Row 225: invalid amount"): the export contains `DELIVERY`/`FREE_RECEIPT` rows (staking and incoming transfers) with an empty `amount`, and `TAX` rows with a booking `date` months before `datetime`.

- Crypto `FREE_RECEIPT` rows are purchases at the file's market price, without cash, with a warning in the preview (rejected alternative: zero price, which would zero the cost basis even for incoming transfers of significant amount).
- `datetime` may follow `date` by any interval; it cannot precede it by more than one day.
- Other types in `DELIVERY`/non-crypto classes continue to block the file (no silent discard).
- Observability: no new signal; the outcome remains `investments.import.completed`.
