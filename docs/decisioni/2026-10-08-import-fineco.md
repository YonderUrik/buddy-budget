# Fineco import (2026-10-08)

- New «Fineco» provider in the Investimenti import: it reads the Excel export «Movimenti Dossier Titoli» (also as CSV), which is a **history of operations**, not a list of positions. It imports purchases and sales (Segno A/V, operation date, «amministrato» fees); dividends and coupons if the description indicates them; every other row is ignored with a message in the preview. It does not import balances or cash.
- Implementation: the `.xlsx` sheet is read in the browser (`readXlsx` from Pensione), cleaned into a neutral table (`lib/investments/import/fineco.ts`) and goes through the generic mapping/preview; no server change.
- To verify with real files: the sample file only contained EUR purchases; the handling of sales, dividends and foreign-currency securities is inferred from the headers.
- Logo: provided by the owner (`public/import-providers/fineco.png`), FinecoBank trademark used only to indicate the source of the file.
- Observability: Umami event `investments_import_file_read` with `provider: "fineco"` and `investments_imported` with `format: "fineco"`; no new metric.
