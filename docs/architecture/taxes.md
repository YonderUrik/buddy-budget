# Investment taxes

This part turns the investment transaction log of a user into an estimate of what the tax authority would take: realised gains and losses per year, the zainetto fiscale (loss carryforward), tax on fund gains and crypto, the bollo (stamp duty), the tax effect of a sale before it happens, and the latent tax on the whole portfolio. Italy has a full engine in [`lib/calc/taxes.ts`](../../lib/calc/taxes.ts) and [`lib/calc/liquidation.ts`](../../lib/calc/liquidation.ts), wired to the Tasse (Taxes) tab through [`lib/investments/`](../../lib/investments/). Germany has a separate, partial 2026 engine in [`lib/financial-planning/`](../../lib/financial-planning/).

> This is a living document: it describes the code as it is. Change it in the same PR that changes the behaviour it describes.

> **Status: estimates, not tax advice.** Every figure in this document is an estimate to help the user understand their numbers. None of the rules has been validated by a tax professional. The code says so itself (`computeTaxReport` header: "Stime per capire i numeri, non un calcolo certificato"; the Tasse page: "Stime, non calcolo fiscale"). Do not present these numbers as a tax return, a broker statement or advice.

## 1. Overview

| Stage | Input | Output | Code |
|---|---|---|---|
| Resolve tax settings | `instruments`, `user_instrument_settings` | `TaxInstrument[]` (rate 26% or 12.5%, harmonised flag) | [`lib/investments/tax-settings.ts`](../../lib/investments/tax-settings.ts) `toTaxInstruments`, `resolveTaxSettings` |
| Realised gains | transactions, `TaxInstrument[]`, date | `RealizedGain[]` (weighted average cost) | [`lib/calc/taxes.ts`](../../lib/calc/taxes.ts) `computeRealizedGains` |
| Yearly report | realised gains, regime, manual carryforwards | `TaxReport` (years, zainetto, realised events) | `computeTaxReport` |
| Bollo | daily portfolio values | `BolloYear[]` | `computeBollo` |
| Tasse view | `InvestmentData` | `TaxView` (report, bollo, opportunities, sellable positions) | [`lib/investments/tax-view.ts`](../../lib/investments/tax-view.ts) `buildTaxView` |
| Opportunities | open positions, zainetto | gains the zainetto can offset, latent losses | [`lib/investments/tax-insights.ts`](../../lib/investments/tax-insights.ts) `computeTaxOpportunities` |
| «Prima di vendere» | report inputs + one simulated sale | `SaleSimulation` | `simulateSale`, UI in [`sale-simulator-card.tsx`](../../components/domain/investments/taxes/sale-simulator-card.tsx) |
| Sell everything today | open positions with unrealised gain | `LiquidationResult` (latent tax) | [`lib/calc/liquidation.ts`](../../lib/calc/liquidation.ts) `computeLiquidation`, used by [`lib/analitiche/plan.ts`](../../lib/analitiche/plan.ts) |
| Dated tax charges | `TaxReport` | `{ date, amount }[]` for the cost/tax impact chart | [`lib/investments/tax-report.ts`](../../lib/investments/tax-report.ts) `estimatedTaxCharges` |
| Germany 2026 | `InvestmentData`, `GermanPlan.tax` | FIFO events, capital tax estimate or `null` + issues | [`lib/financial-planning/portfolio.ts`](../../lib/financial-planning/portfolio.ts), [`countries/de.ts`](../../lib/financial-planning/countries/de.ts) |

```text
transactions ──► computeRealizedGains ──► computeTaxReport ──► TaxYear[] + zainetto
     │                                          │
     │                                          ├─► simulateSale (report before vs after one extra sale)
     │                                          └─► estimatedTaxCharges (cost/tax impact)
     └─► computeDailyPortfolioValues ──► computeBollo
open positions ──► computeLiquidation (latent tax) ──► Analitiche FIRE number
```

## 2. Principles

**P1 — Computed, never stored.** No tax figure is persisted. Only inputs are stored: the regime on the portfolio, per-user rate corrections and manual carryforwards. Every report is recomputed from the full transaction log.

**P2 — Pure engines.** `lib/calc/taxes.ts` and `lib/calc/liquidation.ts` have no DB or UI dependencies. `simulateSale` reuses `computeTaxReport` twice, so the simulator and the yearly report always follow the same rules.

