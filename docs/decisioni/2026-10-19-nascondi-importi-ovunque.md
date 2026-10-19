# Hide amounts everywhere (2026-10-19)

Daniele noticed that «Nascondi gli importi» left some figures in plain view («Hai 23.855 € su 4 conti» in Liquidità). An audit of every screen with the demo account (desktop and phone) found the leaks: currencies formatted by hand with `Intl.NumberFormat` (Liquidità, `StatCard`, the German planning fields), the rolling `AnimatedNumber`, quantities, prices and fees of investment operations and positions, amounts in the import previews, and hand-drawn SVG charts that were not blurred.

Decision: every figure about the user's money goes through `lib/format` (`formatCurrency`, `privateNumberFormat` for numbers without a currency, `AnimatedNumber` masks currencies), hand-drawn charts carry `data-amount-chart`, and an ESLint rule in `app/` and `components/` rejects currency `Intl.NumberFormat` and `toLocaleString`. Percentages, counts, dates and public company data stay visible. Details in `docs/architecture/overview.md` §4.13.
