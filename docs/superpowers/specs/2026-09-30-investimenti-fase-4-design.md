# Investimenti, Phase 4: Italian taxation and the Proventi section

**Date**: 2026-09-30
**Status**: implemented on 2026-09-30 in the same session as the design, branch `claude/fase-4-investimenti-dividenti-c1m3cg`. Not yet merged.
**Parent spec**: `2026-09-27-investimenti-design.md`, section 1 (roadmap): "Plusvalenze/minusvalenze (capital gains/losses), zainetto delle minusvalenze (tax-loss carryforward) expiring after 4 years, distinction between redditi diversi / redditi di capitale (miscellaneous income / capital income: gains on harmonized ETFs don't offset losses), tax estimate before a sale, bollo (stamp duty) 0.2%".

User's request: "Procediamo con la fase 4 degli investimenti. Inoltre sto notando che non abbiamo una parte dedicata a dividendi e simili" ("Let's proceed with phase 4 of investments. Also I'm noticing we don't have a part dedicated to dividends and the like") (today there's only Phase 2's "Dividendi e cedole" ("Dividends and coupons") card, at the bottom of a page with 11 cards).

**Product disclaimer**: these are estimates to understand the numbers, not a certified tax calculation. The UI says so in the Tasse (Taxes) tab.

## User choices (2026-09-30)

| Question | Choice |
|---|---|
| Where to put income and taxes | **Tabs in Investimenti (Investments)**; then, at the user's request halfway through the work ("teniamo la sezione investimenti più pulita e semplice possibile" — "let's keep the investments section as clean and simple as possible"), the rest of the page split into thematic tabs too |
| What goes into the income part | **Everything**: 12-month forecast, unrecorded dividends, month-by-month receipts gross/net with yield and dividend growth |
| Tax regime | **Chosen per portfolio** (amministrato / dichiarativo — administered, where the broker withholds the tax / declarative, where the taxpayer reports it in the tax return), default amministrato |

## 1. Tab structure

The Investimenti page had 11 cards one below the other. Now six tabs with their own URLs, the first with only the essentials:

| Tab | Route | Content |
|---|---|---|
| Portafoglio (Portfolio) | `/investimenti` | value and gain (main card with the chart), positions, PAC (piano di accumulo, recurring investment plan) |
| Performance | `/investimenti/performance` | period selector, "Quanto sta rendendo" ("How much it's returning", with comparison), "Quanto rischia" ("How much risk"), "Rendimento nel tempo" ("Return over time") heatmap |
| Diversificazione (Diversification) | `/investimenti/diversificazione` | composition by type and currency, sectors and regions, overlaps, target allocation |
| Proventi (Income) | `/investimenti/proventi` | dividends and coupons (section 4) |
| Tasse (Taxes) | `/investimenti/tasse` | taxation (section 3) |
| Operazioni (Transactions) | `/investimenti/operazioni` | list of transactions by month |

- `app/(app)/investimenti/layout.tsx` (client): title, Importa/Registra (Import/Record) buttons, tab bar (`InvestmentsTabs`: real links, `aria-current`, scrollable on mobile with the active tab brought into view, with a small 14px lucide icon per tab: Wallet, TrendingUp, ChartPie, HandCoins, Landmark, ArrowLeftRight; primary color on the active tab, dimmed on the others), shared "Registra operazione" ("Record transaction") and import dialogs. Pages open the prefilled dialog with `useInvestmentsActions()` / `useRegisterFromPlan()` (`components/domain/investments/investments-actions.tsx`).
- All tabs use the same overview query (`useInvestmentsView`, `lib/queries/investments-view.ts`) at the default period (`3mesi`): switching tab reloads nothing. Performance has its own period selector; the heatmap and Tasse use `max` (Tasse needs the year-end value for the bollo).
- Common states (loading, error, empty portfolio) in `InvestmentsViewGate`.
- The "Dividendi e cedole" card moves from Portafoglio to Proventi.

## 2. New data (migration `0005_investimenti_fase_4`)