**P3 — One shared Italian report.** `investmentTaxReport` in [`lib/investments/tax-report.ts`](../../lib/investments/tax-report.ts) is the single entry point used by the Tasse tab and by the portfolio cost/tax impact. It throws for `productCountry === "DE"`.

**P4 — Everything netted at a "base 26%".** Gains and losses taxed at different rates are converted to a 26% equivalent before they meet in the zainetto (`toBaseEquivalent`).

**P5 — Country isolation, fail closed.** Italian rules never run for a German user and German rules never fall back to Italy (`planningModel("IT")` is `null`; `germanRules(year)` throws for any year other than 2026). A German estimate with missing data returns `null` with a list of issues, never a number computed on an assumed zero cost.

**P6 — Settings of shared instruments are per user.** Instruments are shared between users. A rate saved on the shared instrument row is ignored unless the instrument is private (`createdByUserId != null`); user corrections live in `user_instrument_settings`.

## 3. Data model

| Table / column | What is stored | Code |
|---|---|---|
| `investment_portfolios.tax_regime` | `amministrato` (default) or `dichiarativo` | [`lib/db/schema/investments.ts`](../../lib/db/schema/investments.ts) |
| `instruments.tax_rate`, `instruments.tax_harmonized` | Rate and harmonised flag of a private (manual) instrument | same |
| `user_instrument_settings.tax_rate`, `.tax_harmonized` | Per-user correction, `null` = automatic. Rate is validated to `"0.26"` or `"0.125"` (`TAX_RATES` in [`lib/validation/investments.ts`](../../lib/validation/investments.ts)) | same |
| `investment_transactions.taxes` | Tax withheld by the broker on that operation (shown, not trusted as the liability) | same |
| `investment_tax_carryforwards` | Manual pre-app losses: `year`, `amount` (user currency, treated as a 26% base amount), `note` (encrypted). Year ≥ 2000, amount > 0 | same, [`createTaxCarryforwardSchema`](../../lib/validation/investments.ts) |
| `financial_plans` (`user_id`, `country`, `data` jsonb, `revision`) | German plan document, including `tax` (`taxProfileSchema`) | [`lib/db/schema/financial-plans.ts`](../../lib/db/schema/financial-plans.ts), [`lib/financial-planning/schema.ts`](../../lib/financial-planning/schema.ts) |

Always computed: realised gains, yearly tax, zainetto balances and expiry, bollo, latent tax, German FIFO lots and estimates.

## 4. How it works

Sections 4.1 to 4.11 describe the Italian engine; 4.12 describes the German one.

### 4.1 Instrument rate and category

`resolveTaxSettings` picks the rate in this order:

| Order | Source (`taxRateSource`) | Rate |
|---|---|---|
| 1 | `manuale`: user correction in `user_instrument_settings` | 26% or 12.5% |
| 2 | `titolo_di_stato`: an `obbligazione` whose name matches `GOVERNMENT_BOND_PATTERN` (BTP, BOT, CCT, CTZ, BUND, OAT, TREASURY, GILT...) | 12.5% |
| 3 | `strumento`: the instrument row (only for private instruments), else default | 26% |

ETFs and funds are assumed harmonised (UCITS) unless corrected. Non-ETF types are always `harmonized: true`.

The tax category of a realised result comes from `taxCategoryOf(type, gain)`:

| Instrument type | Gain > 0 | Gain ≤ 0 |
|---|---|---|
| `azione`, `obbligazione`, ETC, other | `diversi` (redditi diversi: offsettable with the zainetto) | `diversi` (feeds the zainetto) |
| `etf`, `fondo` | `capitale` (redditi di capitale: taxed in full, never offset) | `diversi` (feeds the zainetto) |
| `crypto` | `crypto` (separate basket) | `crypto` |

A gain of a non-harmonised fund is still estimated at the instrument rate and flagged `nonHarmonized` (in reality it is taxed at IRPEF, the progressive income tax).

**White-list share.** The engine knows only two rates per instrument, 26% and 12.5%. It does not compute a blended rate for a fund that holds a share of white-list government bonds; the validation schema rejects any other value. See §5.

### 4.2 Realised gains (weighted average cost)

`computeRealizedGains` walks the sorted transactions up to `toKey`, one running position per instrument.

