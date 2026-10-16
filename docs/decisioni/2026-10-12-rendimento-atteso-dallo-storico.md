# Analitiche (Analytics): expected return from history, slider up to 50%

Date: 2026-10-12

- Analitiche's real return starts, by default, from what the portfolio actually did: last 24 months if the history covers them (15 days of tolerance), otherwise 12, otherwise the previous prudent 4%. It is time-weighted and annualized (contributions and withdrawals do not count as gain, same calculation as the Investimenti page), then net of the inflation observed in the period or, if the index does not cover it, that of the assumptions.
- No number below €1,000 invested, with less than 12 months of history or with securities without a price (they would look like losses): the prudent value remains and the row below the slider says why.
- New `expectedReturnAuto` field in the assumptions (JSON, no migration): true by default; whoever had saved a return other than 4% stays on theirs. Saving a return makes it manual; «Usa il tuo rendimento» ("Use your return") goes back to automatic.
- Slider and limits from −2% to 50%; above 8% real a warning appears (world stock markets returned on average around 5% real over the long run), without blocking.
- Observability: log `analytics.return_source.changed`, Umami events `analytics_return_source_shown` and `analytics_return_source_changed`.
- Postponed: using money-weighted instead of time-weighted. The window can be chosen since 2026-10-12 (`2026-10-12-analitiche-periodo-dei-dati.md`).
