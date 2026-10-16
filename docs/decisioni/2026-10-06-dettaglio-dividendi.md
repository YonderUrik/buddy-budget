# Dividends: summary and detail of payments received

- The Proventi (Income) tab becomes Dividendi (Dividends); the existing address remains valid so as not to break links.
- The portfolio shows net income for the last 12 months and totals, with a link to the tab. Coupons remain included and identified.
- Payments recorded with date, gross converted at the operation's FX rate, taxes, costs and net shared by summary and details.
- Expandable years and instruments; instruments already sold also keep their history, with no limit to the last five years.
- Monthly bars with details on mouse hover and on focus/touch. Forecasts remain separate from recorded payments.
- Umami event `investment_dividends_details_opened` with only a categorical origin; no new API or external dependency.
- Catalog and landing screens updated; checks on currencies, adjustments, future payments and sold instruments.

- Requested simplification: removed from the tab the summary card «Dividendi e cedole» ("Dividends and coupons") with yearly comparison and ranking. Monthly chart at the top, yearly payments below the chart, compact and expandable instrument rows. Proposals to record and forecasts gathered in sections collapsed by default.
- This simplification only concerns the Dividendi tab, which is not among the landing screenshots; portfolio summary and feature catalog unchanged.