| Type | Quantity | Cost | Realised event |
|---|---|---|---|
| `acquisto` (buy) | `+ q` | `+ q × price × multiplier × fx + fees + taxes` | no |
| `rettifica` (adjustment) | `+ q` | `+ grossAmount × fx` | no |
| `split` | `× q` (if q > 0) | unchanged | no |
| `vendita`, `rimborso` (sale, redemption) | `− sold` | `− average × sold` | yes |
| `dividendo`, `cedola` | — | — | no (income, see §4.6) |

```text
average   = cost / quantity
sold      = min(q, quantity)
proceeds  = q × price × multiplier × fx − fees        (withheld taxes do not reduce it)
gain      = proceeds − average × sold
```

`multiplier` is 0.01 for bonds quoted as a percentage of nominal (`priceMultiplier`).

Example. Buy 100 shares at €10 with €5 fees (cost €1,005), then 100 at €12 with €5 fees (cost €1,205). Average = €2,210 / 200 = €11.05. Sell 150 at €13 with €5 fees: proceeds €1,945, cost €1,657.50, gain **€287.50**.

### 4.3 Base 26% equivalent (12.5% bonds)

```text
equivalent = amount × rate / 0.26
```

Example. A €1,000 gain on a BTP at 12.5% is €480.77 in base 26%. Tax = €480.77 × 26% = **€125**, the same as €1,000 × 12.5%. A €1,000 loss on a BTP adds only €480.77 to the zainetto.

### 4.4 Yearly report and the two regimes

`computeTaxReport` builds one `TaxYear` per calendar year, from the first year with a transaction or manual carryforward up to the year of `todayKey`.

- **Fund gains (`capitale`)**: `tax = gain × rate`, added to `taxOnFunds`, in both regimes. They never touch the zainetto.
- **Regime amministrato** (broker withholds per sale): events are processed in date order. A `diversi` gain consumes the zainetto available at that moment, oldest first; the rest is taxed at 26%. A `diversi` loss is added to the zainetto immediately. A loss therefore offsets only *later* gains. Each event gets its own `lossesUsed` and `estimatedTax`. Manual carryforwards of year Y are usable from 1 January of Y.
- **Regime dichiarativo** (user declares in the tax return): all `diversi` results of the year are summed first (`netDiversi`, order does not matter). A positive net consumes the zainetto, a negative net becomes a new zainetto entry. Manual carryforwards of year Y are added after year Y's netting, so they are usable from Y+1. Per-event `estimatedTax` stays `null`.

```text
amministrato, per diversi gain:  tax = (equivalent − zainettoUsed) × 0.26
dichiarativo, per year:          tax = max(0, Σ equivalent − zainettoUsed) × 0.26
estimatedTax(year) = taxOnGains + taxOnFunds + taxOnCrypto
```

Example, same year, zainetto empty on 1 January:

| Date | Event | Amministrato | Dichiarativo |
|---|---|---|---|
| Jan | stock A gain +€1,000 | tax €260 (no loss yet) | part of net |
| Mar | stock B loss −€2,000 | zainetto +€2,000 | part of net |
| Apr | ETF gain +€1,000 | tax €260 (capitale) | tax €260 (capitale) |
| May | stock C gain +€1,500 | uses €1,500, tax €0, zainetto left €500 | part of net |
| Year | | tax **€520**, zainetto €500 | net diversi = +€500 → tax €130 + €260 = **€390**, zainetto €0 |

### 4.5 Zainetto fiscale (loss carryforward)

Each loss is a `LossEntry` with `year`, `expiresYear = year + LOSS_CARRY_YEARS` (4), `amount` and `remaining` in base 26%, `origin` (`calcolata` or `manuale`) and a `crypto` flag. `consumeLosses` uses entries oldest first and skips entries of the other basket or already expired. At the end of each closed year (`y < currentYear`), entries with `expiresYear === y` are zeroed; non-crypto residues are reported as `lossesExpired`. The current year never expires anything yet.

Example. A €2,000 loss in 2021 can be used until 31 December 2025. If €800 is still unused at the end of 2025, the 2025 row shows `lossesExpired = €800`.

`lossesByExpiry` groups the remaining zainetto by expiry year for the UI. `computeTaxOpportunities` shows the zainetto expiring this year, open gains it could offset (stocks, bonds, ETCs: not ETFs, not crypto) and open losses that a sale would add to it.

