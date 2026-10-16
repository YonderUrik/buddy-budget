# Trade Republic import

In Investimenti ("Investments") → Importa ("Import"), choose Trade Republic and upload `Transaction export.csv`. The format is recognized from the headers even without selecting the provider. It also works with multiple selection and with files containing only account movements.

Upload the full history of the main account (`account_type=DEFAULT`). The format does not provide an account number: one Trade Republic source per user. Subsequent exports must cover all periods already uploaded. An identical file does not create duplicates.

- BUY/SELL of STOCK, FUND and CRYPTO become investment transactions, with fractional quantities, execution price, commissions and taxes. Instruments are matched by ISIN or crypto symbol and currency.
- All CASH rows become movements of the dedicated account, including domestic/international card payments, refunds, bank transfers, interest, bonuses, gifts and tax adjustments. They start out as uncategorized. Net amount = `amount + fee + tax`, with the signs from the export. The original currency of a foreign payment is not counted a second time.
- `DELIVERY` / `FREE_RECEIPT` rows (crypto received for free: weekly staking or incoming transfers) become purchases at the market price of the day stated in the file, without cash movements; the preview shows a warning with the count. Only for `CRYPTO`, with positive quantity and price.
- `date` is the booking date: it can precede `datetime` even by months (taxes on staking charged late), but never follow it by more than one day.
- The balance derives from all cash components, including buys and sells; the latter are not duplicated among expenses. The CSV contains neither an official balance nor a valuation of the positions: the opening balance is assumed to be zero, no certified reconciliation.
- The booking date `date` is kept even when the UTC `datetime` falls on the adjacent day. The original rows, including references, exchange rate and counterparty, remain in the saved statement.
- The update happens in a single transaction. Movements are identified by `transaction_id`; notes and categorizations survive the update. Deleting the import and restoring the history also delete the imported cash movements.

Structural errors, duplicate IDs, future dates, unknown classes or TRADING operations block the entire file. No silent discarding. Limits: 5 MB, 5000 rows, 50 instruments. Different formats or further corporate events will need a new sample export.

Verification performed on the local file provided: 885 rows = 17 investment transactions + 868 cash movements, 6 instruments, no errors in the quantity check. The personal CSV is not copied into the repository. The versioned tests use only synthetic data and also cover reimport, update and deletion on local Postgres.
