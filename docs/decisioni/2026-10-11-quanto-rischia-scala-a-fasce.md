# 2026-10-11 — «Quanto rischia» ("How much it risks"): coloured band scale

The risk level (Basso / Medio / Alto / Molto alto — Low / Medium / High / Very high, thresholds 8/15/25% annual volatility) was four grey notches: the word was clear, the rest was not. Now it is a four-band scale from green to red (tokens `--risk-1..4`, light and dark) with a marker that falls inside the band in proportion to volatility (`riskScalePosition`), the word in the level's colour and the name of each band below the scale (colour is never the only signal).
The «Quanto oscilla» ("How much it swings") indicator is no longer a separate row (it repeated the number at the top): its sentence and the «i» popover sit below the scale. Worst loss and Sharpe (and beta with an index) remain in two columns, a single note at the bottom and a single collapsible «Dettagli» ("Details": drawdown chart + how it is calculated).
Rejected (screenshots in the thread): example in euro («10.000 € → tra 9.628 € e 10.372 €») and semicircle gauge. Possible follow-up: the euro example as a row below the scale.
No migration, no new event: the card introduces no user actions.
