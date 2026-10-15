# Interactive Brokers import

## Behavior

Import complete, consecutive English Activity Statement CSVs in chronological order, starting from the period with zero opening balances. The server re-reads the CSV: changing the transactions in the request does not change the imported data. Each broker account has a dedicated portfolio and a cash account, which may be negative. The account balance uses the NAV cash at the closing date, converted into the user's currency.

All original records, including non-normalized sections, are kept in the account export. Rendiconti ("Statements") shows NAV, positions, cost/P&L reported by the broker and cash movements in the original currency. Deposits and currency transfers do not become budget income; commissions already included in trades are not charged twice.

Cash, quantity and period matching is required before the atomic save. A per-user lock and the document fingerprint prevent duplicates even with concurrent requests. A new CSV atomically replaces the statements it fully covers; preview and confirmation show the replaced periods and transactions. Partial overlaps require a wider export. Any later statements are kept only if cash and positions remain reconciled. An error fully restores the previous data. Transactions of the reconciled portfolio cannot be edited/deleted individually.

## Import management

From Operazioni ("Transactions") → Gestisci importazioni ("Manage imports"): list by period, account and upload date; update via a new CSV and deletion with explicit confirmation. Deleting a period includes the later ones of the same account, because they depend on the history: the exact list is verified again on the server under lock. Balances and transactions are updated in the same database transaction. Cash goes back to the previous statement or to zero; the empty account, the catalog and historical prices remain available. The account–portfolio link is persistent, so reimporting after a deletion reuses the cash account. No data of other users or accounts is deleted. Earlier generic imports have no batch metadata and remain in the Operazioni tab.

## Identity and corporate actions

An ISIN change present in the statement resolves the aliases into the same identity. ISIN and currency come from the broker, without automatically choosing a different Yahoo listing. Manual instruments are private; the indexes distinguish user and currency. Closing prices are saved even for positions without trades in the last period.

For a spinoff fully sold within the same statement, the sum of the sales' cost bases transfers basis and shares from the original security to the new security via non-monetary adjustments. If quantity or basis cannot be reconstructed, the import is blocked and asks for the lot detail. Other unsupported corporate actions block the import.

## Explicit limits and future work

- IBKR snapshots are the file's exact historical values, not current quotes. New instruments have manual prices from the statement; linking them to a quote source comes later.
- The app's average cost and tax estimates are not IBKR's lot-based tax engine. Retroactive cost-basis revisions not explained by the movements are kept in the reports, not invented in the ledger. Tax equivalence requires an export of lots/corporate actions.
- Migrating earlier generic imports requires a dedicated flow. Do not import the same history again into a generic portfolio, to avoid double counting overall.
- A cash-only file, without securities transactions, is not yet handled by the existing wizard.

## Verification

Parsing, accounting and PostgreSQL integration tests cover preview without writes, consecutive series, balances/prices, concurrent duplicates, user isolation, tampered input, overlaps and inconsistent data. Complete anonymized fixtures and reconciled synthetic CSVs are in `lib/investments/import/__fixtures__`.

Local verification on the four authorized exports: 134 transactions (including two adjustments), four documents, no duplicates on the second import. Results and personal data only in the ignored directory `test-results/ibkr-replay`. Typecheck and lint without errors; 111 targeted tests passed. The full suite flagged a pre-existing logger test that looks for the string `mario` in the stack and catches the local checkout path; the parser test failure that emerged in the same run was fixed and re-verified in the targeted suite.

Additional import management verification: 13 integration tests cover YTD replacements, multiple covered periods, concurrent imports, rollback after a write error, later periods, stale confirmations, user/account isolation and delete–reimport reusing the cash account. Browser flows verified with synthetic CSVs; the four personal imports were not modified.

## Observability and release

The APIs use `withRoute`; successful import: `investments.import.completed`, insert count; reconciliation errors are 422 responses, without saving movements. The wizard keeps the existing import Umami event; deletion is observable via the `investments.import.deleted` log and the Umami `investments_import_deleted` event (counts only). No new job/cron/metric. The existing synchronous exception remains: short local transaction, price history in the background; exchange rate availability may require an initial fetch.

