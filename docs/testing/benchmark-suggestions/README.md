# Browser check — predefined benchmarks

Check of October 8, 2026 in Chrome on the local Next.js app, with the isolated database `buddy_benchmark_demo`, user Giulia Demo and a fictitious portfolio. The benchmark prices were downloaded from the real sources, without `MARKET_DATA_FAKE`.

## Results

- The four quick choices show index, description, ETF and ticker. The current selection is marked «Attuale» ("Current").
- S&P 500, MSCI World, FTSE All-World and Nasdaq-100 were selected and saved; the numeric comparison appears with the downloaded prices.
- During creation and saving, buttons and search are disabled and the loading state appears.
- Nasdaq-100, never created before in the database, went from selection to full comparison without a reload after the fixes.
- After a reload Nasdaq-100 stays selected; «Togli il confronto» ("Remove the comparison") restores «Scegli un confronto» ("Choose a comparison").
- The free search for `CSPX` returns market results.
- No errors or warnings in the browser console during the final check.
- Confirmed on the server: instruments POST 201 for creation / 200 for reuse and portfolio PATCH 200; the saved historical prices were verified in the database.

## Problems found and fixed

1. The initial 30-day download could hold the lock when saving the benchmark requested the full history. The benchmark window now creates/reuses the instrument with `history=deferred`; saving the portfolio starts the fetch from the first transaction. This also applies to free search in the same window. Ordinary creation keeps the initial download.
2. If the fetch finished before the first poll, the client did not observe `running` and did not reload the prices, showing a false error even though the history was already in the database. The client now reloads the overview also when it first sees a new completed state.

## Automated checks

- TypeScript and lint: passed.
- 63 tests: instruments API (including a regression on the deferred download), returns and insights.
- Landing catalog synced; `git diff --check` passed.

## Screens

- [Suggestions and current selection](01-suggestions.jpg)
- [S&P 500 comparison](02-comparison.jpg)
- [First Nasdaq-100 selection, automatic update](03-nasdaq-first-selection.jpg)
- [Comparison removed](04-removed.jpg)
- [MSCI World comparison](05-msci-comparison.jpg)
