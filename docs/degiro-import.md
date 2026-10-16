# DEGIRO import into the same portfolio as IBKR

The wizard recognizes the Italian **Account.csv** export (Estratto conto, account statement), keeps every original row and imports buys, sells and dividends net of adjustments. With a single portfolio it selects it automatically; with several portfolios the destination must be chosen. A source that has already been imported keeps its own destination.

## Reconciliation and costs

- Booking dates, not value dates; rows within the same minute are ordered as in DEGIRO's running balance.
- Running balances and totals are checked separately per currency. Internal flatex sweep rows stay archived but are not counted twice in the economic balance.
- EUR commissions and taxes are split only once across the fills of the same order, in proportion to their value. Taxes on purchases also go into the app's cost basis.
- Prices in GBX pence are normalized to GBP. The FX pairs linked to the order provide the actual EUR exchange rate; when they are missing, the app's normal historical exchange rate is used.
- Dividends and withholdings reversed/rebooked on the same day are netted. Interest, connection fees and other supported cash items stay in the ledger, without arbitrarily attributing them to the profit of a security.
- Unknown movements, costs that cannot be matched, incomplete history and inconsistent balances block the import rather than discarding financial rows.

## Shared portfolio and import management

Migration 0021 adds the origin to transactions and a persistent relationship between source, portfolio and cash account. IBKR and DEGIRO share the portfolio while keeping separate cash accounts and imports. Overlap replacement and deletion of dependencies operate only on the same source. An identical file is idempotent. Partially overlapping periods require an export that fully covers the imports involved, as for IBKR.

## Explicit limits

Account.csv contains no NAV, closing prices, certified position snapshots or account identifier. The report shows the cash and states that the valuation is missing; it does not invent NAV or closing prices. The app's positions derive from the transactions. For now only one DEGIRO account per user is supported. Exports in other languages, other file types and unrecognized security transfers require a dedicated extension. Tax reconstruction by lot remains out of scope.

## Local verification and observability

Verified with the real file provided together with the four IBKR statements: 146 fills and 10 dividends, 985 rows kept including headers, no reconciliation errors; reimport without duplicates and IBKR documents unchanged. 147 targeted tests passed, type check and lint without errors; the reimport with 156 transactions already present was also verified in the browser. Personal files and verification artifacts are excluded from Git. The public fixture is entirely synthetic. The tests cover shared costs, GBX/FX, reversals, isolation between brokers, replacement and deletion in both directions.

Reused the `investment_import.*` logs, the wizard's Umami events with provider `degiro` and the existing job metrics; no new external dependency or dedicated metric. In production, check the job outcomes, the absence of reconciliation errors and counts consistent with the preview. Landing catalog synced; no visible change to the published demo screens (the wizard and statements are not part of the tour).