### 4.6 Crypto

Crypto is always netted per year (dichiarativo style) in its own basket, regardless of the portfolio regime.

| Year | Rate | Exemption |
|---|---|---|
| ≤ 2024 | 26% | whole net gain exempt if ≤ €2,000 (`CRYPTO_EXEMPTION`) |
| 2025 | 26% | none |
| ≥ 2026 | 33% (`cryptoTaxRate`) | none |

The exemption is a threshold, not a deduction. Example: 2024 net €1,500 → €0; 2024 net €2,500 → €650; 2026 net €3,000 → **€990**. Crypto losses go into a crypto-only zainetto with the same 4-year expiry.

### 4.7 Dividends and coupons

The yearly report only sums what was recorded: `incomeGross = Σ grossAmount × fx` and `incomeWithheld = Σ taxes` for `dividendo` and `cedola`. It does not compute a liability on income; withholding at source is assumed final.

Two estimates use the instrument rate, in [`lib/investments/dividends.ts`](../../lib/investments/dividends.ts):

```text
forecastIncome:      net = gross × (1 − taxRate)        (foreign withholding ignored)
findMissingIncome:   estimatedTax = gross × fx × taxRate
```

Example. A €100 forecast dividend of a stock → net €74; a €100 BTP coupon → net €87.50.

### 4.8 Bollo (stamp duty)

`computeBollo` uses the daily portfolio values (`computeDailyPortfolioValues`, all instrument types).

```text
bollo(year) = valueAtYearEnd × 0.002 × min(1, days / daysInYear)
days        = days with value > 0 (closed years)
            = days from the first invested day of the year to 31 December (current year, projected)
```

For the current year the value is today's and the row is flagged `estimate`. Example: first investment on 1 July 2025, €20,000 at year end: 184/365 × €20,000 × 0.2% = **€20.16**. A full year at €50,000 → €100.

Separately, [`lib/calc/costs.ts`](../../lib/calc/costs.ts) `summarizeCosts` charges the bollo rate of the product country (`investmentCosts.annualStampDutyRate`: 0.2% for IT, 0 for DE) on non-crypto positions, for the cost summary in Analitiche.

### 4.9 «Prima di vendere» (before you sell)

`simulateSale` appends a synthetic `vendita` dated today (id `simulazione`, no withheld tax, optional fees), runs `computeTaxReport` before and after, and compares the current year.

```text
taxDelta      = estimatedTax_after(year) − estimatedTax_before(year)
lossesUsed    = Δ lossesUsed + Δ cryptoLossesUsed
lossesCreated = Δ lossesCreated + Δ cryptoLossesCreated
net           = proceeds − taxDelta
```

It returns `null` for a non-positive quantity or price. The card ([`sale-simulator-card.tsx`](../../components/domain/investments/taxes/sale-simulator-card.tsx)) lists only priced positions (`buildTaxView().sellable`) and caps the quantity at the quantity held.

Example, amministrato, zainetto €1,000: selling shares with cost €5,000 for €6,500 → gain €1,500, zainetto used €1,000, `taxDelta` = €500 × 26% = €130, net **€6,370**. In dichiarativo a loss lowers the year's tax, so `taxDelta` can be negative.

### 4.10 Sell everything today (latent tax)

`computeLiquidation` in [`lib/calc/liquidation.ts`](../../lib/calc/liquidation.ts) is a simpler estimate, used by Analitiche, not by the «Prima di vendere» card.

```text
tax(position) = max(0, unrealizedGain) × taxRate
latentTax     = Σ tax(position)
netValue      = grossValue − latentTax
taxRatio      = latentTax / grossValue
```

Losses are worth zero and the zainetto is ignored. Example: A worth €10,000 with +€3,000 at 26% (€780), B worth €5,000 with −€1,000 (€0), C (BTP) worth €4,000 with +€400 at 12.5% (€50) → latent tax €830, net value €18,170.

In [`lib/analitiche/plan.ts`](../../lib/analitiche/plan.ts), when `includeLatentTax` is on, `taxShare = min(latentTax / wealth, 0.99)` (wealth includes cash) and `fireNumberAfterTax` returns `gross / (1 − taxShare)`. Example: spending €20,000 at a 4% withdrawal rate → €500,000; with a 4% tax share → €520,833.

