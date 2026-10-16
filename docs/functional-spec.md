# BuddyBudget — Detailed functional specification (from the mockup)

## Methodology

This document comes from running the mockup (`docs/design-reference/mock-up.html`) **interactively** in a real browser (served locally, not opened as `file://`), clicking every button, filter, slider and field of every screen to verify what is actually wired up in JavaScript and what is only static scenery. It is therefore not a reading of the markup alone, but a behavioral test.

**Why this document exists**: the summary in `product-vision.md` ("Core features derived from the mockup") was incomplete — the real mockup has 9 areas, not 7, and several features (what-if simulators, securities management, debt repayment plan) were not represented at all. This file is the detailed source of truth; `product-vision.md` remains the high-level summary and refers here for details.

**What this document is NOT**: it is not (only) a **descriptive** account of a single static HTML file, with no backend, no persistence and an interaction budget limited to what the mockup's designer had time to wire up in JavaScript. Every **"What the mockup does NOT implement"** item is followed by an **explicit decision for the real product**: implement it (and with what behavior) or consciously exclude it (and why). The absence of a feature in the mockup is not left as an unanswered open question — it is either resolved here or explicitly flagged as a question still to be asked to the user. The decisions made in this document are also recorded in the "Decision log" of `CLAUDE.md`; in case of a future conflict with `product-vision.md` or with new decisions recorded there, the latter always prevail over what is written here.

UI labels and screen names are kept in Italian as they appear in the app, with an English gloss where useful.

## Global interface structure

- **Navigation sidebar**, with responsive behavior in three modes:
  - **Desktop (≥ 1024px)**: sidebar fixed on the left, expanded (240 px), always visible. It contains the "Patrimonio" ("Net worth") logo/brand, 9 navigation items, user card ("MR" / "Marco Rossi" / "Piano personale", "Personal plan") and theme toggle. The user can **collapse it manually** via a ◀/▶ button at the bottom: it enters *icon-only* mode (64 px, icons only + tooltip on hover). The expanded/collapsed state is persisted in `localStorage`.
  - **Tablet (768–1023px)**: sidebar automatically fixed in *icon-only* mode (64 px) regardless of the saved state. Hovering the icons shows a tooltip with the item name.
  - **Mobile (< 768px)**: sidebar not visible. A **minimal topbar** appears at the top (logo + hamburger button + theme toggle). Pressing the hamburger opens a **drawer** from the left with the sidebar in its expanded version; tapping the overlay or navigating closes the drawer.
  - The "Patrimonio" logo/brand (not clickable), 9-item navigation — **Panoramica (Overview), Conti (Accounts), Spese (Expenses), Cash flow, Investimenti (Investments), Pensione (Pension), Debiti (Debts), Pianifica (Plan), Analitiche (Analytics)** — user card and light/dark theme toggle are present in all modes (graphically adapted).

