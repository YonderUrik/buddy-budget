# Germany financial planning — local implementation

## Decision and status

Request: implement all remaining areas of the roadmap, with rules extensible to other countries and a DE/EN interface. This implementation covers an **explicit scope of scenarios for private individuals resident in Germany in EUR**, not every German tax case. No merge or deploy included. Phase 2 costs remain in the branch and are documented separately.

Now: local implementation, automated and browser checks. Before release: user trial, PR review, CI and migration on the target environment. Do not generically enable the flags of the old Italian engines: they stay false for DE. The four main pages route to German components and do not mount the Italian providers; the old pension/analytics APIs and sub-pages remain protected.

## Extensible model

`lib/financial-planning/registry.ts` registers model and schema per country; `countries/de.ts` contains versioned 2026 rules and sources. No link to the language. Separate tables and documents per `(user_id, country)`, document version and revision for concurrency control. A new country requires a verified adapter, its schema and views: no automatic fallback to Italian or German rules.

Migration 0038 creates `financial_plans`, with FK and cascade delete. The authenticated endpoints check the country from the session, validate the entire document and reject stale revisions with 409. Account export and reset include the plans. No change to investment operations; no capitalization of pension entitlements into net worth.

## Features and scope

- **Basic taxation**: FIFO separated per imported portfolio/custody account and instrument, trading fees, FX of the operation, percentage pricing of bonds, splits. Single/joint Pauschbetrag (flat allowance), share losses separated from the others, no Italian four-year expiry, capital gains tax, Solidaritätszuschlag (solidarity surcharge), Kirchensteuer (church tax) with the correct denominator. Foreign tax credit only if the user confirms the amount actually anrechenbar (creditable) after limits, refunds and offsets. Recorded withholdings kept separate, not automatically treated as a credit. Sale simulation without writing operations.
- **Funds/ETFs**: explicit tax classification (30/15/60/80/0% exemption) and a distinct unknown state; subtraction of prior gross Vorabpauschalen (advance lump-sum taxes on funds) attributable to the units sold before the Teilfreistellung (partial exemption). Taxable Vorabpauschalen received in the year are entered among the further income. 2026 scenario for an unchanged lot held until year end: base 3.20% × 70%, cap at the increase plus distributions, subtraction of distributions and reduction per month of purchase. Inflow in 2027, without inventing a tax estimate for an unverified year.
- **Income**: actually recorded gross/withholding/net history; gross forecast of the following 12 months with the shared dividends/coupons engine. Incremental German net only when year, classifications and history are complete, using allowances and losses only once. Redemptions of principal are not distributed income. No Italian tax rate used in the net.
- **Pensions**: separate recording of GRV (statutory pension insurance), bAV (occupational pension), Riester, Rürup and private ones. GRV: points earned + assumption of new points, explicit access factor and July 2026 Rentenwert (pension value); no conversion of the entitlement into capital. Contracts: current capital, contributions and nominal return after costs; future annuity from the provider's statement. Riester/Rürup/GRV annuity only in this version; the other contracts can use a contractually available capital **or** annuity, never both.
- **Retirement/FIRE**: liquid capital separate from contracts, contributions and spending in real euros, time bridges up to the individual pensions, contractual capital available at the payment date, 50 years of scenario and depletion year. Taxes on pensions, social contributions and the tax share of withdrawals are explicit assumptions, not automatic calculations of the German net.
- **Private crypto**: scenarios of individual manually matched lots, including swaps; over one year, Freigrenze (exemption threshold) of €1,000 (not an allowance), other private gains/losses and prior loss separate from capital. Increment of the progressive 2026 Einkommensteuer (income tax) on the taxable income provided, also with splitting. No automatic import of the tax basis from the portfolio's weighted average.

## Deliberate limitations and later work

Do not present these areas as a complete tax return. Later integrations are needed for unrecorded transfers and corporate actions, pre-2009 securities, pre-2018 funds/classification changes, automatic calculation of foreign credits and DTAs (DBA), Günstigerprüfung (most-favourable assessment), business taxation, derivatives/ETCs, all future dates/rates. Incomplete positions block the tax total instead of using zero cost. Crypto transactions are excluded from the §20 report and go into the separate §23 scenario.

