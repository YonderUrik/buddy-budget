# 2026-10-11 — Security page rethought and computed fundamental indicators

- Daniele chose the **single page** (versus sub-tabs) and, for now, **Yahoo only** as the source (free, unofficial; proposal and mockups in `scheda-titolo/` in the project files).
- Financial statements come from Yahoo's `fundamentals-timeseries` endpoint (annual fiscal years + trailing 12 months), cached on Redis for 24 h like the key figures (`lib/market-data/statements.ts`, `loadStatements`). No migration.
- Multiples (P/E, P/S, P/B, P/FCF, EV/EBITDA) are **computed by the app** with the last saved close and the statements (`lib/investments/title-fundamentals.ts`), with the range of the security's own past fiscal years; each number has a «?» with the calculation. Never «expensive/cheap» judgements, never target prices or analyst recommendations.
- If the reporting currency differs from the listing currency, price-based multiples are not computed (no FX conversion halfway through the calculation).
- ETFs: top holdings, sectors, average multiples of the basket (Yahoo gives them inverted, they are corrected), year-by-year returns, cost of the TER; for stocks, the funds held that contain them.
- Postponed: SEC EDGAR for US stocks (official source), paid sources (FMP, EODHD: display licence to be clarified), quarterlies, geographic areas of ETFs (issuer files), weight of the security in the portfolio (needs the FX rate), alert on the `buddybudget_fundamentals_requests_total` metric (today only a panel).