| Table / column | What |
|---|---|
| `investment_portfolios.tax_regime` | `amministrato` (default) / `dichiarativo` |
| `user_instrument_settings` (user, instrument) | `tax_rate` (0.26 / 0.125, null = automatic), `tax_harmonized` (null = automatic), for bonds `coupon_rate` (gross annual rate), `coupon_frequency` (1/2/4), `maturity_date`. Per user because instruments are shared: data entered by one doesn't change another's figures |
| `investment_tax_carryforwards` | prior losses entered by hand (year of origin, amount, note): Fineco's zainetto from before the user started using the app |
| `instrument_dividends` (instrument, ex-dividend date) | dividend per unit in the instrument's currency, from the source; shared by all |
| `instruments.dividends_fetched_at` | last download of the dividend history |
| `user_dismissed_dividends` (user, instrument, date) | ignored "to record" suggestions |

**Automatic rate**: the user's correction, otherwise 12.5% for bonds whose name indicates a government bond (BTP, BOT, CCT, CTZ, Bund, OAT, Bonos, Treasury…), otherwise the rate saved on the instrument (26% by default: the creation UI never asked for it). **Automatic harmonized**: the correction, otherwise the instrument's value, otherwise yes (an ETF listed in Europe is almost always UCITS).

## 3. Tax engine (`lib/calc/taxes.ts`, pure functions)

Each sale or redemption produces a plusvalenza/minusvalenza (capital gain/loss) with the **weighted average cost** (purchase commissions included, sale commissions deducted, withheld taxes excluded), converted to the user's currency with the transactions' exchange rates (the currency component is part of the capital gain, as for the tax authorities).

**Classification**:

| Instrument | Gain | Loss |
|---|---|---|
| Stocks, bonds, ETCs | reddito diverso (miscellaneous income, can be offset) | loss into the zainetto |
| ETFs, funds | **reddito di capitale** (capital income): taxed in full, doesn't offset the zainetto | loss into the zainetto |
| Crypto | separate category: always in the tax return, offsets only against crypto | crypto zainetto |

**Rates**: 26%, 12.5% for government bonds. To offset across different rates everything is brought to a "26% basis": a gain or loss at 12.5% counts as 48.08% (12.5/26). Crypto: 26% up to 2025, **33% from 2026** (Legge di Bilancio 2025, the 2025 Budget Law); €2,000 allowance on net annual capital gains up to 2024. Non-harmonized ETFs: actually taxed at ordinary IRPEF (personal income tax) in the tax return; here estimated at 26% with a warning.

**Zainetto**: a loss from year Y can be used until 31/12 of Y+4, oldest first.