For pensions it remains to integrate eligibility, subsidies and deductions, guarantees and surrenders, capital/annuity conversion of the individual contract, actual taxation by cohort and product, Kranken-/Pflegeversicherung (health/long-term care insurance). No Italian tax rate is reused. For crypto, staking rewards, lending, mining, NFTs, professional activity, carryback and income surtaxes stay out: the result explicitly states these exclusions. Return to each with specific requirements, sources and fixtures; do not hide them under the term "everything".

## Official sources verified on 14 October 2026

- https://www.gesetze-im-internet.de/estg/__20.html — FIFO, losses, Sparer-Pauschbetrag (saver's allowance) and expenses.
- https://www.gesetze-im-internet.de/estg/__32d.html — tax rate, Kirchensteuer denominator, foreign credits and Günstigerprüfung.
- https://www.gesetze-im-internet.de/solzg_1995/__4.html — Solidaritätszuschlag on capital income.
- https://www.gesetze-im-internet.de/invstg_2018/__18.html — Vorabpauschale.
- https://www.gesetze-im-internet.de/invstg_2018/__19.html — deduction of prior gross Vorabpauschalen.
- https://www.gesetze-im-internet.de/invstg_2018/InvStG.pdf — §20 Teilfreistellung (the §20 HTML page is intermittently unavailable; the official PDF text was consulted).
- https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Investmentsteuer/2026-01-13-basiszins-berechnung-vorabpauschale.pdf?__blob=publicationFile&v=1 — Basiszins (base rate) 2026: 3.20%.
- https://www.gesetze-im-internet.de/rwbestv_2026/BJNR0B20A0026.html — Rentenwert €42.52 from 1 July 2026.
- https://rvrecht.deutsche-rentenversicherung.de/SharedDocs/rvRecht/01_GRA_SGB/06_SGB_VI/pp_0051_75/gra_sgb006_p_0064.html — pension formula.
- https://www.gesetze-im-internet.de/estg/__23.html — private sales, holding period and threshold.
- https://amtliche-handbuecher.bundesfinanzministerium.de/esth/2025/B-Anhaenge/Anhang-04/anhang-4.html — BMF guidance on crypto-assets.
- https://www.gesetze-im-internet.de/estg/__32a.html — 2026 progressive tariff and splitting.

## Observability, landing and verification

Logs `financial_plan.saved` and `financial_plan.save.conflict`, endpoints with `withRoute`. Umami `financial_plan_saved` and `financial_sale_simulated`, country/section only, never amounts or names. Landing catalog updated and synced, description limited to the scenarios actually implemented.

Build and TypeScript successful. First targeted suite: 78 tests passed. Full suite: 2,265 tests passed, only pre-existing failure of the logger due to `/Users/mario` in the local stack. Includes real tests of authentication, user/country separation, validation, concurrency, export and reset. Browser check and final review to be recorded on completion.

## Final outcome of the local trial