- **Desktop topbar and global "add" button**: absent in the mockup. **Decision: they stay absent in the real product too.** Every entry stays anchored to the domain screen (expense in Spese, security in Investimenti, etc.): a global "+" button would have to open the relevant section's form anyway, so it adds no value and only introduces one more route to maintain.
- **Global search**: absent in the mockup. **Decision: to be implemented**, but not in the MVP — when the volume of data (accounts, transactions, securities) grows beyond the few demo items, a search that jumps directly to an account/transaction/security becomes useful; with few rows as in the mockup it is not. Postponed to a phase after the base screens go to production.
- **Notifications**: absent in the mockup. **Decision: do not implement them for now.** The product does not yet have a concept of an event worth a notification (no budget overrun alert, no installment due date, no multi-user collaboration); introducing them first requires defining which events matter, which is out of scope at this stage.
- Switching screens is instant (client-side SPA, no reload, no URL/hash change — the browser's back/forward navigation cannot be used to move between sections).
- **State is kept in JS memory shared across screens**: changes made in one section (e.g. an expense "split" in half) remain visible when returning to the same section later in the session, but **are lost on page refresh** — there is no persistence at all (neither localStorage nor backend). See the decision on persistence in "Cross-cutting limitations" below.

---

## 1. Panoramica (Overview)

**Purpose**: daily overview of net worth, liquidity, investments, pension and latest transactions.

**What you see**:
- Current date in long Italian form ("Lunedì 30 giugno 2026")
- Period selector **1M / 3M / 1A / Max** (working: it changes the "ultimi N" ("last N") label under net worth and presumably the associated chart — the aggregate values at the top do not change)
- "Patrimonio netto" ("Net worth") card with absolute and percentage change, trend chart
- 4 asset mini-cards: Liquidità (Cash), Spese del mese (Monthly expenses, with a progress bar against the budget), Titoli (Securities), Pensione — each with an "Auto" or "Manuale" ("Manual") label indicating the data source
- "Ultimi movimenti" ("Latest transactions") list (7 rows, read-only) with a **"Vedi tutti"** ("See all") link
- "Allocazione patrimonio" ("Asset allocation") block with a percentage breakdown by asset class

**What you can do**:
- Change the reference period of the net worth chart (1M/3M/1A/Max) — **working**, updates the text label.

**What the mockup does NOT implement — decision for the real product**:
- **"Vedi tutti" is a stub** (no effect). **Decision: implement** — it must lead to an extended view of the transactions, reusing the Transazioni list already present in "Spese" (possibly filtered on "all sources"), not a new list to maintain in parallel.
- **No transaction can be edited or deleted from here**. **Decision: keep it this way** — editing transactions stays anchored to the domain screen (Spese or Investimenti), consistent with the "one action, one screen" principle already followed in the rest of the mockup; duplicating it here would create two points of truth for the same data.
- **No way to add a transaction from here**. **Decision: keep it this way**, same reason as the previous point.
- **The "Andamento" ("Trend") chart has no tooltip/hover with point values**. **Decision: implement** — a trend chart without point values on mouseover is below the standard expected for an interactive chart; it is a limitation of the static image used in the mockup, not a design choice.

---

## 2. Conti (Accounts)

**Purpose**: management of the liquidity that feeds expenses and transactions ("la base di spese e transazioni", "the basis of expenses and transactions").

**What you see**:
- 3 KPIs: Liquidità totale (Total cash), Conti collegati (Linked accounts, count), Patrimonio netto (Net worth)
- List of accounts, each with: initials/institution, account name, bank · type, **Auto** or **Manuale** label, balance, **✕** button (remove)
- Manual accounts (e.g. "Contanti", "Cash") have **name and balance editable inline** (text fields directly in the row)
- **"+ Aggiungi conto"** ("+ Add account") button

**What you can do (verified working)**:
- **Add a manual account**: clicking "+ Aggiungi conto" shows a new row "Nuovo conto / Conto · manuale" ("New account / Account · manual") with balance 0, immediately editable.
- **Edit the name and balance of a manual account** directly in the row (text field): the change **recalculates in real time** Liquidità totale, Conti collegati and Patrimonio netto at the top.
- **Remove any account** (✕) — including those marked "Auto" (linked). The totals are recalculated immediately.

**What the mockup does NOT implement — decision for the real product**:
- **No real bank connection** (the "Auto" accounts are preloaded static data; "✕" only removes them locally). **Decision: out of scope for now** — a real Open Banking/PSD2 integration is a project of its own (third-party provider, OAuth consent, recurring sync). The real product starts with manual accounts only; the bank connection remains an explicit future extension, to be planned separately when the provider is chosen.
- **Design inconsistency**: "Auto" accounts can be edited/deleted exactly like manual ones. **Decision: fix in the real product** — a linked account must not have a manually editable balance/name (they come from the bank): the only allowed action must be "Scollega conto" ("Unlink account", with confirmation), which removes the link without pretending to edit data we do not own.
- **Bank/account type not editable** for manual accounts (only name and balance are). **Decision: implement** — there is no product reason to prevent correcting bank/type after creation; it is a mockup shortcut, not a choice.
- **No confirmation before deleting an account**. **Decision: implement** a confirmation dialog for any deletion — standard for destructive actions, not specific to the financial domain.
- **No visible validation on the balance field**. **Decision: implement** numeric/currency format validation on all amount fields, here as in the rest of the app.

---

## 3. Spese (Expenses)

**Purpose**: tracking and categorization of outflows, with monthly budget logic.

**What you see**:
- Period selector **Settimana / Mese / 3 mesi / Anno** (Week / Month / 3 months / Year)
- 3 KPIs: Speso nel periodo (Spent in the period, against budget), Budget rimanente (Remaining budget, with days left), Media giornaliera (Daily average, vs previous period)
- "Per categoria" ("By category") block: user-customizable categories (page `/categorie`), each belonging to one of four **spending groups** — **Dovute** ("Must", necessary expenses: without them you would have practical or legal problems), **Volute** ("Want", they improve quality of life but you could do without them), **Te futuro** ("Future you", savings/investments treated as a priority expense, not as what is left over) and **Saltuarie** ("Occasional", necessary but not monthly: taxes, maintenance, gifts) — plus the fallback category "Da categorizzare" ("To categorize", outside any group). The donut has the **inner ring by group** (one slice per group, plus "Da categorizzare" if present) and the outer ring by individual category, angularly aligned.
- "Andamento ultimi 6 mesi" ("Last 6 months trend") block (bars, stacked by category)
- **Transazioni** (Transactions) list, with summary Uscite / Escluse / Spese effettive (Outflows / Excluded / Actual expenses)
- For each transaction: description, date · category, amount, Auto/Manuale label, **"Dividi"** ("Split") button
- **Manual** transactions also have: editable description, editable amount, **✕** button
- Entry form at the bottom: Descrizione (Description), Categoria (Category, dropdown with the 8 categories), Importo € (Amount €), Data (Date), **"+ Aggiungi"** ("+ Add") button

**What you can do (verified working)**:
- **Change period** (Settimana/Mese/3 mesi/Anno): updates the date label, "Speso", "Budget rimanente" and days left with **different, consistent numbers per period** (e.g. Settimana: € 640 out of € 740).
- **"Dividi" on any transaction (including Auto)**: opens a slider "Sposta il cursore per escludere una parte dal conteggio: è uscita dal conto, ma non è una spesa (rimborsi, quote di altri, giroconto)" ("Move the slider to exclude part from the count: it left the account but is not an expense (refunds, others' shares, internal transfer)"). Moving it splits the amount between "Spesa effettiva" ("Actual expense") and "Esclusa dal conteggio" ("Excluded from the count"), and the Uscite/Escluse/Spese effettive totals at the top **update in real time**. The state stays set even when switching screens and coming back.
- **Edit description and amount** of manual transactions (inline text field).
- **Delete** a manual transaction (✕).

**What the mockup does NOT implement — decision for the real product**:
- **The period selector does not actually filter the list below**: switching to "Settimana" changes the three KPIs at the top, but "Per categoria" (donut by group/category), the 6-month chart and the Transazioni list remain those of June. **Decision: implement correctly** — changing the period must consistently recalculate KPIs, categories, charts and the transaction list: in the mockup it is a shortcut of the demo data, not an intended behavior. (Implemented: the period also recalculates the donut and the trend.)
- **The "+ Aggiungi" form at the bottom is a stub** (no observable effect). **Decision: implement end-to-end** — it is probably the most used flow of the whole app; it must create the row, update the transaction list and recalculate all totals.
- **The "Dividi" slider does not recalculate the cards at the top** (Speso/Budget rimanente/Media giornaliera/Per categoria): they are two disconnected calculation systems. **Decision: unify** — there must be a single engine calculating the "actual" spending per period, and "Dividi" must feed into it everywhere; the mockup's misalignment is a bug not to be carried into the real product.
- **Category not editable** on an existing transaction. **Decision: implement** — correcting a miscategorized expense is a basic action that must exist.
- **Date not editable** on an existing transaction. **Decision: implement**, same reason.
- **"Auto" transactions can be neither edited nor deleted** (only "Dividi" works on them). **Decision: keep as in the mockup** — consistent with the idea that they come from a bank connection: editing them locally would falsify the source data, whereas "Dividi" is an overlay that does not touch the original amount, so it remains the only sensible action on this type of row.
- **No pagination/search/filter by category** in the transaction list. **Decision: implement** when the real volume of transactions exceeds the handful of demo rows — necessary with real data over several months, not necessary while the dataset is small (e.g. first months of use).

---

## 4. Cash flow

**Purpose**: income, outflows and distribution of money — conceptually corresponds to "Entrate" ("Income") in the old vision, but is broader (it combines income + destination of the surplus).

**What you see**: entirely **read-only**, no input, no edit button.
- 4 KPIs: Entrate medie (Average income), Uscite medie (Average outflows, excluding internal transfers), Flusso netto (Net flow), Tasso di risparmio (Savings rate)
- "Entrate vs uscite" ("Income vs outflows") chart, last 12 months (side-by-side bars Jul–Jun)
- "Fonti di entrata" ("Income sources"): Stipendio (Salary), Freelance, Dividendi e interessi (Dividends and interest), each with amount and % share of the total
- "Dove va ogni euro" ("Where every euro goes", current month): **Dovute, Volute, Te futuro, Saltuarie, Non classificato (Unclassified), Avanzo (Surplus)** — with amount and %, colored dot for the four group items. "Te futuro" (savings/investments) counts as an expense in every respect; "Non classificato" covers both expenses on the fallback category "Da categorizzare" and those on an unknown category; "Avanzo" (income − all outflows, "Te futuro" included) is the former "Risparmio" ("Savings"), renamed so as not to be ambiguous now that actual savings are already counted inside "Te futuro"
- "Risparmio accumulato" ("Accumulated savings"), last 12 months (chart + total)

**What you can do**: nothing, it is a pure analysis dashboard.

**What the mockup does NOT implement — decision for the real product**:
- **No way to add/edit an income source** from this screen. **Decision: not here, but somewhere yes.** Cash flow stays a derived, read-only dashboard; entering income (salary, freelance, dividends) must however concretely exist, most likely as transactions of type "income" entered in the same flow as "Spese" (to be conceptually generalized to "Transazioni" with positive/negative sign), not in a separate form here. The gap in the mockup was not a design choice: the entry point had simply never been shown.
- **No period selector** (unlike Panoramica/Spese/Investimenti). **Decision: implement** — it is an inconsistency of the mockup compared to the other screens with time-based data, not an intentional design; a period selector (e.g. 3M/6M/12M/24M) must be added for consistency with the rest of the app.

---

## 5. Investimenti (Investments)

**Purpose**: securities portfolio, buy/sell transactions, composition.

**What you see**:
- 3 KPIs: Valore portafoglio (Portfolio value, with daily change), Guadagno totale (Total gain), Investito (Invested)
- Securities table (Strumento, Quote, Prezzo €, Valore, P&L — Instrument, Shares, Price €, Value, P&L) for VWCE, SWDA, AAPL, AGGH — **Quote and Prezzo are editable text fields**, with a ✕ button to remove the row
- "Add security" row: Ticker, Nome (Name), Quote (Shares), Prezzo (Price), **"+ Aggiungi"** button
- "Registra una transazione" ("Record a transaction") block: Acquisto/Vendita (Buy/Sell) toggle, Strumento select, Quote (accepts fractional values e.g. 4,4), Prezzo €, Data, calculated "Totale", **"+ Registra"** ("+ Record") button
- "Transazioni recenti" ("Recent transactions") list with ✕ to remove
- 3 composition blocks, all read-only: Tipologia di asset (Asset type: equity ETFs/single stocks/bonds), Geografia (Geography, estimated from ETF composition), Settore (Sector, estimated from ETF composition)

**What you can do (verified working)**:
- **Edit Quote or Prezzo** of an existing security: **recalculates in real time** the row Valore, Valore portafoglio, Guadagno totale and the "Tipologia di asset" breakdown (percentages included).
- **Remove a security** (✕) or a recent transaction (✕).

**What the mockup does NOT implement — decision for the real product**:
- **"+ Aggiungi" (new security) is a stub**: no row is added to the table. **Decision: implement end-to-end**, analogous to "+ Aggiungi conto", which instead already works in the mockup.
- **"+ Registra" (new transaction) is a stub**: the "Totale" stays at "—" and it never appears in "Transazioni recenti". **Decision: implement end-to-end** — it must create the row in "Transazioni recenti" and update the shares/value of the corresponding security.
- **The Acquisto/Vendita toggle has no observable effect**. **Decision: implement** — a "Vendita" (sell) must reduce the shares held (with a check that one does not sell more shares than held), not just record a disguised purchase.
- **"Geografia" and "Settore" do not update** when the Quote/Prezzo of securities are changed, unlike "Tipologia di asset", which does react. **Decision: fix** — they must update the same way: two "live" blocks and one static one, for no apparent reason, would confuse the user.
- **Ticker and Nome not editable** on an existing security (only Quote and Prezzo are). **Decision: implement only in part** — the Ticker stays non-editable after creation (it uniquely identifies the listed instrument; changing it would make no financial sense), but the Nome can be edited, to correct a mistyped label.
- **No real sync with market prices**, even though the header says "sincronizzato" ("synced"). **Decision: implement, but as a later phase** — it requires an integration with an external price provider, out of scope for the current design system; in the meantime the header should not promise a sync that does not exist, and "Prezzo €" remains manually editable as a fallback even after the integration.

---

## 6. Pensione (Pension)

**Purpose**: supplementary pension fund, with a projection simulator.

**What you see**:
- 3 KPIs: Valore attuale (Current value, editable), Versato finora (Contributed so far, editable), Rendimento maturato (Accrued return, calculated, read-only)
- "Parametri" ("Parameters") block with 3 sliders: Versamento mensile (Monthly contribution, €), Rendimento reale (Real return, %/year), Età di pensionamento (Retirement age, years)
- "Proiezione a N anni" ("Projection over N years"): estimated final figure + chart + time range
- "Da dove arriva il valore" ("Where the value comes from"): Versato vs Rendimento (breakdown of the current value into contributions vs return)

**What you can do (verified working)**:
- **Edit "Valore attuale" and "Versato finora"** manually (text field) — reflects the idea that these figures are updated by hand "dall'ultimo estratto conto del fondo" ("from the fund's latest statement"; there is no automatic integration).
- **Fully working what-if simulator**: moving any of the 3 sliders (monthly contribution, expected return, retirement age) **instantly recalculates the final projection** (verified: age 67→64 takes the projection from ≈€431,000 to ≈€379,000).

**What the mockup does NOT implement — decision for the real product**:
- **Only one pension fund can be managed** (no "+ Aggiungi fondo", "Add fund"). **Decision: implement multi-fund support** — having several forms of supplementary pension (e.g. fondo negoziale, the collective-agreement fund, + PIP, individual pension plan) is common, and the screen must be able to manage more than one.
- **No contribution history** (only a cumulative "Versato finora" total). **Decision: implement** a list of contributions over time, consistent with the history already present in Spese/Investimenti — useful to see the trend of contributions.
- **Deterministic projection, not a probabilistic/Monte Carlo model**. **Decision: do not implement** a probabilistic simulation at this stage — it would add statistical complexity that the product's target ("senza gergo finanziario", "without financial jargon", from `product-vision.md`) does not require; the deterministic projection is kept, with the explicit label already present in the mockup ("una stima, non una promessa", "an estimate, not a promise").

---

## 7. Debiti (Debts)

**Purpose**: mortgage and loans, with a repayment plan and an early repayment simulator.

**What you see**:
- 3 KPIs: Debito totale (Total debt), Rata mensile (Monthly installment, with % of income), Interessi ancora da pagare (Interest still to pay)
- One card per debt (in the mockup: Mutuo prima casa (First home mortgage), Prestito auto (Car loan)), each with:
  - Editable name, institution/rate type, ✕ button
  - Residuo (Outstanding), TAEG (APR), Rata mensile — all **editable**
  - "Extra sulla rata" ("Extra on the installment") slider (voluntary monthly overpayment)
  - Outcome: "Estinto nel [anno]" ("Paid off in [year]", with the time saved versus the plan), "Interessi risparmiati" ("Interest saved")
  - Plan chart "Con extra" ("With extra") vs "Piano attuale" ("Current plan")
- "Aggiungi un debito" ("Add a debt") block: Nome, Residuo €, TAEG %, Rata €/mese, **"+ Aggiungi"** button
- "Prossime rate" ("Upcoming installments") table (5 months: month, interest, principal, outstanding) for a specific debt
- "Il quadro completo" ("The full picture"): Attività finanziarie (Financial assets), **Immobile (stima)** (Property, estimate), Debiti, Patrimonio reale (Real net worth)

**What you can do (verified working)**:
- **Early repayment simulator per debt, fully working**: moving a debt's "Extra sulla rata" slider **immediately recalculates "Estinto nel" and "Interessi risparmiati"** (verified on the Prestito auto: +€250/month → paid off 1 year and 5 months early, € 286 of interest saved).
- Edit Nome, Residuo, TAEG, Rata mensile of an existing debt (text fields — not verified whether they cascade-recalculate the amortization schedule).
- Remove a debt (✕).

**What the mockup does NOT implement — decision for the real product**:
- **"+ Aggiungi debito" is a stub**. **Decision: implement end-to-end**, as for Conti/Investimenti/Spese.
- **"Immobile (stima): € 265.000" is not editable and is not managed in any other screen** (neither in Conti nor in Panoramica, where "Patrimonio netto" seems to exclude it). **Decision: implement as a product entity** — an explicit concept of "non-liquid asset" (property) is needed, which the user can enter/edit. On the conflict observed in the mockup (net worth with and without the property), the real product must show **both figures, explicitly labeled** (e.g. "Patrimonio netto liquido" ("Liquid net worth") vs "Patrimonio netto incluso immobile" ("Net worth including property")), not just one of the two as the mockup does today. Where exactly the property value is entered (its own section vs inside Conti) remains to be defined during data modeling.
- **The "Prossime rate" table shows only one debt**, with no visible selection control. **Decision: implement** a selector (or tabs) to see the installment plan of each debt, not just the first.
- **No confirmation before deleting a debt**. **Decision: implement**, same reason as Conti.

---

## 8. Pianifica (Plan)

**Purpose**: the most advanced feature of the mockup — a "what-if" simulator of life scenarios that projects the impact on net worth over the long term. It conceptually replaces "Budget"/"Risparmi" ("Savings") of the old vision with something broader.

**What you see**:
- 3 scenarios that can be **turned off/on individually**: "Cambio lavoro" ("Job change", +€450/month net from 2027), "Acquisto casa" ("Buying a home", −€15,000 immediately, +€200/month from 2028), "Un figlio" ("A child", +€600/month of expenses from 2028)
- Global parameters: Orizzonte (Horizon, years), Rendimento atteso (Expected return, %/year), Risparmio mensile base (Base monthly savings, €) — all sliders
- "Proiezione del patrimonio" ("Net worth projection") chart: comparison "Con scenari" ("With scenarios") vs "Ritmo attuale" ("Current pace") up to the target year
- Numeric summary: final value with scenarios (+difference vs current pace) and final value at the current pace

**What you can do (verified working, the most solid section of the mockup)**:
- **Turn each scenario on/off** by clicking it: when turned on its specific sliders appear (e.g. for "Acquisto casa": Costi iniziali (Upfront costs), Effetto mensile dopo (Monthly effect afterwards), Anno di acquisto (Purchase year)) and **the final projection changes immediately** (verified: turning on "Acquisto casa" takes the 2046 projection from € 853,259 to € 885,598).
- **Each scenario has independent parameters** adjustable via sliders once turned on.
- **Change the global parameters** (horizon, expected return, base monthly savings): they affect the projection in the same way.
- Scenarios can be combined (more than one active at the same time).

**What the mockup does NOT implement — decision for the real product**:
- **Only 3 predefined, fixed scenarios**; it is not possible to create a custom one. **Decision: implement custom scenarios** — the mockup's 3 scenarios should be treated as starting templates, but the user must be able to create their own (free name, one-off effect, monthly effect, start year): a truly useful what-if simulator cannot be limited to 3 fixed cases.
- **No saving of configured scenarios** (they are lost on refresh; there is no way to "save a scenario" with a name). **Decision: implement persistence and comparison** — being able to save a scenario with a name and compare it over time is part of the core value of this screen; without saving, the simulator stays "throwaway" in every session.
- **No explicit link between the scenarios and the real data of the other screens** (e.g. turning on "Un figlio" does not automatically create an expense category in Spese). **Decision: keep decoupled, do not link automatically** — a scenario activation that silently changes data in another screen would be a surprising side effect that is hard to undo; scenarios remain hypothetical, read-only projections, separate from the real data.
- **No confidence interval or probabilistic simulation** (projection explicitly deterministic, "una stima, non una promessa"). **Decision: do not implement**, same reason as Pensione — statistical complexity not required by the product's target.

---

## 9. Analitiche (Analytics)

**Purpose**: advanced insights that a traditional budgeting app usually does not provide. Entirely **read-only**, no input anywhere on the page.

**What you see** (7 blocks, all calculated passively from the data of the other sections):
1. **Da dove arriva la tua crescita** ("Where your growth comes from"): share of net worth growth attributable to personal savings vs market return (proportional bar + values)
2. **Autonomia finanziaria** ("Financial autonomy"): months of survival on current cash alone relative to average spending, with a progress bar towards a goal (24 months)
3. **Tasso di risparmio reale** ("Real savings rate"): percentage, with an explicit note that transfers between one's own accounts do not count as savings
4. **Indipendenza finanziaria (FIRE)** ("Financial independence"): net worth needed according to the "4% rule" and estimated year/age of reaching it at the current pace
5. **Rendimento reale** ("Real return"): nominal − inflation = real, to understand actual purchasing power
6. **Inflazione del tuo stile di vita** ("Your lifestyle inflation"): year-on-year growth of personal average spending, compared with official inflation
7. **Radar abbonamenti** ("Subscription radar"): list of detected recurring subscriptions (Palestra (Gym), Netflix, Spotify, iCloud) with monthly/yearly cost and yearly total

**What you can do**: nothing, it is pure consultation.

**What the mockup does NOT implement — decision for the real product**:
- **The "Autonomia finanziaria" goal (24 months) and the FIRE rule rate (4%) are fixed**, unlike the parametric sliders of Pensione/Debiti/Pianifica. **Decision: make them parametric** — it is an inconsistency of the mockup with no domain rationale: the user must be able to set their own target months of autonomy and, for those who want it, the FIRE withdrawal rate.
- **"Radar abbonamenti" is a closed, static list**, with no demonstrated link to the "Abbonamenti" ("Subscriptions") category of Spese. **Decision: implement as derived detection** — it must be calculated automatically from recurring transactions categorized as subscriptions in Spese (same source data, not a parallel dataset), with the possibility for the user to correct false positives/negatives (remove a "subscription" detected by mistake, or flag a missed one).
- **No selectable period** (everything fixed at 12 months/current month). **Decision: implement a historical comparison** (at least 12/24 months) — necessary because items like "Inflazione del tuo stile di vita anno su anno" by definition require a multi-period comparison, not just the last fixed year.

---

## Summary table: working vs stub (in the mockup)

| Element | Screen | Behavior in the mockup |
|---|---|---|
| Period selector 1M/3M/1A/Max | Panoramica | Working (label) |
| "Vedi tutti" transactions | Panoramica | **Stub**, no effect |
| "+ Aggiungi conto" | Conti | **Working**, recalculates totals |
| Edit manual account name/balance | Conti | Working, live |
| "✕" remove account | Conti | Working (also on "Auto" accounts) |
| Period selector Settimana/Mese/3 mesi/Anno | Spese | Partially working: changes only the 3 KPIs at the top |
| "Dividi" transaction | Spese | Working, live, also on Auto transactions |
| Edit manual transaction description/amount | Spese | Working |
| "✕" delete manual transaction | Spese | Working |
| "+ Aggiungi" transaction form | Spese | **Stub**, no effect |
| Edit security Quote/Prezzo | Investimenti | Working, live, recalculates portfolio and "Tipologia di asset" |
| "✕" remove security/transaction | Investimenti | Working |
| "+ Aggiungi" new security | Investimenti | **Stub** |
| "+ Registra" security transaction | Investimenti | **Stub** |
| Edit Valore attuale/Versato | Pensione | Working |
| Pension projection sliders | Pensione | Working, live |
| Edit debt Residuo/TAEG/Rata | Debiti | Working (editable field) |
| "Extra sulla rata" slider | Debiti | Working, live |
| "✕" remove debt | Debiti | Working |
| "+ Aggiungi" new debt | Debiti | **Stub** |
| Scenario activation + sliders | Pianifica | Working, live |
| Light/dark theme toggle | Global (sidebar) | Working |
| Entire Cash flow page | Cash flow | Read-only |
| Entire Analitiche page | Analitiche | Read-only |

**Pattern observed in the mockup**: every button whose text starts with **"+ Aggiungi"/"+ Registra" to create a new row in a list** is a non-working stub, **except** "+ Aggiungi conto" in Conti, which is the only one actually wired up. Editing/removing **existing** rows, on the other hand, works almost everywhere. **Decision: all the stubs in this table must be implemented end-to-end in the real product** (detailed per screen in the sections above) — it is the most concrete signal of where to focus effort when moving from the mockup to a real implementation with persistence.

---

## Cross-cutting limitations of the mockup (valid for all screens) — decision for the real product

- **No persistence** (all state lives in the JS memory of the single page session). **Decision: obviously to be implemented** — it is the whole difference between a mockup and a product: it requires a backend + database, it is not an open question.
- **No backend/API**. **Decision: obviously to be implemented**, same reason.
- **No authentication** (user "Marco Rossi / Piano personale" hardcoded, no login/logout). **Decision: authentication must be implemented** (even minimal, to protect personal financial data). **Multi-user/multi-plan remains a genuine open question**: `product-vision.md` does not specify whether family/multi-plan management is needed, even though the "Piano personale" label suggests others might exist — to be clarified with the user before designing that data model.
- **No input validation** on numeric fields (balances, shares, amounts, TAEG). **Decision: implement** validation on all numeric/date fields in every screen — standard, not domain-specific.
- **No confirmation for destructive actions** (every "✕" deletes immediately). **Decision: implement** confirmation on every destructive action, everywhere in the app.
- **No handling of errors/loading states/empty states**. **Decision: implement** — with a real backend these states necessarily exist (slow network, failed requests, new user without data) and must be designed for each screen when moving from demo data to real data.
- **Fixed currency (EUR) and fixed language (Italian)**, no selector. **Decision: reversed (2026-07-03)** — the real product must support multiple languages and currencies, not only Italian/EUR as in the mockup. Language and currency are per-user settings chosen during **onboarding** (not a global selector always visible in the UI), with Italian/EUR as a sensible default but not the only option. Still to be decided later: which languages/currencies to support at launch, the i18n library to adopt, and how/where numbers and dates are formatted based on the chosen currency/language.
- **No responsiveness tested beyond desktop** in the original mockup. **Partially already solved**: the responsive sidebar has been implemented (see the decision log in `CLAUDE.md`, entry 2026-07-03). **Decision: to be completed** for the rest of the interface (multi-column tables, forms) as the real screens are built.
- **Recalculation inconsistencies between screens** (calculation engines not unified — e.g. "Dividi" in Spese does not propagate to the "Spese del mese" figure shown in Panoramica; "Patrimonio netto" in Panoramica/Conti excludes the property, which instead appears in Debiti → "Patrimonio reale"). **Decision: unify** — a single shared calculation engine for every derived figure (actual spending, net worth, etc.), read by all the screens that show it, instead of parallel datasets as in the mockup.
- **The concept of "Immobile/real estate property" introduced but not managed** (it appears only as a static row in Debiti → "Il quadro completo"). **Decision**: see the dedicated item in the Debiti section above — it requires a dedicated entity and an explicit choice about how it enters the net worth shown to the user.

## Implications for the real data model

The decisions above require the real data model to include, beyond the entities already foreseen in `product-vision.md` (accounts, transactions, categories, budgets, goals):
- An explicit notion of **data source per row** (manual vs linked/auto), not only for accounts but also for transactions and securities, with different editability rules for the two sources (linked ones are read-only except for "unlink"; manual ones are fully editable).
- A concept of **"share excluded from the count"** per transaction (the "Dividi" mechanism), distinct from the transaction's nominal amount, which propagates to **all** derived calculations (not only to the local mini-summary as in the mockup).
- A **security/portfolio position** entity with shares and price, independent from the individual buy/sell transactions that generate it, with sells decreasing the shares held.
- A **debt** entity with a computable amortization schedule (not just amount and installment, but an engine able to recalculate early repayment), individually selectable for the installment table.
- A **non-liquid asset (property)** entity, manageable by the user, with an explicit choice of how it enters the net worth figures shown (show both variants, with/without property).
- A reusable, shared **scenario/projection** engine (used in Pensione, Debiti and Pianifica with similar logic that is not shared in the mockup), with support for custom scenarios that can be saved with a name (for Pianifica).
- A concept of **recurring subscription detected automatically** from categorized transactions, not a separate static list (for Analitiche → Radar abbonamenti).