### 4.11 Dated charges for the cost/tax impact

`estimatedTaxCharges` turns each year's `max(0, estimatedTax − withheld)` into dated charges for [`lib/investments/cost-impact.ts`](../../lib/investments/cost-impact.ts). In amministrato without crypto the amount is spread over the sale dates in proportion to each event's unwithheld tax; in dichiarativo, or when the year has crypto, it is dated 31 December (or today for the open year).

### 4.12 Germany (partial, 2026 only)

The product country (`IT` or `DE`) is an account setting independent from the language ([`lib/localization/config.ts`](../../lib/localization/config.ts)). For `DE`, the Tasse route renders `PlanningScreen section="tax"` instead of the Italian page.

**What is visible and what is blocked.**

[`lib/localization/planning-availability.ts`](../../lib/localization/planning-availability.ts) holds the central switches:

| Capability | DE |
|---|---|
| `tax` (Tasse screen) | on |
| `income` (Proventi screen) | on |
| `pension`, `retirement`, `simulations` | off (kept, hidden until product review) |

`isCountryPathAvailable` (used by navigation, the proxy and `withCountryGuard`) blocks for DE: `/pensione`, `/analitiche`, every subpage of `/investimenti/tasse` and `/investimenti/proventi`, and the APIs `/api/pension`, `/api/analytics`, `/api/goals`, `/api/sidebar/fire`, `/api/investments/tax-carryforwards` (403 `country_feature_unavailable`). In addition, the Italian engine refuses DE (`investmentTaxReport` throws), `PATCH /api/investments/portfolio` rejects `taxRegime`, and the instrument settings route rejects `taxRate`/`taxHarmonized` (`countryFeatures("DE").taxes` is `false` in [`financial-country.ts`](../../lib/localization/financial-country.ts)).

With `simulations` off, the German sale simulator, crypto editor and Vorabpauschale scenario are not rendered ([`tax-editor.tsx`](../../components/domain/financial-planning/tax-editor.tsx)), although their functions exist.

**German capital tax.**

`germanPortfolioReport` ([`lib/financial-planning/portfolio.ts`](../../lib/financial-planning/portfolio.ts)) uses **FIFO lots per custody account** (`portfolioId:statementAccountKey:instrumentId`), not the Italian weighted average. Buy fees go into the lot cost, sell fees reduce the gain. Only `azione`, `obbligazione`, `etf`, `fondo` are supported; crypto is skipped (separate private-sale scenario). The estimate is `null` when any issue is present: portfolio currency not EUR, history not confirmed, fund classification unknown, fund history not confirmed, pre-2009 shares or pre-2018 fund lots, unsupported adjustments, missing lots, invalid amounts.

`germanCapitalTax` ([`countries/de.ts`](../../lib/financial-planning/countries/de.ts), constants `DE_2026`):

```text
sharesAfterLoss = shareGains − shareLosses              (share losses offset share gains only)
pooled          = max(0, sharesAfterLoss) + generalIncome + otherCapitalIncome − generalLosses
taxable         = max(0, pooled − allowance)             allowance = 1,000 (2,000 joint) − used elsewhere
capitalTax      = (taxable − foreignCredit / 0.25) / (4 + churchRate)
solidarity      = floor(capitalTax × 5.5%)  (to the cent)
church          = capitalTax × churchRate
```

Fund income and fund gains are multiplied by the partial-exemption share (`fundTaxableShare`: equity 70%, mixed 85%, property 40%, foreign property 20%, other 100%, unknown → `null`). Losses carry forward without expiry.

Example (single, no church tax): share gains €3,000, share losses €500, equity-ETF dividends €2,143 × 70% ≈ €1,500 → pooled €4,000, taxable €3,000, capital tax €750, solidarity €41.25, total **€791.25**. With 9% church tax: €733.50 + €40.34 + €66.02 = €839.86.

`germanFundAdvance` (Vorabpauschale) caps `startValue × 3.2% × 0.7` at the year's growth, subtracts distributions and prorates by acquisition month; it is received in 2027 and no 2027 tax is computed. Example: €10,000 → €11,000, no distributions, held all year → €224 gross, €156.80 after the equity exemption. `germanCrypto` treats the €1,000 private-sale limit as a threshold (not a deduction), exempts sales after more than one year, and applies the progressive tariff `germanIncomeTax` as a difference: short-term gain €1,200 on €40,000 other taxable income → €382.