- Final build successful, TypeScript without errors, ESLint of the modified files without findings and `git diff --check` clean.
- After the last checks on duplicates and crypto year, 47 targeted tests passed (German model, localization, catalog). Previous full suite: 2,265 passed + only the known local logger error.
- Browser: 16 page/profile combinations for the four new pages with DE/en, DE/de, IT/it, IT/en; save/reload, simulator, no calls to Italian providers/APIs for DE, operations unchanged and no browser errors. The test restores the original plan.
- Mobile DE/de at 390 px: four pages without horizontal overflow or browser errors; visual check of the pension done. Profile restored to DE/en.
- Italian landing screenshots of the Tasse, Pensione, Analitiche pages regenerated in both themes; the previous Costs screenshots remain included. Three screenshot tests and catalog sync check successful.
- Migration applied only to isolated local databases (preview and the suite's temporary database). Preview available on localhost:3300. No merge/deploy and no change to real data.

## Altersvorsorgedepot (AVD, retirement savings depot)

Added as a distinct type in the Pensione section, not as a freely available portfolio. DE/EN: AVD selection, contributions and gross capital projection with the existing explicit assumptions. No automatic inclusion in net worth or in FIRE liquid capital. No presumed AVD incentives, tax relief or taxation; no full lump-sum payout in the initial model. Duration of payout plans and partial capital still excluded and stated in the interface. The additional type uses the existing JSON document, without migration.

Indication of new contracts from 2027 verified in the official BMAS/BMF information; the product is presented as a prospective scenario, not an account already available in 2026. Source: https://www.bmas.bund.de/DE/Soziales/Rente-und-Altersvorsorge/Private-Altersvorsorge/Steuerlich-gefoerderte-private-Altersvorsorge/steuerlich-gefoerderte-private-altersvorsorge.html and https://www.bundesfinanzministerium.de/Content/DE/FAQ/reform-der-privaten-altersvorsorge.html . Landing catalog synced; Italian screenshots unchanged because the option appears only on the German screen. 49 targeted tests passed, TypeScript and ESLint successful.

AVD check completed: build successful; browser on DE/de profile at 390 px confirms save/read of the `avd` type, 2027 notice, absence of the full-payout option, no overflow or browser error. Also fixed the accessible label of the form's selectors (label separate from the options). Original demo plan restored and language set back to English.

## Extension of 15 October: AVD incentives and net pension

Supersedes the limitations of the first AVD version described above. No merge authorized in this phase.

- AVD: rules approved from 2027, minimum and maximum contribution, first/second band of the Grundzulage (basic allowance), Kinderzulage (child allowance) with remaining duration per child, one-off starting bonus, explicit direct/indirect entitlement. A single aggregated scenario per person avoids duplicating incentives across contracts. Monthly contributions and Zulagen (allowances) at year end; the tax credit stays outside the capital.
- AVD deduction comparison: computes the incremental benefit net of the Zulagen, with a **constant 2026 tariff explicitly declared**. It is not a 2027 tax return nor a complete check of deductions with an indirectly entitled spouse.
- AVD: choice between the annuity declared by the provider and amortization over a defined duration at least up to age 85; partial initial capital up to 30%; income ends at the end of the plan. Provider amounts must already account for the chosen partial capital.
- Net pension: mode separate from the previous manual assumptions. Taxable share of GRV/Rürup by cohort, fixed Freibetrag (allowance) or derived for a constant pension; Ertragsanteil (income portion) of private annuities; fully financed or taxable treatment from certification for other contracts. Blocks the net if the classification is missing, including an AVD with mixed contributions wrongly declared as fully subsidized.
- KVdR (health insurance for pensioners): half KV/Zusatzbeitrag (health insurance/additional contribution) on GRV, full Pflege (long-term care), aggregated bAV KV allowance and distinct Pflege threshold, shared contribution ceiling, bAV capital spread over 120 months. PKV (private health insurance): actual net premium and deductible share explicit. Voluntary insurance uses minimum/maximum bases and rates for ordinary and reduced income, without bAV allowance; the DRV contribution is subtracted only if confirmed. Special bAV regimes are not automatically assimilated to subsidized contracts.
- Aggregated progressive pension tax, splitting chosen in Tasse, pension Pauschbetrag only once, Soli with threshold and phase-in band, Kirchensteuer estimated before its own Sonderausgabenabzug (special-expense deduction). Separate base for Kinderfreibeträge (child allowances) on the surcharges. The model covers one insured person; other household income is a separate input.
- Future income: choice between verified years and comparison under constant 2026 rules. The second mode renews the annual Freibetrag, carries losses forward and does not assume external income or future foreign credits. It does not confuse these projections with the actual 2027 taxes.
- Backward compatibility: new JSON fields with defaults, previous modes kept; no additional DB migration. Specific engines in `countries/de-avd.ts` and `countries/de-pension.ts`, independent of the language.

### Sources verified on 15 October 2026

- Approved reform (do not use the values of the December 2025 proposal): https://www.bundesregierung.de/breg-de/aktuelles/reform-private-altersvorsorge-2400072
- BMF, AVD details: https://www.bundesfinanzministerium.de/Content/DE/FAQ/reform-der-privaten-altersvorsorge
- EStG §22 (cohorts, Ertragsanteil and subsidized benefits): https://www.gesetze-im-internet.de/estg/__22.html
- EStG §32a: https://www.gesetze-im-internet.de/estg/__32a.html
- SolZG §§3–4: https://www.gesetze-im-internet.de/solzg_1995/BJNR097500993.html
- SGB V §§226 and 229 (allowance, threshold, capital): https://www.gesetze-im-internet.de/sgb_5/__226.html and https://www.gesetze-im-internet.de/sgb_5/__229.html
- DRV, KV split: https://www.deutsche-rentenversicherung.de/DRV/DE/Rente/In-der-Rente/Kranken-und-Pflegeversicherung-der-Rentner/kranken-und-pflegeversicherung-der-rentner_node.html
- Social security values 2026: https://www.bmas.bund.de/DE/Service/Gesetze-und-Gesetzesvorhaben/sozialversicherungs-rechengroessenverordnung-2026.html
- 2027 income tax reform described as a draft: https://www.bundesfinanzministerium.de/Content/DE/Pressemitteilungen/Finanzpolitik/2026/09/2026-09-02-einkommensteuerreform.html . Not treated as final rates.

### Explicitly left out of automatic coverage

Attribution of the spouse's income to health contributions, employment and non-periodic private capital without the Krankenkasse's (health insurer's) assessment; complete check of eligibility for the incentives; bAV contracts under former §19 and historical peculiarities; full taxation of mixed contributions without certification; personal incentives other than the inputs; actual future return; future rates not yet final; the investment cases listed above. These limits are of financial coverage, not missing translations. The PR stays in draft until the new flows are reviewed.

Verification of the extension: 84 targeted tests passed, production build/TypeScript/lint passed. Full suite: 2,302 passed, only the pre-existing local logger error on the `/Users/mario` path. Real browser: editing, saving and re-reading AVD; net and future income settings persistent; DE/en desktop and DE/de mobile on Pensione, Analitiche, Proventi without errors or overflow. Original demo plan restored. PR screenshots updated, net pension added. AVD dates/ages must agree; ordinary start of payout limited to 65–70 years, without automatically deducing early-retirement exceptions.


Voluntary insurance completed for periodic pensions and other declared income: 2026 bases, general rate for GRV/bAV and reduced rate for private annuities, rents and capital income; no bAV allowance; optional DRV subsidy confirmed. Non-periodic private capital is not mistaken for income: the net remains unavailable and requires the insurer's assessment. Sources: https://www.tk.de/techniker/versicherung/gut-versichert-in-jeder-lebenslage/freiwillige-krankenversicherung-tk/beitragshoehe-freiwillig-versicherte-rentner-2006966 and https://www.aok.de/pk/krankenkassenbeitraege/freiwillige-krankenversicherung-client-plus/ . Four further tests on minimums, maximums, mixed bases, subsidy and blocking of non-periodic benefits; targeted total 88.

Also fixed the top-up to the voluntary minimum base: the difference from actual income uses the reduced rate, even when the only income is a small GRV/bAV pension. Regression test included. Contributions are annualized estimates: the insurer's monthly rounding may produce differences of cents.

## Change of direction: essential availability, 15 October

At the user's request, pension/AVD, retirement and the separate simulators (sale, crypto, Vorabpauschale and constant future tariff) are suspended until his review. Code, tests, schema, translations and saved plans remain preserved.
The per-country configuration `planning-availability.ts` controls visibility; sidebar, mobile menu and proxy also prevent direct access to the suspended sections.
Cash, budget, debts, investments, returns, income and partial taxes remain, with explicit limits. The income forecast ignores the saved future assumptions while the related simulator is off, without overwriting them.
Reactivation will happen one feature at a time after review, not automatically with the merge. The public catalog reflects this scope.

Verification of the reduced scope: 88 targeted tests, lint, TypeScript and build passed. Browser EN/DE desktop/mobile: suspended navigation and URLs blocked, taxes/income accessible, hidden data preserved after saving taxes; no browser errors. Local preview updated, no merge.

### Alignment before the merge

Integrated main's changes to Goals, imports and the landing. Both sets of translations kept. The financial migration is regenerated as `0039_equal_lilandra`, after `0038_goals` already on main; schema and snapshot include both features. In the local preview the previous financial migration was realigned without deleting plans.