Feature catalog, landing copy and eight screenshots of the investment tabs updated using only the synthetic demo database. Before the release, apply the versioned migrations; no change to production was made during this local verification.

### Import management in Operazioni

Management of imported CSVs is in the Operazioni tab, in «Gestisci importazioni» ("Manage imports", an expandable section initially collapsed) above the transaction list, even when there are no transactions. The Rendiconti tab and its summary in the Portfolio were removed; old links redirect to Operazioni. The document history and the replace and delete functions remain available without changing the saved data.

## Start over after pre-existing imports

From **Operazioni → Gestisci importazioni → Rimuovi tutti gli import e azzera gli investimenti** ("Remove all imports and reset investments"), the summary shows how many transactions, statements, personal prices and broker accounts will be affected. Typing `AZZERA INVESTIMENTI` is mandatory. Old CSVs had no provenance: to also remove those duplicates, the reset deletes **all** investment transactions, including manual ones and those from other CSVs. It is not a reset of the whole account.

The server verifies the fingerprint of the data shown and rejects stale confirmations. Atomic reset with the same lock as the imports; no conversions or external requests. It also removes the snapshots of the investments class (including today), resets only the explicitly linked cash accounts and updates today's total cash. It keeps portfolios, cash account associations, instruments, shared prices, settings and manually entered minusvalenze (capital losses). Earlier aggregated cash snapshots are not rewritten: they do not contain the share attributable to the individual broker.

After the reset, reimport the full history, from the oldest period to the most recent. Banks and their movements, budgets, debts and pensions are not deleted. No migration needed. Logs `investments.import.reset_completed`/`reset_conflict` and Umami event `investments_import_reset`, counts only; no new metric or dependency. Check zero transactions after the reset and a single insert per row on the first reimport. The management screen is outside the landing tour; catalog updated, no change to the published screens.

## Multiple statement selection

The picker and drag-and-drop accept up to 20 files, 5 MB each and 25 MB in total. All files must be complete IBKR or DEGIRO statements; other CSVs remain supported one at a time. Before the queue starts, all files are read and checked, reporting the name of the invalid one.

The queue sorts IBKR statements by account and period, then DEGIRO (to allow using the IBKR portfolio just created). Each statement keeps instrument matching, preview and confirmation; «File successivo» ("Next file") continues without having to select the files again. Duplicates already present can be skipped. Each import is atomic on its own: interrupting the dialog keeps the files already completed, and a new selection of the same files is idempotent. It is neither a background job nor a single transaction over the whole selection.

## Selecting brokers

In the Investimenti ("Investments") tabs, the «Broker inclusi nel portafoglio» ("Brokers included in the portfolio") controls let you view IBKR, DEGIRO or both, without changing the saved data. The selection applies to totals, positions, performance (including the heatmap), diversification, income, tax estimates and transactions. Full statements, import management and the securities catalog remain available. Overall net worth, accounts and the sidebar still refer to all assets. The filter is temporary, persists when switching tabs and resets on reload or when leaving the section.

Verification: two brokers in the same portfolio/instrument, exclusion and re-enabling, no broker selected, persistence across tabs, no mutation of the original data. Event `investment_broker_filter_changed`, actions/counts only. No new dependency or server metric. Landing catalog synced; the tour's demo data has no broker sources, so the published screens remain unchanged.

### Cash in the Investimenti view

The Portfolio card offers «Includi liquidità» ("Include cash"), initially on: on shows securities + balance of the linked broker accounts, off shows securities only. The card shows only the securities/cash summary, without detail of the broker accounts or statement dates. The broker filters act on both; negative balances reduce the total. Each account is counted only once, even with multiple statements or earlier links. Overall net worth already includes these accounts in cash and is not changed. Charts, returns and position weights continue to refer to securities only.
