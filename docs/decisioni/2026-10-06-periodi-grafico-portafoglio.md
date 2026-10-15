# Portfolio chart periods

- Added YTD (1 January–today) and an inclusive custom range, with Applica (Apply) confirmation and date validation.
- The reconstruction keeps all earlier operations: only the chart period changes, not the current balance, the composition or the tax estimates.
- YTD and custom ranges keep daily points, including the endpoints and single-day ranges; reinvested costs and taxes stay aligned to the date.
- Current scope: chart of the Portfolio tab. The other selectors keep the existing periods.
- Umami event `investment_chart_period_changed` with only the period category, without dates or amounts. No new API or external dependency.
- Catalog and landing screenshots updated; tests of calendar limits and of retention of earlier positions, desktop/mobile browser check with synthetic data.
- Info icons next to Reinvesti costi and Reinvesti imposte: popover accessible by keyboard and touch, separate from the toggle; it explains reinvestment at the portfolio's return and distinguishes estimated taxes.
