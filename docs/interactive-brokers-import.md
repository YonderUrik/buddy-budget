# Interactive Brokers Activity Statement backend

`POST /api/investments/import/parse` accepts an authenticated request with the
UTF-8 CSV as the raw body (`Content-Type: text/csv` or `text/plain`). The actual
stream is limited to 5 MiB, even without a Content-Length header. Parsing is
read-only and responses have `Cache-Control: no-store`.

This PR provides the backend contract; connecting the upload UI is a separate PR.

## Response

- `preset`: `interactive-brokers`.
- `records`: every nonblank logical CSV record in source order, including
  statement/account metadata, headers, totals, balances, positions, instrument
  details, cash movements, corporate actions, interest, securities lending,
  legal notes and unknown future sections. Each record contains its physical
  starting `line`, `section`, `kind`, the applicable `headers`, and original
  `values` (CSV quoting decoded; whitespace and empty cells preserved).
  Arrays preserve duplicate and empty header names. Repeated headers apply only
  to following records in that section. Header records are also retained.
- `identities`: unique instruments for normalized operations. Keys include the
  currency to distinguish listings. Broker symbols are not treated as Yahoo
  symbols. ISINs and names come from Financial Instrument Information when
  available, even if it appears after the trades.
- `operations`: stock/ETF orders and positive dividends, ready for the existing
  import request once instruments have been resolved. Quantity signs distinguish
  buys/sells; quantities and commissions become positive. Dates omit the broker's
  time without a timezone conversion. Totals and subtotals never become trades.
- `issues`: line/section, severity (`error` or `warning`), and an explanation.
  Invalid operations are excluded from `operations` but retained in `records`.

All statement data is available to callers through `records`, including sections
that are not modeled as Buddy Budget investment transactions. Private account
statements are not bundled in the repository. Tests include a compact synthetic
fixture and a full anonymized annual export; see the fixture directory README.

## Integration with the existing import APIs

1. Parse the CSV and show/resolve issues. A successful HTTP response means the
   document was parsed, not that every financial event is ready to import. Do not
   silently discard errors or warnings when adding the UI.
2. Send `identities` to `/api/investments/import/resolve`, and have the user review
   the selected instruments (especially broker tickers and currency listings).
3. Send `operations`, `preset` and the resolved `instruments` to
   `/api/investments/import` with `dryRun: true`. Then submit with `dryRun: false`
   after reviewing the preview. Existing duplicate and oversell checks apply.

The new optional `sourceCurrency` on import operations declares that **all**
amounts, including fees and taxes, are in that currency. It must match the
resolved instrument's currency. The import executor converts fees/taxes into the
user's currency using the operation date's FX rate; prices and gross income stay
in instrument currency. Missing FX prevents saving. Omitting this field retains
the existing behavior (costs already in user currency).

For proposed Yahoo instruments the currency is verified once the provider has
resolved the instrument at execution; the dry run can still check source FX.
Importing a later annual statement alone may fail the existing oversell check:
previous purchases/opening holdings must already exist in Buddy Budget.

## Explicit limitations

The parser recognizes English Activity Statement exports, not Flex Queries,
localized statements, PDFs or other brokers' CSVs. Malformed quoting, unexpected
formats, file size and import count limits produce HTTP 400/413; unsupported
content types produce 415, and unauthenticated requests produce 401.

Withholding is matched to a single dividend by broker symbol, currency and date.
Signed tax rows are summed so reversals are not double charged. Ambiguous matches,
invalid values, negative dividends and net tax refunds require manual review;
unmatched withholding is retained with a warning.

Only `Order` records in the `Stocks` category are normalized. Forex, derivatives,
execution detail records and other asset types are retained with warnings.
Corporate actions (including spinoffs/ISIN changes), transfers, cash deposits and
withdrawals, interest, account fees and separate transaction-fee sections are
retained with review warnings, not automatically posted. Separate transaction fees
are not added to trade commissions because their allocation/overlap needs review.
The output therefore represents supported investment operations, not a complete
accounting reconciliation of the statement.