- **Amministrato** (the broker acts as withholding agent): transactions are processed in date order; a gain uses the zainetto available at that moment and the rest is taxed immediately; a loss goes into the zainetto and offsets only **subsequent** gains. Crypto follows the dichiarativo rules anyway (the broker doesn't handle them).
- **Dichiarativo**: for each year gains and losses are summed (on a 26% basis); if the net is positive the zainetto from previous years is used, if negative it becomes the year's zainetto.

**Prior losses** (entered by hand): they go into the zainetto with their year; in amministrato available from 1 January of that year, in dichiarativo from the following years.

**Per year**: capital gains, capital losses, capital income from ETFs, zainetto used / generated / expired, estimated taxes, withheld taxes recorded on sales, dividends and coupons (gross and recorded withholdings), bollo.

**Bollo**: 0.2% of the portfolio value (crypto included: for them the equivalent tax applies, in the tax return) at 31/12 of each year, pro rata to the days held in the first year; for the current year "se il valore restasse questo" ("if the value stayed like this": 0.2% of today's value, pro rata to the days this year in which something was held).

**Before selling** (simulator): a hypothetical sale today (chosen units, latest price) is added to the computation and the year's taxes and zainetto are compared with and without it: this way it works for both regimes with the same rules.

**Opportunities**: zainetto expiring at year end and unrealized gains that can be offset (stocks, bonds, ETCs, not ETFs); losing positions whose sale would put losses into the zainetto.

## 4. Proventi

### Dividend-per-unit history (source)

Yahoo `chart` with `events=div` (monthly interval, 10 years): ex-dividend dates and amount per unit, already adjusted for splits (so expressed in today's units). Only stocks, ETFs, funds with a Yahoo symbol. The `market-prices` cron updates histories older than 7 days (at most 20 per run); the page downloads in `after()` those never downloaded (at most 5, one attempt per hour per instrument). An error is never propagated. Fake source for development (ENEL semi-annual, AAPL quarterly, a distributing ETF `VHYL.MI` quarterly).

### Computations (`lib/investments/dividends.ts`, pure functions)

- **Dividends to record**: for each ex-date from the first transaction to today, the units held at the close of the previous day (brought to today's units with subsequent splits, like Yahoo's amount). If the user held them and there's no recorded dividend of the same instrument between 5 days before and 60 days after the ex-date (each recorded dividend "covers" only one ex-date), it is suggested: gross = units × dividend per unit, withholding estimated with the instrument's rate. Same for bond coupons with rate and maturity entered. "Registra" ("Record") opens the prefilled form (date = ex-date, to be corrected with the payment date): no automatic writing, because the true net amount is stated by the broker and today a transaction can't be edited from the UI. "Ignora" ("Ignore") hides it forever.
- **12-month forecast**: for bonds with rate and maturity, future coupons (face value × rate / frequency) and redemption at maturity (shown but not counted as income). Period: the 12 calendar months starting from next month. For the others, the ex-dates of the same period one year earlier shifted by one year × today's units. Without source history, the dividends and coupons recorded in that period, rescaled to today's units. Net = gross × (1 − rate): foreign withholdings not considered, this is stated. Grouped by ex-date month.
- **Month-by-month receipts**: gross (gross × exchange rate), recorded withholdings and commissions, net; per year.
- **Per instrument**: net received over 12 months, yield on cost, current yield (expected gross / today's value), annual dividend-per-unit growth (CAGR over complete calendar years, up to 5, with at least 2 years paid).

## 5. Interface

**Proventi**: summary (Phase 2 card), "Prossimi 12 mesi" ("Next 12 months": the 12 calendar months from next month: net total, bars per month, list of upcoming receipts), "Da registrare" ("To record": Registra / Ignora, and "Ignora le N più vecchie di un anno" ("Ignore the N older than a year") for those who imported a history without dividends), "Mese per mese" ("Month by month": selectable year, stacked bars net + withholdings), "Per strumento" ("By instrument") with "Cedole" ("Coupons") to enter rate and maturity of BTPs.

**Tasse**: regime (selector with explanation), "Anno" ("Year": selector, the year's figures and estimate/withheld comparison), "Zaino" (available, expiries by year, prior losses with add/delete), "Prima di vendere" ("Before selling"), "Opportunità" ("Opportunities"), "Impostazioni fiscali degli strumenti" ("Instruments' tax settings": rate and harmonized per instrument, dialog shared with coupons).

## 6. Routes

- `PATCH /api/investments/portfolio`: also `taxRegime`.
- `PUT /api/instruments/[id]/settings`: the user's tax settings and coupons (all null = delete).
- `POST /api/investments/tax-carryforwards`, `DELETE /api/investments/tax-carryforwards/[id]`.
- `POST` / `DELETE /api/investments/dividends/dismissed` (`{ items: [...] }`, one or more suggestions).
- The new data arrives with `GET /api/investments/overview` (`loadInvestmentData`), which also starts downloading missing dividends.
- Umami events: `investment_tax_regime_set`, `instrument_settings_saved`, `tax_carryforward_added`, `investment_dividend_dismissed`. Account export and reset include the new per-user tables.

## Knowingly deferred

- Foreign withholding on dividends (tax credit, 15% USA etc.): the net forecast uses only the Italian rate.
- Completed tax return sections (RT/RM/RW): only the per-year figures are given.
- Dividend payment dates (Yahoo only gives the ex-date).
- "Mixed" rate of bond ETFs with government bonds (a rate between the two available is set by hand).
- Automatic recording of dividends without confirmation.
