# 2026-10-09 — Login in the Panoramica style («Orizzonte», "Horizon")

- **Decision**: the sign-in page (and the pages sharing the `(auth)` layout: accept terms, onboarding, deactivated account) drops the split panel with the tile mosaic. Among three mockups direction A «Orizzonte» was chosen: the sample net worth is a large number with dimmed decimals and a full-width chart at the bottom of the page; the form sits on the left; the app's six areas are a row of tinted icons below the chart.
- **A single line**: the chart shows only net worth, with a direct label on the last point (no legend). The two lines of the mockups, unexplained, were removed. The number and the last point follow the sample transactions (`useMosaicLive`); with `prefers-reduced-motion` it stays still.
- **Removed**: the `mosaic-*` tiles (replaced by `LoginHorizon`, `LoginAreas`). The sample data model (`login-mosaic.model.ts`) remains.
- **Unchanged**: form copy, sign-in with email link and Google, logo → landing, «Nuovo» ("New") and «In arrivo» ("Coming soon").
- **Postponed**: no login screen in the landing, hence no impact on catalog and screenshots.
