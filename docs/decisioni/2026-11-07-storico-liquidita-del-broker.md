# 2026-11-07 — Broker cash history from the statements

Interactive Brokers cash accounts counted as manual accounts in the cash history: no past, so every day before the
account was added counted zero for it and the margin loan imported last week appeared as a cliff on the last days.
They are now rebuilt day by day from their statements (opening, dated cash movements, closing, each currency at that
day's rate), reusing the leverage card's `buildCashSeries`, for the stored cash history (Liquidità total, Panoramica,
sidebar, Analitiche) and for the account's own line in Liquidità (`GET /api/accounts/statement-cash`). Rows keep the
statement part in `net_worth_snapshots.statement_amount` (migration 0057; number to recheck at merge), so every import
or daily Flex sync moves the past; old rows have the broker balance they recorded as manual estimated and taken out.
Same 24-month window as the rest of the cash history. Deferred: DEGIRO and Trade Republic statement accounts (still
manual), a longer window for statement accounts. Living doc §4.1 of `docs/architecture/net-worth.md`.
