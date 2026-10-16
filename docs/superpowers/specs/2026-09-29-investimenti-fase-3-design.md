# Investimenti, Phase 3: risk and diversification

**Date**: 2026-09-29
**Status**: implemented on 2026-09-29 in the same session as the design, at the user's request ("andiamo alla fase 3 della sezione investimenti" — "let's go to phase 3 of the investments section"), branch `claude/serene-goldberg-r8qw3k`. Not yet merged.
**Parent spec**: `2026-09-27-investimenti-design.md`, section 1 (roadmap): "Volatility, maximum drawdown from peak, Sharpe, beta, correlations; sector and geography (ETF look-through where free data allows); overlap between ETFs; target allocation and 'where to put the next PAC'".

## User choices (2026-09-29)

| Question | Choice |
|---|---|
| Whole phase or in pieces | **All together**, like Phase 2 |
| Where to get ETF sector and region | **Yahoo + manual correction** per instrument |
| What the target allocation is defined on | **Per instrument** (e.g. VWCE 70%, BTP 20%, BTC 10%) |
| Risk-free rate for Sharpe | **€STR from the ECB**, updated by the cron |

## 1. Risk ("Quanto rischia" — "How much risk" card)

Over the same period as the main card (1M/3M/1A/Max), like Phase 2's returns. Pure logic in `lib/calc/risk.ts`.

**Daily returns used**: those of Phase 2's TWR (`computeDailyReturns`), without the days with nothing invested and without **Saturdays and Sundays when the return is exactly zero** (markets closed: counting them would lower volatility). With crypto the weekend moves and stays. Years are counted from the data: observations per year = `n × 365 / calendar days covered` (about 252 with ETFs, 365 with crypto only), so there's no need to know which exchanges are involved.

- **Annual volatility**: sample standard deviation of daily returns × √(observations per year). Sentence: "In un anno normale può muoversi di circa ±X% (due anni su tre)" ("In a normal year it can move by about ±X% (two years out of three)"). Next to it, the benchmark's if chosen ("più/meno movimentato di …" — "more/less volatile than …").
- **Maximum drawdown from peak**: on the TWR index (not on the value, which would rise with contributions). Peak, trough, recovery (first day back at the peak) or "non ancora recuperata" ("not yet recovered"), and current drawdown from the peak. "Underwater" chart (area of the drawdown over time); on 1A/Max one point per month with the month's minimum, so as not to hide the bottom.
- **Sharpe**: `(daily mean − average €STR / observations per year) / standard deviation × √(observations per year)`. Average €STR over the observed days (latest available value at each date). EUR currency only: for other currencies zero is used and stated. If the €STR table is empty (e.g. before the first cron run) zero is used and stated. Reading: < 0 "hai reso meno di un conto deposito" ("you earned less than a deposit account"), < 0.5 "poco premiato per il rischio" ("poorly rewarded for the risk"), < 1 "discreto" ("fair"), ≥ 1 "buono" ("good").
- **Beta and correlation with the benchmark** (only with a benchmark chosen in the returns card): daily returns of the index in user currency on the same days. Beta = cov / var of the index. Sentence: "Quando l'indice si muove dell'1%, il portafoglio tende a muoversi dello X%" ("When the index moves 1%, the portfolio tends to move X%").
- **Minimums**: volatility and drawdown from 20 observations; Sharpe, beta and correlations from 60. Below 250 observations (about one trading year) the card warns "meno di un anno di dati: numeri indicativi" ("less than a year of data: indicative numbers").

**Known limit**: closing prices of exchanges with different hours (US after Europe) lower daily correlations somewhat. Accepted.

## 2. Diversification: sector and geographic region (look-through)

### Data

For each instrument, for each dimension (sector, region), **one** source is chosen in this order:

