# Default benchmarks

- The comparison window offers S&P 500, MSCI World, FTSE All-World and Nasdaq-100, with a description and an explicit accumulating ETF.
- The selection creates or reuses the instrument through the existing flow and saves the benchmark; free search and removal remain available.
- No automatic choice: suggestions do not change the portfolio until the user selects them. Currencies continue to be handled by the sources and the existing calculation.
- Landing catalog synced; the screenshots of the page with the window closed do not change. No change to calculations or the data schema.
- Instrument references: [S&P 500](https://www.ishares.com/uk/professionals/en/products/253743/ishares-sp-500-b-ucits-etf-acc-fund), [MSCI World](https://www.ishares.com/nl/particuliere-belegger/nl/producten/251882/ishares-msci-world-ucits-etf-acc-fund), [FTSE All-World](https://www.vanguard.co.uk/professional/product/etf/equity/9679/ftse-all-world-ucits-etf-usd-accumulating), [Nasdaq-100](https://www.ishares.com/de/professionelle-anleger/de/produkte/253741/ishares-nasdaq-100-ucits-etf).
- The browser check found and fixed two race conditions: initial 30-day download overlapping the full history, and fetches too fast to be observed in the `running` state. The benchmark defers the download to the portfolio PATCH; the client refreshes prices even on the first observation of a completed state.
- Verified the four comparisons with real sources on demo data, persistence, search and removal; evidence in `docs/testing/benchmark-suggestions/`.