`germanIncomeForecast` ([`income.ts`](../../lib/financial-planning/income.ts)) reuses the shared dividend schedule and computes each event's net as the incremental annual tax, never a flat rate.

## 5. Limits and out of scope

- Not validated by a professional; estimates only (see the status note at the top).
- No white-list blended rate: only 26% and 12.5% per instrument; a fund holding government bonds is taxed at the rate the user picks.
- Non-harmonised funds are estimated at 26%, not at IRPEF.
- No foreign withholding credit, no tax return sections (consciously deferred in [`CLAUDE.md`](../../CLAUDE.md)). Dividend tax is not recomputed: recorded withholding is taken as final.
- No lot-level fiscal reconstruction for imports; weighted average cost only. History correction around a split is deferred.
- `computeLiquidation` ignores the zainetto and offsets between positions.
- Bollo uses the whole portfolio value, crypto included, while `summarizeCosts` excludes crypto: the two figures can differ.
- In `computeRealizedGains` the proceeds use the requested quantity while the cost uses `min(quantity, held)`: an oversell inflates the gain. The simulator caps the quantity, imports and manual entries rely on validation upstream.
- Germany: tax year 2026 only, EUR only, private investors, no automatic foreign credit, no 2027 rates; pension, retirement and simulations hidden.

## 6. Tests

- [`lib/calc/taxes.test.ts`](../../lib/calc/taxes.test.ts): weighted average with fees, splits, bonds in % of nominal, ETF gain vs loss category; amministrato ordering (a loss does not offset an earlier gain, ETF gains never use the zainetto); dichiarativo netting and 4-year expiry; 12.5% bonds at 48.08%; crypto 33% from 2026 and €2,000 exemption to 2024; manual carryforward timing per regime; income and withholding sums; `simulateSale`; bollo proration; rate resolution order and shared-instrument isolation.
- [`lib/calc/analytics-extras.test.ts`](../../lib/calc/analytics-extras.test.ts): `computeLiquidation` taxes gains only; cost summary and cost drag.
- [`lib/investments/tax-list-isolation.integration.test.ts`](../../lib/investments/tax-list-isolation.integration.test.ts): the rate list shows only the user's own open or taxed instruments.
- [`app/api/investments/fase-4-routes.test.ts`](../../app/api/investments/fase-4-routes.test.ts): regime update, instrument tax settings (save, reset, other user's instrument 404), manual carryforwards (no future years, no cross-user delete).
- [`lib/financial-planning/germany.test.ts`](../../lib/financial-planning/germany.test.ts): no fallback to Italy or other years, foreign credit and church tax, share-loss basket, FIFO per custody account, splits, FX, fund exemptions, Vorabpauschale, crypto threshold, progressive tariff, income forecast.
- [`lib/financial-planning/api.integration.test.ts`](../../lib/financial-planning/api.integration.test.ts): plan persistence, per-user isolation, optimistic revision.
- [`lib/localization/config.test.ts`](../../lib/localization/config.test.ts), [`guard.test.ts`](../../lib/localization/guard.test.ts): Italian APIs and subpages stay blocked for DE.

## 7. Related

- [overview.md](overview.md), [investments.md](investments.md), [market-data.md](market-data.md), [net-worth.md](net-worth.md), [pension.md](pension.md), [analytics-and-goals.md](analytics-and-goals.md), [background-jobs.md](background-jobs.md)
- Spec: [`docs/superpowers/specs/2026-09-30-investimenti-fase-4-design.md`](../superpowers/specs/2026-09-30-investimenti-fase-4-design.md)
- Decisions: [`2026-10-06-impatto-costi-imposte.md`](../decisioni/2026-10-06-impatto-costi-imposte.md), [`2026-10-11-regime-fiscale-in-fondo.md`](../decisioni/2026-10-11-regime-fiscale-in-fondo.md), [`2026-10-14-pianificazione-finanziaria-germania.md`](../decisioni/2026-10-14-pianificazione-finanziaria-germania.md), [`2026-10-14-costi-investimenti-germania.md`](../decisioni/2026-10-14-costi-investimenti-germania.md)
