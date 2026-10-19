# 2026-10-19 — Transaction detail

Daniele asked that tapping a transaction shows its details. Before, tapping a row in Movimenti did nothing (only the category icon, «Dividi» and «⋯» reacted).

- One detail for every list: Movimenti, the transaction lines in Categorizza and the charges of a subscription. Bottom sheet on the phone, window on desktop (the app's dialog default).
- It shows amount, day and account, category with who chose it (the rule is named), origin (bank, file import with the format name, broker statement, sample data, typed by hand), bank text, MCC, note and the same merchant over the last year; actions: change category, Dividi, and for hand-typed rows Modifica/Elimina.
- New `GET /api/transactions/[id]`; the list row is shown at once and the rest fills in. Note editing moves inline into the detail (the «⋯» popover stays).
- Deferred: a URL per transaction (deep link from emails or notifications), the detail in Debiti's transaction picker.

Living doc: `docs/architecture/categorisation.md` §4.13.