1. **User's manual entry** (per user, per instrument, per dimension): always wins. The unassigned part ends up in "Non classificato" ("Unclassified").
2. **From the type**: crypto → sector "Crypto", region "Senza area" ("No region"); ETC → sector "Materie prime" ("Commodities"), region "Senza area"; bond → sector "Obbligazioni" ("Bonds"), region from the ISIN country.
3. **Yahoo** (`quoteSummary`, modules `topHoldings` and `assetProfile`): for ETFs and funds the weights per sector (`sectorWeightings`, equity part only) scaled to the equity share (`stockPosition`), the rest in "Obbligazioni" / "Liquidità" / "Altro" (Bonds / Cash / Other); for stocks the company's sector and country. Yahoo **doesn't give the regional breakdown of ETFs**.
4. **Estimate from the index** (added to what the user chose, because Yahoo doesn't have ETF regions): a table of a few very widespread indices (FTSE All-World / MSCI ACWI, MSCI World, S&P 500 / MSCI USA, Nasdaq-100, MSCI Emerging Markets, Europe, Japan, FTSE MIB) recognized from the instrument's name, with regions and sectors approximated to 2025-2026. Sector/thematic ETFs (name with "Information Technology", "Health Care", "Clean Energy"…) are not recognized; "factor" ones (small cap, value, momentum, dividends…) only get the regions. It always says "stima dall'indice" ("estimate from the index").
5. Stocks without Yahoo data: region from the ISIN country (for ETFs the ISIN only says where the fund is domiciled, IE/LU, so it isn't used).
6. Otherwise "Non classificato".

**Closed keys** (to sum different sources): sectors `tecnologia, finanza, salute, industria, consumi_ciclici, consumi_difensivi, comunicazioni, energia, materiali, servizi_pubblici, immobiliare` + `obbligazioni, liquidita, materie_prime, crypto, altro, non_classificato`. Regions `nord_america, europa, italia, giappone, pacifico, emergenti, nessuna, non_classificato`. Italy is separate from Europe (BTPs and Italian stocks are typical of an Italian portfolio); in index estimates Italy stays inside "Europa" (it weighs less than 1% in global indices).

**Tables** (migration `0004_investimenti_fase_3`):
- `instrument_profiles` (one row per instrument, shared by all users): Yahoo symbol used, `fetched_at`, `sectors`/`asset_mix`/`holdings` (jsonb), the company's `sector`/`country`. An empty response still saves the row (so it isn't requested every day).
- `user_instrument_breakdowns` (user, instrument): `sectors` and `areas` jsonb, null = use the automatic one.

**Update**: the `market-prices` cron updates the profiles of held instruments of type ETF/fund/stock/ETC that are older than 30 days or never downloaded, at most 20 per run (so as not to use up Yahoo). When the page loads the data and a held instrument has no profile yet, it downloads it immediately in `after()` (at most 5 at a time, one attempt per instrument per hour with a Redis key). Errors only logged (`market.profiles.failed`), never propagated.

### Interface

"Diversificazione" ("Diversification") card: two bars (Per settore, Per area — By sector, By region) with the same graphics as the composition, one sentence for each (prevailing sector; share outside the main region, share in Italy), the **coverage** ("il 12% del valore non è classificato" — "12% of the value is unclassified") and the list of instruments with the source used ("Yahoo", "Stima dall'indice", "Manuale", "Nessun dato" — "Yahoo", "Estimate from the index", "Manual", "No data") and the "Correggi" ("Correct") button that opens a dialog with percentages per region and per sector (sum ≤ 100%, the rest is "Non classificato"; "Torna all'automatico" ("Back to automatic") deletes the correction).

## 3. Overlaps and correlations

"Sovrapposizioni" ("Overlaps") card, pure logic in `lib/investments/overlap.ts` and `lib/calc/risk.ts`.

- **Overlapping ETFs** (pairs of held ETFs/funds):
  - same estimated index → "replicano lo stesso indice" ("they track the same index", 100% overlap);
  - two different "broad" indices from the table (e.g. MSCI World and FTSE All-World) → `Σ min(weight region A, weight region B)` (World/All-World ≈ 88%): assumes that within a region two broad indices hold the same companies, true to a first approximation for cap-weighted indices. Nasdaq-100 is not "broad";
  - otherwise, with Yahoo's **top 10 holdings** of both → `Σ min(weight)` over the holdings in common, presented as "almeno X% in comune tra i primi 10 titoli" ("at least X% in common among the top 10 holdings").
  - Pairs above 20% are shown.
- **Stocks you also hold inside an ETF**: if a held stock appears among the top 10 holdings of a held ETF, "Apple pesa il 4,6% in VWCE: in tutto ci hai X €" ("Apple weighs 4.6% in VWCE: in total you have X € in it") (direct value + ETF value × weight).
- **Correlations**: matrix among the top 8 positions by value, on price returns in user currency computed only on the days when **both** instruments have a close (returns over the same intervals, no "stale" prices); at least 20 days in common, otherwise the cell is empty. Sentence: the most correlated pair (≥ 0.8: "si muovono quasi insieme" — "they move almost together") and the average correlation.

## 4. Target allocation and next contribution

- New table `investment_targets (portfolio_id, instrument_id, weight)`, unique per pair. Target **per instrument**, including instruments not yet held (to plan a new ETF). `PUT /api/investments/targets { targets: [{ instrumentId, weight }] }` replaces everything in one transaction; empty list = no target. Validation: weights between 0 and 1, sum 100% (tolerance 0.01%), instruments visible to the user, at most 30.
- **Comparison**: for each instrument current weight, target, deviation; "in linea" ("on target") within ±5 points (`ALLOCATION_TOLERANCE`). Held instruments outside the target appear with target 0. Instruments without a price are excluded from the calculation and flagged.
- **Next contribution** (editable amount, by default the monthly total of active PACs — piani di accumulo, recurring investment plans — or 100): purchases only, no sales. The instrument furthest below target is "filled" first in proportion to its weight, until all are brought to the same level (water-filling): find `λ` such that `Σ max(0, w_i·λ − value_i) = amount`. Purchases below 10% of the amount are discarded and redistributed (avoids orders of a few euros with fixed commissions). For each: amount, weight after the purchase, "Registra" ("Record") button that prefills the form with units estimated from the latest price.
- "Obiettivo" ("Target") dialog: starts from the current weights (rounded), rows with percentage, "Aggiungi strumento" ("Add instrument") with the existing selector, sum at the bottom that must be 100%, "Distribuisci il resto" ("Distribute the rest") on the last row.

## 5. Risk-free rate (€STR)

- Source ECB Data API, series `EST/B.EU000A2X2A25.WT` (daily €STR rate, in %), CSV. New table `interest_rates (series, date, rate, source)`, `rate` as a fraction (0.0192 = 1.92%).
- `market-prices` cron: last 30 days, or from the start of the series (October 2019) if the table is empty. An error doesn't make the cron fail (`market.rates.failed`). Fake source at 2% with `MARKET_DATA_FAKE=1`.
- Before October 2019 there is no data: the average is computed on the available days.

## Where the code lives

- `lib/calc/risk.ts`: returns for risk, volatility, drawdown, Sharpe, beta, correlations.
- `lib/investments/exposure-keys.ts` (keys, labels, countries → regions), `index-profiles.ts`, `exposure.ts` (source per instrument and aggregation), `overlap.ts`, `allocation.ts`, `risk-insights.ts`.
- `lib/market-data/providers/yahoo.ts` (`fetchYahooProfile`), `providers/estr.ts`, `profiles.ts`, `rates.ts`.
- API: `PUT /api/investments/targets`, `PUT /api/instruments/[id]/breakdown`; `GET /api/investments/overview` also returns targets, profiles, corrections and €STR.
- UI: `components/domain/investments/risk/`, `diversification/`, `allocation/`.

## Fixed by looking at the live page

- A stock present in several ETFs appeared once per ETF, each with a partial "in tutto" ("in total"): now one row per stock with the overall exposure and the list of ETFs.
- In the correction dialog "Salva" ("Save") stayed disabled if the **untouched** dimension exceeded 100% due to one-decimal rounding of the automatic values: now only the modified dimensions are checked, and a total just above 100 is brought back to 100.
- Volatility written as ±4.6% in the box and "±5%" in the sentence: now one decimal everywhere.

## Knowingly deferred

- Regional breakdown of ETFs from the issuers' official sources (iShares/Vanguard full holdings files: different formats per issuer, fragile).
- Exact overlap on the full holdings (would need the same sources).
- Target per asset class (equity/bond) and rebalancing with sales (also for taxes: Phase 4).
- Risk-free rate for currencies other than EUR.
- Other indicators (Sortino, VaR, tracking error).

## To verify after the merge (not verifiable from the sandbox)

- The migration is applied by the PreSync Job.
- Yahoo's `quoteSummary` responds from the VPS and for which UCITS ETFs it gives sectors (Yahoo is blocked from the sandbox).
- The ECB returns the €STR series (after the first cron run the `interest_rates` table has rows).
