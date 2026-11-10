# API gaps: data and logic the web app gets outside `app/api`

Source: the web repo `buddy-budget` (Next.js 16 App Router), every `page.tsx` / `layout.tsx` under `app/(app)`, `app/(auth)`, `app/disiscrizione` and `app/layout.tsx`, plus `proxy.ts`, `lib/queries/*`, `lib/localization/*`, `lib/legal/*`, `lib/whats-new/*`, `lib/app-version/*`.

> **Implementation status (2026-10-18)** — on branch `feat/mobile-api-foundations` of `buddy-budget`, not merged yet: **G1** (`GET /api/legal`),
> **G2** (`GET /api/overview`), **G3** (`GET /api/liquidity/month`), **G4** (paged `GET /api/transactions`), **G5**
> (`GET /api/accounts?include=trend,health`), **G6** (`GET /api/liquidity/analysis`), **G7/G7b** (`GET /api/investments/view`,
> `GET /api/investments/performance`), **G8** (`GET /api/investments/{income,taxes}`, `POST /api/investments/taxes/simulate-sale`),
> **G9** (`GET /api/analytics/base`), **G10** (`GET /api/pension/view`), **G11** (localized category names), **G12**
> (`GET /api/debts?include=insights`), **G13** (`GET /api/meta` + `GET /api/me/bootstrap` capabilities), **G14**
> (`GET /api/whats-new`), **G15b** (stable error `code`s) and **§5 DE planning results** (`GET /api/financial-planning?include=results`,
> `POST /api/financial-planning/results`). Each view runs the web's own TypeScript functions on the server (ADR 0002);
> contracts in `endpoints/*.md` (new: `investments-views.md`, `meta.md`), captured responses in [`fixtures/`](./fixtures/).
> Still open: G15a (string tables), G16, CSV/pension import parsing, the per-loan debt simulator endpoint (ported
> instead), the DE sale simulator (hidden by its switch), a minimum client version, and the non-data P0 Google/Apple
> sign-in. The bank-consent return without cookies (auth.md **R6**) is implemented on the same branch: `client: "native"`,
> public `/api/gocardless/callback/native` → `buddybudget://bank/return?ref&status`, bearer
> `POST /api/gocardless/connections/{id}/complete` ([gocardless.md](./endpoints/gocardless.md#native-connection-flow-r6)).

## TL;DR

1. **The web app has almost no server-side data loading.** No file contains `"use server"` (no server actions). Only five server components read anything on the server, and they read only the **better-auth session**, the `bb-language` cookie, or a signed email token:
   - `app/layout.tsx` calls `getLocaleProfile()`: session `productCountry`/`language`, or the `bb-language` cookie when signed out.
   - `app/(app)/layout.tsx`: `session.user.hideAmounts` sets the initial privacy mask.
   - `app/(app)/page.tsx`: `session.user.homePage` drives the redirect to the chosen home page.
   - `app/(auth)/account-disattivato/page.tsx`: `session.user.deletionScheduledAt`.
   - `app/(app)/country-unavailable/page.tsx`: the server translator only, with static text.
   - `app/disiscrizione/page.tsx`: `verifyUnsubscribeToken(t)`, a public web-only page.

   Every other screen is a client component that gets its data through TanStack Query hooks in `lib/queries/*`, and those hooks call `app/api/*`. **Every raw dataset a screen needs can already be fetched through `app/api`.**
2. **The real gap is computation, not data.** By design the API returns *raw* data (comment in `app/api/investments/overview/route.ts`: "I calcoli … si fanno lato client"). Large pure-TypeScript engines run in the browser and turn that data into what screens show:
   - `lib/calc/*`: about 10k lines in total, including expenses, month-pace, net-worth, investments, returns, risk, taxes, pension, monte-carlo and debt-simulator.
   - `lib/investments/view.ts`, `tax-view.ts`, `income-view.ts`.
   - `lib/analitiche/*`.
   - `lib/pension/pension-context.tsx`.

   For mobile, each of these is either a **port** (into `domain/` with golden vectors) or a **new server endpoint** that wraps the same pure functions. The P0/P1 items below are mostly this kind of gap.
3. **Some app-wide facts live only in the JS bundle.** None of these is reachable through any API:
   - `LEGAL_VERSION`, which blocks the legal gate.
   - The country capability matrix.
   - The translation catalogs.
   - The "what's new" entries.
   - The onboarding category proposal.
   - The supported currencies.
   - Several per-device preferences kept in `localStorage`.

---

## 1. Summary table

"Reachable" means every value the screen *shows* can be got from `app/api` without porting client-side logic.
- **yes**: the raw API response is what the screen renders, apart from trivial formatting.
- **partial**: the raw inputs are reachable, but the screen shows derived values computed in the browser, or needs bundle-only constants.
- **no**: the data is not served by any API.

| Screen (web route) | Mobile feature | Data needed | Source today | Reachable via API? | Proposed endpoint |
|---|---|---|---|---|---|
| `app/layout.tsx` (root) | App bootstrap / locale | language, productCountry; signed-out language | RSC `getLocaleProfile()` (session, else `bb-language` cookie) | partial: session fields via `GET /api/auth/get-session`; signed-out language is device-local | none (device locale); see §4 |
| `app/(app)/layout.tsx` + `attention-shell.tsx` + `sidebar-insights-slot.tsx` | App shell: tab bar, badges, privacy mask, sync indicator, import island, demo banner | `hideAmounts`; uncategorized count; sidebar summary/deadlines/FIRE; sync jobs; personal-import jobs; start/demo status | RSC session (`hideAmounts`) + client hooks: `/api/transactions/attention`, `/api/sidebar/{summary,deadlines,fire}`, `/api/sync-jobs`, `/api/personal-imports`, `/api/start` | yes. Module visibility is per-device `localStorage` (`bb:sidebar:module:*`, `bb:mobile:bottom-nav`). The version label is bundle-only (`NEXT_PUBLIC_APP_VERSION`), and `/api/health` exposes the server build | none (local settings) |
| `/` `app/(app)/page.tsx` | Start tab selection | `user.homePage` | RSC session + `resolveHomePage()` (legacy path mapping) | yes (`get-session` / `GET /api/user/settings`). The legacy-path mapping must be ported | none |
| `/panoramica` | Overview | net-worth series by class and change, today's value by class, composition, month pace, next dues, investments pulse, pension value, goals tile, start checklist, renewal alerts, voice sentence, what's new | 10 client queries (`/api/accounts`, `/api/net-worth/snapshots?compact=1`, `/api/transactions` (4 months), `/api/budgets`, `/api/investments/overview?period=1mese`, `/api/debts`, `/api/pension`, `/api/gocardless/connections`, `/api/start`, `/api/goals`) + client calc (`buildNetWorthSeries`, `buildInvestmentsView`, `computeMonthPace`, `pensionTotalOn`, `buildCompositionItems`, `buildRenewalAlerts`, `lib/overview/voice.ts`) + static `WHATS_NEW_ENTRIES` | **partial** → ✅ G2 implemented | `GET /api/overview` (G2, ✅ [overview.md](./endpoints/overview.md)); `GET /api/whats-new` (G14) |
| `/liquidita` (Movements) | Movements | transaction feed (filter/search/direction/to-fix), month spent/income, pace vs typical, group totals, uncategorized count | `/api/transactions?from=<Jan 1 last year>&to=<Dec 31 this year>&type=tutte` (two full years, unpaginated) + `/api/categories`, `/api/categories/usage`, `/api/accounts`, `/api/budgets`, `/api/transactions/attention`; filtering and aggregates on the client (`lib/calc/expenses.ts`, `month-pace.ts`) | **partial** → ✅ G3, G4 implemented | `GET /api/liquidity/month` (G3, ✅ [liquidity.md](./endpoints/liquidity.md)); paging/search on `GET /api/transactions` (G4, ✅) |
| `/liquidita/conti` | Accounts | accounts, bank connection health, sync state, 30-day balance sparkline, renewal alerts, bank grouping | `/api/accounts`, `/api/gocardless/connections`, `/api/sync-jobs`, `/api/transactions` (30 days) + client calc (`buildAccountBalanceSeries`, `computeConnectionHealth`, `needsRenewal`, `buildRenewalAlerts`, `groupAccounts`) | ✅ (G5 implemented) | `GET /api/accounts?include=trend,health` (G5, ✅) |
| `/liquidita/analisi` | Spending analysis | period spend vs previous, cumulative curve vs typical, spend by group/category, income sources, accumulated savings, sentence | `/api/transactions` (two years), `/api/categories`, `/api/budgets` + client calc (`computeSummary`, `buildCumulativeSpend`, `computeMonthPace`, `computeCategoryBreakdown`, `computeIncomeSources`, `computeAccumulatedSavings`) | **partial** → ✅ G6 implemented | `GET /api/liquidity/analysis` (G6, ✅ [liquidity.md](./endpoints/liquidity.md#get-apiliquidityanalysis)) |
| `/liquidita/categorie` | Categories | categories (localized names) | `/api/categories` + **client-side** `localizeCategory()` | ✅ (G11 implemented) | localized in `GET /api/categories` (G11, ✅) |
| `/liquidita/regole` | Rules | rules, categories | `/api/categorization-rules`, `/api/categories` | yes (apart from category localization, G11) | none |
| `/liquidita/abbonamenti` | Subscriptions | subscriptions view | `/api/subscriptions` (computed on the server by `loadSubscriptions`) | yes | none |
| `/categorizza` | Categorize | suggestion groups, auto-categorized, AI state, usage, currency | `/api/transactions/categorize-suggestions`, `/auto-categorized`, `/api/user/ai-categorization`, `/api/categories`, `/api/categories/usage`, session currency | yes. The swipe-tour "seen" flag is `localStorage` | none |
| `/importazioni` | Personal CSV/Excel import | jobs, formats | `/api/personal-imports` (+ `[id]`) | yes. The island-dismiss flag is `localStorage` | none |
| `/conti/collega/[connectionId]` | Bank link: pick accounts | external accounts, existing auto accounts | `/api/gocardless/connections/[id]/accounts`, `/finalize` | yes. On the web the entry is a redirect from `/api/gocardless/callback` (see §4); native apps get the same lists from `POST …/complete` (R6, ✅) | none |
| `/debiti` | Debts overview | debts + server plan, overview (total, nextDue, debtFreeDate), yearly interest shares | `/api/debts` (server `buildDebtsView`) + client `yearlyInterestShares()` | ✅ (G12 implemented) | `GET /api/debts?include=insights` (G12, ✅ [debts.md](./endpoints/debts.md)) |
| `/debiti/finanziamenti?id=` | Debt detail + "E se…" simulator | debt, plan, events; what-if scenarios | `/api/debts` + client `lib/calc/debt-simulator.ts`, `early-repayment.ts` | partial (the simulator runs on the client) | port, or `POST /api/debts/{id}/simulate` (G12) |
| `/debiti/simulatore` | none | none | redirect → `/debiti/finanziamenti` | n/a | none |
| `/investimenti` (Portfolio) | Portfolio | summary, positions, chart series, period gain, cost impact, dividends summary, broker cash, backfill status, watched titles | `/api/investments/overview?period=…` (raw transactions, instruments, prices, fx, profiles…) + `buildInvestmentsView()` on the client + `/api/instruments/backfill`, `/api/investments/titles` | **partial** → ✅ G7 implemented | `GET /api/investments/view` (G7, ✅ [investments-views.md](./endpoints/investments-views.md)) |
| `/investimenti/performance` | Performance | TWR/MWR/real returns, benchmark, risk, daily heatmap, as-of inspection | `/api/investments/overview?period=max` + client `computePortfolioReturns`, risk calc | **partial** → ✅ G7b implemented | `GET /api/investments/performance` (G7b, ✅) |
| `/investimenti/diversificazione` | Diversification | composition by type/currency, exposure (sector/area), overlap, allocation vs targets | overview + client `buildInvestmentsAnalysis`, `computeCurrencyExposure` | ✅ | `GET /api/investments/view` `analysis` block (G7, ✅) |
| `/investimenti/operazioni` | Operations list | operations grouped by month with per-operation result | overview + client `computeOperationInsights`/`groupOperationsByMonth` | ✅ | `operationMonths`, `operationYears`, `operationTotals` in G7 (✅) |
| `/investimenti/proventi` (IT) | Dividends | income history, missing income, 12-month forecast, by month/instrument | overview + client `buildIncomeView()` | **partial** → ✅ G8 implemented | `GET /api/investments/income` (G8, ✅) |
| `/investimenti/proventi` (DE) | Planning: income | planning section | `/api/financial-planning` (stores only the input document `{ plan, revision }`; results are computed on the client by `lib/financial-planning/*`) | ✅ | `GET /api/financial-planning?include=results` (§5, ✅ [financial-planning.md](./endpoints/financial-planning.md)) |
| `/investimenti/tasse` (IT) | Taxes | yearly tax report, stamp duty, loss carryforwards, sale simulator, opportunities, rates | `overview?period=max` + `/api/investments/tax-carryforwards` + client `buildTaxView()` (`lib/calc/taxes.ts`) | **partial** → ✅ G8 implemented | `GET /api/investments/taxes` + `POST /api/investments/taxes/simulate-sale` (G8, ✅) |
| `/investimenti/tasse` (DE) | Planning: tax | none | `/api/financial-planning` (results on the client, `lib/financial-planning/*`) | ✅ | `?include=results` / `POST /api/financial-planning/results` (§5, ✅) |
| `/investimenti/titoli/[id]` | Title detail | instrument, stats, series, position, alerts, fundamentals, commentary | `/api/instruments/[id]/analysis?period=` (server) + alerts/watch/commentary/quotation routes | yes | none |
| `/investimenti/titoli`, `/rendiconti`, `/rendiconti/importazioni` | none | none | redirects | n/a | none |
| `/investimenti` layout | Section header, broker filter, register/import dialogs | overview (instruments, used instruments), statements | `/api/investments/overview`, `/api/investments/statements`, import routes. The broker filter is view-only client state | yes | none |
| `/analitiche` (IT) | Analytics / FIRE | base (liquidity, cashflow, wealth, historical return), assumptions, plan (FIRE number, years, coast, liquidation tax), scenarios | `/api/analytics/assumptions` + accounts, transactions (the period's range), categories, investments overview (max), pension, debts, net-worth snapshots + client `lib/analitiche/*` (`buildAnalyticsBase`, `resolveExpectedReturn`, `resolvePlan`, monte-carlo) | **partial** → ✅ G9 implemented | `GET /api/analytics/base` (G9, ✅ [analytics.md](./endpoints/analytics.md)) |
| `/analitiche` (DE) | Planning: retirement | none | `/api/financial-planning` (not available for DE: `isPlanningAvailable(DE, retirement)=false`) | yes | none |
| `/analitiche/obiettivi`, `/[id]` | Goals | goals view (plan computed on the server), notification prefs | `/api/goals` (server `loadGoalsView`), `/api/user/notifications` | yes | none |
| `/analitiche/{costi,crescita,prelievi,rischio,simulazione}` | none | none | redirects to `/analitiche#…` | n/a | none |
| `/pensione` + tabs (IT) | Pension | funds, snapshots; performance, contributions, withdrawal scenarios, TFR comparison, quarterly contribution, projection, tax-rate simulation, yearly breakdown | `/api/pension` + client `lib/calc/pension.ts` (`computePensionPerformance`, `deriveContributions`, `withdrawalScenarios`, `companyTfrValue`, `projectPension`, `yearlyBreakdown`) + `use-rate-simulation` | **partial** → ✅ G10 implemented | `GET /api/pension/view?fundId=` (G10, ✅ [pension.md](./endpoints/pension.md)) |
| `/pensione` (DE) | none | none | `PlanningScreen section=pension` (not available for DE) | n/a | none |
| `/impostazioni` | Settings | profile/locale/currency/homePage/hideAmounts/legal, sessions, notifications, AI, data summary, export, reset, deactivate, delete; sidebar modules | `/api/user/*` routes; sidebar modules and "pension in net worth" are per-device `localStorage` | yes (local prefs → mobile local settings) | none |
| `/aiuto` | Help & report | `?da`, `?tipo` | `/api/support` | yes | none |
| `/country-unavailable` | Country gate screen | static localized text | RSC `getTranslator()` | n/a (static copy) | none |
| `/style-guide` | none (dev page) | none | static | n/a | none |
| `/login` | Login | magic link / Google; `?redirect`, `?account=eliminato` notice | better-auth client (`/api/auth/*`); proxy redirects already-authenticated users | yes for data. The **auth flow is web-redirect based** (see §4) | see §4 |
| `/onboarding` | Onboarding | currency list, locale pairs, category proposal (localized), AI availability, notification defaults, legal version → `POST /api/user/onboarding` | static bundle (`SUPPORTED_CURRENCIES`, `COUNTRY_LANGUAGES`, `localizedCategoryProposal`, `NOTIFICATION_DEFAULTS`, `LEGAL_VERSION`) + `/api/user/ai-categorization` | ✅ (G13 implemented) | `GET /api/meta` (G13, ✅ [meta.md](./endpoints/meta.md)) |
| `/accetta-termini` | Legal re-acceptance gate | `LEGAL_VERSION`, links to the documents, specific-clause sections, export link | static bundle (`lib/legal`) → `POST /api/user/legal-acceptance`; `/api/user/export` | **partial / no** (current version not exposed) | `GET /api/legal` (G1) |
| `/account-disattivato` | Deactivated account | `deletionScheduledAt` | RSC session → `/api/user/reactivate`, sign-out | yes (`get-session` has `deletionScheduledAt`) | none |
| `/disiscrizione?t=` | none (email web page) | token scope | RSC `verifyUnsubscribeToken` → `POST /api/email/unsubscribe` | not needed on mobile | none |
| `app/manifest.ts`, `robots.ts` | none | PWA manifest | static | n/a for native | none |
| What's-new card (Overview) | What's new | latest undismissed entry (≤45 days, country-filtered) | static `lib/whats-new/entries.ts` + `localStorage` `bb:whats-new-dismissed` | ✅ (G14 implemented) | `GET /api/whats-new` (G14, ✅ [meta.md](./endpoints/meta.md)) |
| Translations | All screens | it/en/de strings | static `lib/localization/catalogs/{en,de}.json` keyed by the Italian source string; `translate()` | **no** (bundle only, by design) | ship through the spec (G15) |
| Feature catalog (`lib/features/catalog.ts`) | none | none | used only by the landing page and tests; **not used by the app UI** | n/a | none |
| App version | About / support | version, commit, builtAt | bundle (`APP_BUILD_INFO`); the server build is in `GET /api/health` | yes (server; also `server` in `GET /api/meta`) | min client version still open (G13) |

---

## 2. Screens NOT reachable via `app/api` today

These screens cannot be rendered as on the web without either porting browser-side logic or adding endpoints. "Raw inputs reachable, derived values not" is listed explicitly.

- **Legal re-acceptance gate (`/accetta-termini`) and the onboarding confirmation step.** The current `LEGAL_VERSION` (`"2026-10-12"`, `lib/legal/version.ts`) is not exposed anywhere. Both `POST /api/user/legal-acceptance` and `POST /api/user/onboarding` require `version: z.literal(LEGAL_VERSION)`. A hard-coded mobile value breaks on the next bump: the user gets 403s everywhere, with no way to know the new value. **Not reachable.**
- **Overview (`/panoramica`).** The net-worth chart (today's value per class + history), composition, month pace, investments pulse and voice sentence are all computed in the browser. The investments value needs the full portfolio engine (`buildInvestmentsView`). Partial alternative: `GET /api/sidebar/summary` already returns the server-computed net-worth total, the 30-day change and the portfolio total/gain. **Derived values not reachable.**
- **Movements (`/liquidita`).** The feed is reachable but unpaginated: it downloads two calendar years and filters on the client. Month spent/income, "typical so far" pace and group totals are computed on the client. **Aggregates not reachable.**
- **Spending analysis (`/liquidita/analisi`).** Everything shown is computed on the client from two years of transactions. **Not reachable.**
- **Investments: Portfolio, Performance, Diversification, Operations (per-operation result), Dividends, Taxes (IT).** The API returns raw transactions, prices, FX, profiles, inflation and risk-free rates. Every number on these tabs (positions, value, P/L, TWR/MWR, risk, exposure, overlap, allocation, income forecast, tax report, stamp duty, sale simulator) is computed in the browser. **Not reachable.**
- **Analytics / FIRE (`/analitiche`, IT).** Only the assumptions are stored and served. Base, plan, expected return and scenarios are computed on the client from seven other endpoints. **Not reachable.** Goals are reachable: their plan is computed on the server.
- **Pension tabs (IT).** Only funds and snapshots are served. Performance, scenarios, TFR comparison, projection and tax-rate simulation are computed on the client. **Not reachable.**
- **What's new card.** Static bundle + localStorage. **Not reachable.**
- **Country capability matrix (which tabs and features exist for IT/DE).** `isCountryPathAvailable`, `countryFeatures` and `isPlanningAvailable` exist only in code. The API reveals it only reactively, through a 403 `country_feature_unavailable`. **Not reachable.**
- **Localized names of default categories.** `GET /api/categories` returns the stored (Italian) names. The web localizes them on the client with `localizeCategory()`. Only `PATCH /api/categories/[id]` localizes its response on the server. **Partially reachable.**
- **Onboarding constants:** the category proposal, supported currencies, allowed country/language pairs and notification defaults. **Not reachable** (bundle only). Onboarding still works without them: the `categories` payload is optional, and defaults are seeded when the user is created.
- **Smaller derived values:**
  - Account 30-day balance sparkline and bank-connection health.
  - Debt yearly-interest shares and the "E se…" simulator.

  **Raw data reachable, derived values not.**

---

## 3. Per-gap detail

Conventions:
- "Port" means moving the TS function into `domain/` with golden vectors, so both apps compute identically.
- "Endpoint" means a new route that calls the *same pure functions* on the server.
- All the `lib/calc/*`, `lib/investments/*-view.ts` and `lib/analitiche/*` engines are pure: they import no `server-only` code and take dates and data as arguments. So an endpoint is mostly loader + DTO work.
- Two cross-cutting caveats for every computed endpoint:
  - **"today"**: the web computes `startOfDay(new Date())` in the *browser's* timezone. Endpoints must take a `today=YYYY-MM-DD` query param, or document Europe/Rome.
  - **Maps**: views contain `Map`s (`instrumentsById`, `priceIndex`, `settingsById`, `resolved`, `taxSettings`), which must become arrays or records in JSON.
- Money below is `number` (computed in JS floats), unlike Drizzle `numeric` columns, which are strings.

### G1 — Legal metadata (current version, documents)
- **Computed / where:** `lib/legal/version.ts` (`LEGAL_VERSION = "2026-10-12"`, `SPECIFIC_CLAUSE_SECTIONS`, `needsLegalAcceptance`), `lib/legal/links.ts` (`LEGAL_LINKS` → `${NEXT_PUBLIC_LANDING_URL ?? "https://buddybudget.io"}/{privacy,termini,cookie}`, `PRIVACY_EMAIL = "privacy@buddybudget.io"`). The document text is **not** in the app: it is hosted on the landing site.
- **Inputs:** none.
- **Output shape:**
  ```ts
  interface LegalMeta {
    version: string;                     // "2026-10-12"
    specificClauseSections: string[];    // ["Responsabilità","Sospensione e chiusura","Modifiche ai termini","Legge applicabile, foro e contatti"] (Italian source; translate)
    documents: { id: "privacy" | "termini" | "cookie"; label: string; url: string }[];
    privacyEmail: string;
  }
  ```
- **Proposed endpoint:** `GET /api/legal`, **public** (it must work before login and while legal-gated). Add `/api/legal` to `PUBLIC_PATH_PREFIXES` in `proxy.ts`. 200 with the JSON above, `Cache-Control: public, max-age=3600`.
- **Also:** have the proxy's legal-gate 403 return `{ code: "legal_acceptance_required", version }` instead of an empty body (see §4).
- **Priority:** **P0**. The legal gate blocks every API call, and both onboarding and re-acceptance need the exact string.
- **Effort:** XS (constants only).

### G2 — Overview (Panoramica) computed view
**Status: ✅ implemented** (branch `feat/mobile-api-foundations` of `buddy-budget`, not merged yet) as `GET /api/overview?period&includePension&today` — contract and example in [endpoints/overview.md](./endpoints/overview.md), fixture [fixtures/overview.json](./fixtures/overview.json). Shape follows the proposal below plus `isEmpty`, `monthLabel`, `voice` (localized sentences) and `renewalAlerts[].message`; series points drop `label`. Goals, start checklist and what's new stay separate calls.

- **Computed / where:** `app/(app)/panoramica/page.tsx` calls:
  - `computeAccountsKpi` (components/domain/accounts)
  - `buildInvestmentsView(overview, "1mese", today)` + `computeValueBreakdown`
  - `pensionTotalOn(funds, today)` (`lib/net-worth/pension-history.ts`)
  - `buildNetWorthSeries(snapshots, todayByClass, period, today)`, `excludeClassFromSeries` and `computeNetWorthChange` (`lib/calc/net-worth.ts`)
  - `buildCompositionItems` (components/domain/net-worth)
  - `computeMonthPace(transactions of the last 3 months + current, budgets, today)` (`lib/calc/month-pace.ts`, `MONTH_PACE_LOOKBACK = 3`)
  - `buildRenewalAlerts` (components/domain/accounts)
  - the voice sentence (`lib/overview/voice.ts`, uses `translate`)

  Goals come from `/api/goals`, the checklist from `/api/start`, and dues from `/api/debts` `overview.nextDue`.
- **Inputs:** `period ∈ {"1mese","3mesi","1anno","max"}` (default `3mesi`), `includePension` (a per-device toggle on the web: `localStorage` key from `use-pension-in-net-worth`, default true), `today`.
- **Output shape (proposal):**
  ```ts
  interface OverviewView {
    currency: string;
    todayByClass: { liquidita: number; investimenti?: number; previdenza?: number; debiti?: number };
    series: { date: string; value: number; byClass: Record<string, number>; isEstimated: boolean }[]; // drop `label` (hard-coded it-IT format)
    change: { start: number; end: number; delta: number; deltaPct: number | null };
    composition: { key: string; label: string; value: number; excluded?: boolean; meta?: Record<string, number> }[];
    monthPace: { spentSoFar: number; typicalSoFar: number | null; income: number; budgetTotal: number | null; budgetSpent: number;
                 dayOfMonth: number; daysInMonth: number; current: number[]; typical: number[] | null };
    investments: { value: number; positions: number; paid: number; marketGain: number } | null;
    pension: { value: number; funds: number } | null;
    debts: { total: number; count: number; debtFreeDate: string | null; nextDue: DebtDue[] } | null;
    renewalAlerts: { accountId: string; institutionName: string; state: string; expiresAt: string | null }[];
  }
  ```
- **Proposed endpoint:** `GET /api/overview?period=3mesi&includePension=1&today=YYYY-MM-DD` → 200 `OverviewView`. Keep `/api/start`, `/api/goals` and `/api/gocardless/connections` as separate calls, because they are already independent cards.
- **MVP shortcut:** `GET /api/sidebar/summary` already gives `netWorth.total`, `netWorth.monthChange`, `netWorth.pension` and `portfolio.{totalValue,totalGain,totalGainPct,holdings}`, all computed on the server (`lib/sidebar/summary.ts`). That is enough for a hero number before G2 exists.
- **Priority:** **P0** (Overview is an MVP screen).
- **Effort:** M. The loaders exist (`loadInvestmentData`, `loadUserPension`, `loadUserDebts`, snapshot queries). The investments value runs the full portfolio engine on every call, so consider caching.

### G3 — Movements month summary
**Status: ✅ implemented** (branch `feat/mobile-api-foundations` of `buddy-budget`, not merged yet) as `GET /api/liquidity/month?accountId&today` — [endpoints/liquidity.md](./endpoints/liquidity.md), fixture [fixtures/liquidity-month.json](./fixtures/liquidity-month.json). Includes the per-category budget progress (`budgets[]`), budget totals, `accounts { total, count }`, `toFix` and the month sentence. No port of `expenses.ts`/`month-pace.ts` needed.

- **Computed / where:** `app/(app)/liquidita/page.tsx`:
  - `computeSummary(scoped, month).speseEffettive`
  - `computeIncomeSummary(...).entrateEffettive`
  - `computeMonthPace(scoped, budgets, today).typicalSoFar`
  - `computeGroupTotals(scoped, categories, "mese", today, today)`

  All are in `lib/calc/expenses.ts` and `lib/calc/month-pace.ts`. They are scoped by an optional `accountId`. "To fix" = `/api/transactions/attention` `uncategorizedCount` (already reachable).
- **Also:** `GET /api/budgets` returns only the configured amounts. Spent and progress per budget are computed on the client (`lib/calc/expenses.ts`, `month-pace.ts`), so include them here.
- **Inputs:** `accountId?`, `today`.
- **Output:**
  ```ts
  interface LiquidityMonth { currency: string; spent: number; income: number; typicalSoFar: number | null;
    groups: { key: string; label: string; amount: number; budget?: number | null }[]; toFix: number }
  ```
- **Proposed endpoint:** `GET /api/liquidity/month?accountId=&today=`.
- **Priority:** **P0** (Movements MVP). Alternatively port `expenses.ts` + `month-pace.ts` (~600 lines) to `domain/`. The feed needs the transaction list anyway, so porting is a reasonable choice here.
- **Effort:** S.

### G4 — Transaction feed paging / search
**Status: ✅ implemented** (branch `feat/mobile-api-foundations` of `buddy-budget`, not merged yet): `limit`/`cursor` (opaque, keyset on date desc + id desc) → `{ items, nextCursor }`, filters `from`, `to`, `type` (default `tutte` in paged mode), `accountId`, `categoryId`, `q` (description or note), `uncategorized=1`, decided by the web's `filterTransactions`/`filterByTransactionType`. The legacy array is unchanged without `limit`/`cursor`. See [endpoints/transactions.md](./endpoints/transactions.md#get-apitransactions). `merchantKey` (G16) still not added.

- **Today:** `GET /api/transactions?from&to&type` (`type ∈ uscita|entrata|tutte`) returns *all* rows in the window. The web asks for Jan 1 of last year → Dec 31 of this year (`liquidityFetchWindow`), then filters on the client by `categoryId`, `searchText`, `accountId`, direction and "to fix" (category is fallback).
- **Note:** `type` defaults to `"uscita"` when omitted (`app/api/transactions/route.ts`), so mobile must always pass `type=tutte` for a full feed.
- **Proposed:** add optional `limit` (≤200), `cursor` (opaque: date + id, ordered `date desc, id desc`), `accountId`, `categoryId`, `q`, `uncategorized=1` to `GET /api/transactions`. Response: `{ items: ListedTransaction[]; nextCursor: string | null }` when `limit` is present. Keep the legacy array when it is absent, for web compatibility.
- **Priority:** **P0** (performance and memory on mobile).
- **Effort:** S–M.

### G5 — Accounts: sparkline and connection health
**Status: ✅ implemented** (branch `feat/mobile-api-foundations` of `buddy-budget`, not merged yet) as `GET /api/accounts?include=trend,health&today` (per account: `bankName`, `trend` 31 points, `health`, localized `status`) — [endpoints/accounts.md](./endpoints/accounts.md#get-apiaccounts). Renewal alerts are also in `GET /api/overview`.

- **Computed / where:** `app/(app)/liquidita/conti/page.tsx`:
  - `buildAccountBalanceSeries(account, transactions, from, today)` (`lib/liquidity/account-series.ts`, 30 days back from the current balance)
  - `computeConnectionHealth(c, today)` + `needsRenewal` (`lib/gocardless/connection-health.ts`)
  - `buildRenewalAlerts`
  - `groupAccounts(list, bankByAccountId)`
  - `localizedAccountStatus(language).buildAccountStatus` (label/tone from source, needsReconnect, syncing, syncInfo)
- **Output (additions per account):** `trend?: number[]` (30 points, auto accounts only), `health?: { state: string; needsRenewal: boolean; expiresAt: string | null }`.
- **Proposed endpoint:** `GET /api/accounts?include=trend,health&today=`, or have `GET /api/gocardless/connections` include `health`.
- **Priority:** P1 (the core Accounts list is already reachable).
- **Effort:** S.

### G6 — Spending analysis
**Status: ✅ implemented** (branch `feat/mobile-api-foundations` of `buddy-budget`, not merged yet) as `GET /api/liquidity/analysis?period&ref&accountId&today` — [endpoints/liquidity.md](./endpoints/liquidity.md#get-apiliquidityanalysis), fixtures `liquidity-analysis*.json`. Adds `previousRange`, `delta`, `isCurrentMonth`, `hasBudgets`, per-category scaled `budget`, `saved` and the localized `sentence`; `savings[].month` is `YYYY-MM`.

- **Computed / where:** `app/(app)/liquidita/analisi/page.tsx`:
  - `getPeriodRange`, `getPreviousPeriodRange`, `computeSummary`, `computeCategoryBreakdown` (`lib/calc/expenses.ts`)
  - `buildCumulativeSpend` (`lib/liquidity/spend-curve.ts`)
  - `computeMonthPace().typical`
  - `computeIncomeSources`, `computeAccumulatedSavings` (`lib/calc/cashflow.ts`)
  - `getTrendRange` (`lib/calc/movements.ts`)
  - groups through `EXPENSE_GROUP_KEYS`/`GROUP_DISPLAY` (`lib/categories/groups.ts`)
- **Inputs:** `period` (the `useLiquidity` period, e.g. `mese`), `ref=YYYY-MM-DD`, `accountId?`, `today`.
- **Output:**
  ```ts
  interface LiquidityAnalysis { currency: string; range: { from: string; to: string };
    spent: number; spentBefore: number; curve: { date: string; value: number }[]; typical: number[] | null;
    groups: { key: string; label: string; amount: number; categories: { id: string; name: string; color: string; icon: string; amount: number }[] }[];
    incomeSources: { categoryId: string; name: string; amount: number; quotaPct: number | null }[];
    savings: { month: string; cumulative: number }[] }
  ```
- **Proposed endpoint:** `GET /api/liquidity/analysis?period=mese&ref=&accountId=&today=`.
- **Priority:** P1.
- **Effort:** S–M.

### G7 — Investments computed view (Portfolio, Diversification, Operations)
**Status: ✅ implemented** (branch `feat/mobile-api-foundations` of `buddy-budget`, not merged yet) as `GET /api/investments/view?period&from&to&excludeBrokers&today` — [endpoints/investments-views.md](./endpoints/investments-views.md), fixtures `investments-view*.json`. Adds the card derivations (breakdown, concentration + sentence, price notes, currency exposure, the four cost scenarios precomputed, exposure/correlation reading, operation totals, broker list). `priceIndex` and the per-day cost `additions` stay on the server.

- **Computed / where:** `buildInvestmentsView(data, period, today, chartRange?)` in `lib/investments/view.ts`, which uses:
  - `buildPriceIndex`, `computePortfolioSummary`, `buildPortfolioSeries`, `computeComposition` (`lib/calc/investments.ts`)
  - `computePortfolioReturns` (`lib/calc/returns.ts`)
  - `computePeriodGain`, `computeCostImpact`
  - `investmentTaxReport` (only when `countryFeatures(country).taxes`)
  - `buildInvestmentsAnalysis` (risk, exposure, overlap, allocation)
  - `computeOperationInsights`/`groupOperationsByMonth`, `computeIncomeHistory`

  The pages add `computeValueBreakdown`, `computeConcentration`, `computeCurrencyExposure` (`lib/investments/insights.ts`). Broker filtering is `filterInvestmentBrokers(data, disabledBrokerIds)` (`lib/investments/broker-filter.ts`), applied *before* the view.
- **Inputs:** `period ∈ 1mese|3mesi|1anno|max` (Portfolio uses `max` for `ytd`/`custom` plus `from`/`to`), `from?`, `to?`, `excludeBrokers?` (comma list), `today`.
- **Output:** `InvestmentsView` from `lib/investments/view.ts`, minus the `Map`s and `priceIndex`:
  ```ts
  { currency; summary: PortfolioSummary /* totalValue, dayChange, dayChangePct, unrealizedGain, realizedGain, income, totalGain, totalGainPct, investedNet, costBasis, unpricedCount, rows: PositionRow[] */;
    series: PortfolioSeriesPoint[]; byType: CompositionSlice[]; byCurrency: CompositionSlice[]; instruments: Instrument[];
    hasTransactions; operationMonths: OperationMonthGroup[]; usedInstrumentIds: string[]; returns: PortfolioReturns | null;
    benchmark: Instrument | null; benchmarkFirstPriceDate: string | null; periodGain: PeriodGain | null; costImpact: CostImpact;
    income: IncomeHistory; analysis: InvestmentsAnalysis; breakdown: ValueBreakdown; concentration: Concentration; brokerCash: … }
  ```
- **Proposed endpoint:** `GET /api/investments/view?period=3mesi&from=&to=&excludeBrokers=&today=`.
- **Priority:** **P1**. It is the biggest engine (~3k lines of calc), so the decision between porting and an endpoint matters most here. An endpoint is strongly recommended.
- **Effort:** M–L (DTO mapping of nested types, payload size, caching; `/api/investments/overview` already has `maxDuration = 60`).

### G7b — Investments performance
**Status: ✅ implemented** (branch `feat/mobile-api-foundations` of `buddy-budget`, not merged yet) as `GET /api/investments/performance?period&from&to&selFrom&selTo&excludeBrokers&today`. Instead of an `asOf` param, `inspect[]` carries the returns card's figures at every chart point (`computePortfolioReturns(asOf)`, sampled to 160 points on long series), so the chart only indexes into it; plus risk with its localized reading and all four heatmaps.

- **Computed / where:** `lib/queries/performance.ts` (`usePerformanceView`): `computePortfolioReturns({... asOf })` for pointer inspection, risk via `view.analysis.risk`, and the heatmap from `returns.daily` (`lib/calc/return-heatmap.ts`).
- **Proposed endpoint:** `GET /api/investments/performance?period=&from=&to=&asOf=&excludeBrokers=&today=` → `{ returns: PortfolioReturns | null; risk: …; benchmark; benchmarkFirstPriceDate; inspected?: PortfolioReturns }`.
- **Priority:** P1.
- **Effort:** S once G7 exists.

### G8 — Investments income (dividends) and taxes (IT only)
**Status: ✅ implemented** (branch `feat/mobile-api-foundations` of `buddy-budget`, not merged yet): `GET /api/investments/income`, `GET /api/investments/taxes`, `POST /api/investments/taxes/simulate-sale` (`{ instrumentId, quantity, price?, fxRate?, fees? }`, pure, 422 `position_not_sellable`), all country-gated (DE 403). Germany's Proventi/Tasse are the financial plan: see §5.

- **Computed / where:**
  - `buildIncomeView(data, today)` (`lib/investments/income-view.ts`): history, missing, forecast, byMonth, byInstrument, pendingDividendHistory.
  - `buildTaxView(data, today)` (`lib/investments/tax-view.ts`), using `lib/calc/taxes.ts` and `investmentTaxReport`: report years, bollo, opportunities, sellable positions, resolved tax settings, carryforwards.
  - The sale simulator runs on the client from `sellable` + `transactions` + `regime`.
- **Proposed endpoints:**
  - `GET /api/investments/income?excludeBrokers=&today=` → `IncomeView` (Maps → arrays).
  - `GET /api/investments/taxes?excludeBrokers=&today=` → `TaxView` (Maps → arrays).
  - `POST /api/investments/taxes/simulate-sale` `{ instrumentId, quantity, price?, date? }` → the simulated tax result.

  All three are IT only: they must sit under the country gate like `/api/investments/tax-carryforwards`.
- **Priority:** P2.
- **Effort:** M.

### G9 — Analytics / FIRE plan (IT)
**Status: ✅ implemented** (branch `feat/mobile-api-foundations` of `buddy-budget`, not merged yet) as `GET /api/analytics/base?today` (named after ADR 0002; same content as the proposed `/plan` plus `storedAssumptions`, growth split/journey and the saved plan's timeline). No `POST /api/analytics/scenario`: sliders and Monte Carlo are ported.

- **Computed / where:** `lib/analitiche/analytics-context.tsx`, which uses:
  - `analyticsTransactionsRange` (`lib/analitiche/period.ts`)
  - `buildAnalyticsBase({ today, currency, period, liquidity, transactions, categories, investments, pensionFunds, debtsTotal, snapshots })` (`base.ts`)
  - `resolveExpectedReturn` / `withExpectedReturn` (`historical-return.ts`)
  - `resolvePlan(base, assumptions)` (`plan.ts`)
  - scenario and simulation (`scenario.ts`, `simulation.ts`, `lib/calc/monte-carlo.ts`, `fire.ts`, `liquidation.ts`)
- **Output:**
  ```ts
  { base: AnalyticsBase; assumptions: AnalyticsAssumptions; returnInfo: ExpectedReturnInfo;
    plan: { spending; spendingSource; savings; savingsSource; wealth; liquidation; taxShare; fireNumberGross; target; progress; yearsToFire; coast: { years; number }[] };
    walkthroughSeen: boolean }
  ```
- **Proposed endpoint:** `GET /api/analytics/plan?today=`, behind the country gate (`/api/analytics` is already blocked for DE). Scenario sliders could stay client-side if `scenario.ts`/`simulation.ts` are ported (small), or use `POST /api/analytics/scenario` with overrides.
- **Note:** `/api/sidebar/fire` already computes a FIRE summary on the server (`lib/sidebar/fire-summary.ts`), so it reuses the same pipeline.
- **Priority:** P2.
- **Effort:** M.

### G10 — Pension view (IT)
**Status: ✅ implemented** (branch `feat/mobile-api-foundations` of `buddy-budget`, not merged yet) as `GET /api/pension/view?fundId&today` — [endpoints/pension.md](./endpoints/pension.md#get-apipensionview). Also serves the exit-tax timeline for every year 0–35 (the drag indexes into it) and the projection sliders' settings; `projectPension` stays ported for the sliders.

- **Computed / where:** `lib/pension/pension-context.tsx`:
  - `computePensionPerformance`, `deriveContributions`, `withdrawalScenarios`, `companyTfrValue(…, ASSUMED_INFLATION = 0.02)`, `recentQuarterlyContribution`, `projectPension`, `yearlyBreakdown` (all `lib/calc/pension.ts`)
  - `lib/pension/use-rate-simulation.ts`
  - The Overview tab uses fixed projection constants: 25 years, rates 0 / 0.02 / 0.04.
- **Output:** `{ currency; fund; snapshots; last; performance; contributions; scenarios: WithdrawalScenario[]; tfr: CompanyTfrComparison | null; quarterly: number; yearly: …; projection25y: … }`.
- **Proposed endpoint:** `GET /api/pension/view?fundId=&today=`. `lib/calc/pension.ts` is 321 lines, so porting is also viable.
- **Priority:** P2.
- **Effort:** S–M.

### G11 — Localized category names
**Status: ✅ implemented** (branch `feat/mobile-api-foundations` of `buddy-budget`, not merged yet) in `GET /api/categories` and `GET /api/categorization-rules` (`categoryName`), and in the view endpoints. Still stored names (to do when touched): suggestion groups, subscriptions, auto-categorized groups.

- **Where:** `lib/localization/categories.ts` `localizeCategory(category, profile)`, applied in `lib/queries/categories.ts` through `select`. `GET /api/categories` returns stored names, which are the Italian defaults unless the user onboarded in en/de, in which case `localizeStarterCategories` rewrote them. `PATCH /api/categories/[id]` already returns a localized row, which is inconsistent.
- **Proposed:** localize in `GET /api/categories` (and `/api/categories/usage` if it carries names) using `resolveProfile(session.user)`. Do the same for any route that embeds category names (`categoryName` in rules, suggestion groups, subscriptions).
- **Priority:** P1 (wrong-language labels for IT accounts with language `en`).
- **Effort:** S.

### G12 — Debts small derived values
**Status: ✅ implemented** (branch `feat/mobile-api-foundations` of `buddy-budget`, not merged yet) as `GET /api/debts?include=insights` (interest shares, repaid share, exit-plan inputs and the avalanche plan for each slider step 0–1000/50). The per-loan «E se…» simulators stay ported (no `POST /api/debts/{id}/simulate`).

- **Where:**
  - `yearlyInterestShares(debts)` (`lib/debts/overview-insights.ts`)
  - the "E se…" simulator (`lib/calc/debt-simulator.ts`, `early-repayment.ts`, `amortization.ts`) inside `DebtDetail`
- **Proposed:** add `interestShares` to `GET /api/debts`. Add `POST /api/debts/{id}/simulate` `{ extraMonthly?: number; lumpSum?: { amount: number; date: string }; rateChange?: number }` → `{ plan totals before/after, interestSaved, monthsSaved }`, or port (~500 lines).
- **Priority:** P2.
- **Effort:** S.

### G13 — App metadata and capabilities (bundle-only constants)
**Status: ✅ implemented** (branch `feat/mobile-api-foundations` of `buddy-budget`, not merged yet) as public, session-aware `GET /api/meta` — [endpoints/meta.md](./endpoints/meta.md). `capabilities` also in `GET /api/me/bootstrap`; `sections.financialPlanning` is now false for IT. Not served: `minClientVersion` (no source yet).

- **Where:**
  - `lib/localization/config.ts`: `PRODUCT_COUNTRIES`, `LANGUAGES`, `COUNTRY_LANGUAGES = { IT: ["it","en"], DE: ["en","de"] }`, `isCountryPathAvailable`
  - `lib/localization/financial-country.ts` (`countryFeatures`: taxes, pension, retirement, incomeForecasts, inflation)
  - `lib/localization/planning-availability.ts` (DE: tax ✓, income ✓, pension ✗, retirement ✗, simulations ✗)
  - `lib/validation/currency.ts` `SUPPORTED_CURRENCIES` (EUR, USD, GBP, CHF)
  - `lib/notifications/constants.ts` `NOTIFICATION_DEFAULTS` (all off, digest "mensile")
  - `lib/account/home-pages.ts` `HOME_PAGE_OPTIONS` + `resolveHomePage` legacy mapping
  - `lib/localization/categories.ts` `localizedCategoryProposal(profile)` (onboarding)
  - `lib/app-version` (bundle build info; the server build is in `/api/health`)
- **Proposed endpoint:** `GET /api/meta`, public, or session-aware when a session exists:
  ```ts
  { legal: LegalMeta;                                   // G1 (or a separate /api/legal)
    countries: { id: "IT" | "DE"; languages: ("it"|"en"|"de")[] }[];
    currencies: { value: string; label: string; symbol: string }[];
    notificationDefaults: NotificationPreferences;
    homePages: { path: string; label: string }[];
    server: { version: string; commit: string; builtAt: string }; minClientVersion?: { ios: string; android: string };
    // when authenticated:
    capabilities?: { productCountry: "IT"|"DE"; features: { taxes; pension; retirement; incomeForecasts; inflation: boolean };
                     sections: { pension: boolean; analytics: boolean; goals: boolean; investmentTaxes: boolean; investmentIncome: boolean; fire: boolean } };
    categoryProposal?: CategoryProposalItem[] /* localized for the profile, or ?country=&language= */ }
  ```
- **Priority:**
  - P1 for `capabilities`: mobile otherwise hard-codes the country matrix.
  - P2 for the rest: it can be generated into the spec as constants instead.
- **Effort:** S.

### G14 — What's new
**Status: ✅ implemented** (branch `feat/mobile-api-foundations` of `buddy-budget`, not merged yet) as `GET /api/whats-new?dismissed=` — [endpoints/meta.md](./endpoints/meta.md#get-apiwhats-new). Dismissals stay on the device (no sync endpoint).

- **Where:** `lib/whats-new/entries.ts` (`WHATS_NEW_ENTRIES`, `WHATS_NEW_MAX_AGE_DAYS = 45`), `pick.ts` (`pickWhatsNew`), `use-whats-new.ts` (country filter on `href`, dismissed ids in `localStorage` `bb:whats-new-dismissed`). Entries carry web `href`s (e.g. `/analitiche/obiettivi?nuovo=1&da=novita`).
- **Proposed endpoint:** `GET /api/whats-new` → `{ entries: { id; date; title; summary; href; ctaLabel }[] }`, localized and country-filtered. Mobile maps each `href` to a native route and keeps dismissals locally, unless dismissals should sync across devices: then `POST /api/whats-new/{id}/dismiss`.
- **Priority:** P2.
- **Effort:** XS.

### G15 — Translations and localized API messages
**Status: G15b ✅ implemented** (branch `feat/mobile-api-foundations` of `buddy-budget`, not merged yet): every error body has a stable `code` (generic by status when the route sets none, specific codes on the MVP screens' routes; closed list in README §5). G15a (string tables) is still open.

- **Where:** `lib/localization/messages.ts` builds `messages` from the bundled `catalogs/en.json` (~360 KB) and `catalogs/de.json` (~384 KB). Both are keyed by the **Italian source string**; Italian is the identity mapping. `translate(language, source, values)` replaces `{key}` placeholders. Strings are client and server code constants, not served by any API.
- **API error messages:** ~150 `error: "…"` literals in `app/api` are Italian only. Only these translate on the server:
  - the country-gate 403 (proxy and `withCountryGuard`)
  - a few routes that call `resolveProfile`/`translate` (`financial-planning`, `user/settings`, `user/onboarding`, `instruments/[id]/settings`, `instruments/[id]/commentary`, `gocardless/connections`, `investments/portfolio`, `categories/[id]`)
- **Proposed:**
  1. Generate mobile string tables from the same catalogs, through the spec repo (rule 6 in README).
  2. P1: make API errors localizable. Either add a stable `code` to every 4xx body so mobile maps it to a local string, or translate on the server with `resolveProfile(session.user).language`.
- **Priority:** P0 for string-table generation (every screen). P1 for API error codes.
- **Effort:** S for tooling; M for adding codes to all routes.

### `lib/queries/*` exports → API coverage

Every `lib/queries/*` file is a **client-side TanStack Query module** (`"use client"`), not a server query layer. Each hook is a thin `fetch` wrapper over one route.

| File | Exports (hooks/constants) | Route(s) | Exposed? |
|---|---|---|---|
| `accounts.ts` | `useAccountsQuery`, `useCreateAccountMutation`, `useUpdateAccountMutation`, `useDeleteAccountMutation` | `/api/accounts`, `/api/accounts/[id]` | yes |
| `analytics.ts` | `ANALYTICS_QUERY_KEY`, `useAnalyticsAssumptionsQuery`, `useUpdateAssumptionsMutation`, `useMarkWalkthroughSeenMutation` | `/api/analytics/assumptions`, `/api/analytics/walkthrough` | yes (only assumptions; plan = G9) |
| `attention.ts` | `ATTENTION_QUERY_KEY`, `useAttentionQuery`, `useMarkMovementsSeen` | `/api/transactions/attention`, `/seen` | yes |
| `budgets.ts` | `useBudgetsQuery`, `useUpsertBudgetMutation` | `/api/budgets`, `/api/budgets/[categoryId]` | yes |
| `categories.ts` | `useCategoriesQuery` (**applies `localizeCategory` on the client**), `useCategoryUsageQuery`, `useCreate/Update/DeleteCategoryMutation`, `useDistributeColorsMutation` | `/api/categories`, `/[id]`, `/usage`, `/distribute-colors` | yes (localization = G11) |
| `categorization.ts` | types + `useCategorizeSuggestionsQuery`, `useAutoApplyMutation`, `useAutoCategorizedQuery`, `useMarkAutoCategorizedSeenMutation`, `useApplyCategorizationMutation`, `useCategorizationRulesQuery`, `useCreate/Update/DeleteRuleMutation`, `useRecategorizePreviewQuery`, `useRecategorizeMutation`, `useUndoRecategorizeMutation`, `useGenerateAiSuggestionsMutation`, `QUERY_KEYS_CHANGED_BY_CATEGORIZATION` | `/api/transactions/{categorize-suggestions,categorize-suggestions/generate,categorize-auto,categorize-apply,auto-categorized,auto-categorized/seen,recategorize,recategorize/undo}`, `/api/categorization-rules[/id]` | yes |
| `debts.ts` | `DEBTS_QUERY_KEY`, `useDebtsQuery`, `useCreate/Update/DeleteDebtMutation`, `useCreate/DeleteDebtEventMutation`, `useBulkPayDebtMutation` | `/api/debts`, `/[id]`, `/[id]/events[/eventId]`, `/[id]/payments/bulk` | yes |
| `goals.ts` | `GOALS_QUERY_KEY`, payload types, `useGoalsQuery`, `useCreate/Update/Achieve/DeleteGoalMutation`, `useReorderGoalsMutation` | `/api/goals`, `/[id]`, `/reorder` | yes |
| `gocardless.ts` | types, `BANK_CAPACITY_QUERY_KEY`, `useBankCapacityQuery`, `useInstitutionsQuery`, `useBankConnectionsStatusQuery`, `useCreateConnectionMutation`, `useConnectionAccountsQuery`, `useFinalizeConnectionMutation`, `useSyncAccountMutation` | `/api/gocardless/{capacity,institutions,connections,connections/[id]/accounts,connections/[id]/finalize,accounts/[id]/sync}` | yes |
| `investments.ts` | `INSTRUMENT_SEARCH_DEBOUNCE_MS`, `BACKFILL_POLL_INTERVAL_MS`, `useInvestmentsOverviewQuery`, `useDebouncedValue` (util), `useInstrumentSearchQuery`, `useInstrumentPriceOnDateQuery`, `useBackfillStatusQuery`, `useCreateInstrumentMutation`, `useCreate/Update/DeleteInvestmentTransactionMutation`, `useSaveManualPriceMutation`, `useParseStatementMutation`, `useResolveImportMutation`, `useRunImportMutation`, `useUpdatePortfolioMutation`, `useUpdateTargetsMutation`, `useUpdateBreakdownMutation`, `useUpdateInstrumentSettingsMutation`, `useCreate/DeleteTaxCarryforwardMutation`, `useDismissDividendMutation`, `useBrokerStatementsQuery`, `useDeleteStatementImportMutation`, `useInvestmentResetPreview`, `useResetInvestmentsMutation` | `/api/investments/{overview,transactions[/id],portfolio,targets,tax-carryforwards[/id],dividends/dismissed,statements[/id],import,import/parse,import/resolve,import/reset}`, `/api/instruments{,/search,/backfill,/[id]/price,/[id]/manual-prices,/[id]/settings,/[id]/breakdown}` | yes (raw data) |
| `investments-view.ts` | `useInvestmentsView`, `useFilteredInvestmentsOverview` | wraps `/api/investments/overview` + **client** `buildInvestmentsView` / `filterInvestmentBrokers` | ✅ `GET /api/investments/view` (G7) |
| `net-worth.ts` | `useNetWorthSnapshotsQuery` | `/api/net-worth/snapshots?from&to[&compact=1]` | yes |
| `notifications.ts` | `useNotificationPreferencesQuery`, `useUpdateNotificationPreferencesMutation`, `useSendNotificationExampleMutation`, `AiCategorizationState`, `useAiCategorizationQuery`, `useUpdateAiCategorizationMutation` | `/api/user/notifications`, `/test`, `/api/user/ai-categorization` | yes |
| `pension.ts` | `PENSION_QUERY_KEY`, `usePensionQuery`, `useCreate/Update/DeletePensionFundMutation`, `useSave/DeletePensionSnapshotMutation`, `useImportPensionSnapshotsMutation` | `/api/pension`, `/api/pension/funds[/id[/snapshots[/snapshotId|/import]]]` | yes (raw; view = G10) |
| `performance.ts` | `usePerformanceView` | **client** composition over `useInvestmentsView` + `computePortfolioReturns` | ✅ `GET /api/investments/performance` (G7b) |
| `personal-imports.ts` | `PersonalImportListing`, `personalImportLabels`, `PERSONAL_IMPORT_POLL_INTERVAL_MS`, `usePersonalImportsQuery` | `/api/personal-imports` | yes |
| `sidebar.ts` | `useSidebarSummaryQuery`, `useSidebarDeadlinesQuery`, `useSidebarFireQuery` | `/api/sidebar/{summary,deadlines,fire}` | yes |
| `start.ts` | `useStartQuery`, `useStartDismissMutation`, `useStartDemoMutation`, `useClearDemoMutation` | `/api/start`, `/api/start/demo` | yes |
| `subscriptions.ts` | `useSubscriptionsQuery`, `useSave/Update/DeleteSubscriptionMutation` | `/api/subscriptions[/id]` | yes |
| `sync-jobs.ts` | `SYNC_JOBS_QUERY_KEY`, `SYNC_JOBS_POLL_INTERVAL_MS` (1000), `useSyncJobsQuery`, `useInvalidateOnSyncJobFinish`, `useDismissSyncJobMutation` | `/api/sync-jobs`, `/[id]/dismiss` | yes |
| `titles.ts` | `TITLE_BACKFILL_POLL_MS`, `useTitleListQuery`, `useTitleAnalysisQuery`, `useWatchMutation`, `useCreate/DeleteAlertMutation`, `useCommentaryMutation`, `useQuotationCandidatesQuery`, `useLinkQuotationMutation` | `/api/investments/titles`, `/api/instruments/[id]/{analysis,watch,alerts[/alertId],commentary,quotation}` | yes |
| `transactions.ts` | types, `useTransactionsQuery`, `useCreate/Update/DeleteTransactionMutation` | `/api/transactions[/id]` | yes (no paging: G4) |
| `user-settings.ts` | `UserSettings`, `AccountActionError`, `useUserSettingsQuery`, `useUpdateUserSettingsMutation`, `useUserSessionsQuery`, `useRevokeSessionMutation`, `useUserDataSummaryQuery`, `useExportDataMutation`, `useResetAccountMutation`, `useDeactivateAccountMutation`, `useReactivateAccountMutation`, `useDeleteAccountMutation` | `/api/user/{settings,sessions[/id],data-summary,export,reset,deactivate,reactivate,account}` | yes |

Direct `fetch` calls outside `lib/queries` all target existing routes:
- `/api/user/onboarding`, `/api/user/legal-acceptance`, `/api/user/export` (an `<a href>` download), `/api/user/settings` (`PrivacyProvider` PATCH `hideAmounts`)
- `/api/financial-planning`, `/api/personal-imports[/id]`, `/api/support`, `/api/email/unsubscribe`, `/api/client-errors`
- `/api/instruments/[id]/logo`, used as an image URL

---

## 4. Non-data gaps (gates, redirects, cookies, local state)

### 4.1 Gates in `proxy.ts` that mobile must replicate
The proxy runs only for web requests. Mobile hits `/api/*` directly and gets **empty-body** 401/403s for the first two gates, so it must decide the screen itself from `GET /api/auth/get-session` (`user.*` additional fields: `productCountry`, `language`, `currency`, `onboardingCompleted`, `homePage`, `hideAmounts`, `deletionScheduledAt`, `legalAcceptedAt`, `legalAcceptedVersion`; all `input: false`).

Evaluate these in order, on every app start or foreground and on any unexpected 403:

| # | Condition | Web behaviour | Mobile rule | API signal today |
|---|---|---|---|---|
| 1 | no session | pages → `/login?redirect=<path>`; `/api/*` → 401 empty | show Login | 401, empty body |
| 2 | `user.deletionScheduledAt != null` | only `/account-disattivato`; APIs 403 except `/api/user/reactivate` | show Deactivated screen (date = `deletionScheduledAt`); actions: reactivate, sign out | 403, empty body |
| 3 | `onboardingCompleted && legalAcceptedVersion !== LEGAL_VERSION` | only `/accetta-termini`; APIs 403 except `/api/user/legal-acceptance`, `/api/user/export`, `/api/user/account` | show Accept-terms screen (accept / export data / delete account / sign out) | 403, empty body. **Needs G1** to compare the version |
| 4 | `!onboardingCompleted` | pages → `/onboarding` (**APIs are NOT gated**) | show Onboarding; do not load app data | none (the API works) |
| 5 | `productCountry` lacks a capability | pages → `/country-unavailable`; APIs → 403 `{ code: "country_feature_unavailable", error }` | hide the tabs/sections using the capability matrix (`isCountryPathAvailable`, G13) | JSON 403 with `code` |

Gates 2 and 3 return the same empty 403, so the client cannot tell them apart from the response. **Proposal (P0, XS):** return `{ code: "account_deactivated" }` and `{ code: "legal_acceptance_required", version: LEGAL_VERSION }` bodies from `proxy.ts`.

Other redirects:
- `/login` with a session → `safeRedirectPath(?redirect)`.
- `/onboarding` after completion → `/`.
- `/accetta-termini` and `/account-disattivato` when not applicable → `/`.

### 4.2 Server-side redirects in pages and routes
- `/` → `resolveHomePage(session.user.homePage)`. Allowed values: `/panoramica` (default), `/liquidita`, `/liquidita/conti`, `/liquidita/analisi`, `/investimenti`. Legacy values `/conti`, `/movimenti` and `/movimenti/analisi` map to the new ones. Mobile maps these paths to its start tab.
- Legacy page redirects:
  - `/analitiche/{costi,crescita,prelievi,rischio,simulazione}` → `/analitiche#…`
  - `/debiti/simulatore` → `/debiti/finanziamenti`
  - `/investimenti/titoli` → `/investimenti`
  - `/investimenti/rendiconti[/importazioni]` → `/investimenti/operazioni`

  These only matter for deep links and push or email links.
- `GET /api/gocardless/callback` is the **web** bank-consent return and redirects to web pages: `/conti/collega/{connectionId}` on success, `/liquidita/conti?bankError={missing_ref|not_found|consent_failed|gocardless_unavailable}` on failure (now shown as a toast), `/login` with no session. **✅ Resolved for mobile by R6** (branch `feat/mobile-api-foundations`): `POST /api/gocardless/connections` with `client: "native"` sets the redirect to the public `/api/gocardless/callback/native`, which 302s to `buddybudget://bank/return?ref=<connectionId>&status=returned|cancelled|failed|invalid_ref[&error=<code>]` without session or state change; the app then calls the bearer `POST /api/gocardless/connections/{id}/complete` and `…/finalize`. HTTPS fallback page `/banca/ritorno` (future Universal/App Links target). Contract: [gocardless.md](./endpoints/gocardless.md#native-connection-flow-r6), fixture [`gocardless-native-flow.json`](./fixtures/gocardless-native-flow.json).
- Auth: `authClient.signIn.magicLink({ email, callbackURL })` and `signIn.social({ provider: "google", callbackURL })`. Both complete through web redirects that set the better-auth session **cookie**. Native apps need either:
  - universal links for the magic-link URL + cookie storage, or
  - better-auth's bearer/token plugin.

  Cross-reference the auth doc. This is P0 but not a data gap.
- `GET /api/email/unsubscribe` → 303 to the web page `/disiscrizione?t=` (web only; nothing for mobile).
- `GET /api/user/export` is a file download (`Content-Disposition: attachment`). Mobile must save or share it.

### 4.3 Cookies and per-device state that must become API or local settings
| Web mechanism | Key | Meaning | Mobile |
|---|---|---|---|
| Cookie `bb-language` (365 days, set by `LocalizationProvider` and `LanguagePicker`) | `bb-language` | display language **only when signed out**. Signed in, `session.user.language` wins (`getLocaleProfile`) | local setting before login (default: device language mapped to it/en/de). After login use `user.language`. Persisted with `PATCH /api/user/settings { language, productCountry }` (must be a valid pair: `COUNTRY_LANGUAGES`) or in the onboarding payload |
| Session field `hideAmounts` (read on the server in `(app)/layout.tsx`, toggled through `PATCH /api/user/settings { hideAmounts }`) | none | privacy mask on all amounts (`setAmountsMasked`, charts blurred) | **already server-synced**: read it from session or settings, write it through PATCH |
| `localStorage` `bb:sidebar:module:{oggi,portafoglio,watchlist,scadenze,fire}` (default true) | none | which sidebar insight modules show (per device) | local setting (sidebar → Overview widgets on mobile) |
| `localStorage` `bb:mobile:bottom-nav` | none | bottom nav vs hamburger (web mobile) | n/a |
| `localStorage` (`use-pension-in-net-worth`, default true) | `PENSION_IN_NET_WORTH_KEY` | include pension in the net-worth total | local setting, or server if it should sync (G2 takes `includePension`) |
| `localStorage` `bb:whats-new-dismissed` | none | dismissed what's-new ids | local (G14) |
| `localStorage` `bb:categorize-tour-seen` | none | swipe tutorial seen | local |
| `localStorage` `bb-personal-import-dismissed` | none | dismissed import-island jobs | local |
| `localStorage` goals invite dismissed, collapsible sections, guided-reading per analytics tab | none | UI flags | local |
| `localStorage` `buddybudget:sidebar:collapsed` | none | desktop sidebar | n/a |
| `localStorage` investment-import column mapping (keyed by CSV headers) | `mappingStorageKey(headers)` | remembers manual CSV mappings | local (or skip) |
| React state `BrokerSelectionProvider` | none | view-only broker filter across investment tabs (not persisted) | in-memory; pass as `excludeBrokers` to G7/G8 |
| Theme (`next-themes`, `defaultTheme="system"`) | `theme` | light/dark | system setting |
| Server `analytics walkthroughSeen` | none | already in `/api/analytics/assumptions` | server |

### 4.4 Server-only or bundle-only formatting and localization
- Number, currency and date formatting is done **on the client** with `Intl` using `LANGUAGE_LOCALES = { it: "it-IT", en: "en-GB", de: "de-DE" }` (`lib/localization/format.ts`). The API returns raw numbers, numeric strings and ISO dates, so mobile formats them natively with the same locale map.
  - Exception: `NetWorthSeriesPoint.label` (client calc) is hard-coded to it-IT. Ignore it and format `date`.
- The overview voice sentence (`lib/overview/voice.ts`), risk/return insight sentences (`lib/investments/risk-insights.ts`, `returns-insights.ts`, `exposure.ts`) and account status labels (`localizedAccountStatus`) are **localized copy generated in TS**. Port them as string templates (with the G15 catalogs), or return them from the computed endpoints.
- Default-category names: G11.
- Country-gate copy (`/country-unavailable`): static strings (`"Questa funzione non è ancora disponibile per la Germania."` + explanation). They are in the catalog; mobile shows them locally when a section is hidden or when a 403 `country_feature_unavailable` arrives.
- The PWA manifest, `robots.ts`, Umami script (`/stats/script.js`, website id `051f9e59-…`), fonts and `themeColor` are web only. Analytics `track()` events are client-side Umami; the mobile analytics strategy is a separate decision.

---

### G16 — Smaller API ergonomics gaps (reported by the liquidity agent)
- **AI suggestion generation has no status.** `POST /api/transactions/categorize-suggestions/generate` returns only `{ status: "no_key" | "disabled" | "started" }`. The web then polls `GET /api/transactions/categorize-suggestions` on a timer until the "missing" count stops changing (`components/domain/categorization/use-ai-generation.ts`). Proposed: return `{ jobId }` and report progress through `/api/sync-jobs`, the background-job standard. P2, S.
- **Merchant key for a single transaction.** Reported as not exposed; it is needed to create a merchant rule from one movement. `merchantKey` appears in the suggestion groups and in the rules routes, but not in `GET /api/transactions` rows (**unverified in detail**). Proposed: add `merchantKey` to the listed transactions. P2, XS.


### G17 — Imports (reported by the Phase 4c agent, 2026-10-19)
- **Corrections of AI imports are not on web `main`** (updated Phase 4e, 2026-10-20). The branch was merged with web
  `main` 0.81.0 (`9a769fa5`): `brokerFallback` is now there, but the corrections (`correctionOf`/`feedback`,
  `replace_import`/`discard_correction`, `?correction=1`, `correction_ready`) live only on the web branch
  `codex/import-result-correction` (commit `433ae49c`), never merged. By decision 0004 IMP-049…054 are out of scope:
  the apps keep the code behind `PersonalImportRules.correctionsEnabled = false` (Android `CORRECTIONS_ENABLED`) and
  switch it on when the web ships it. P2, S.
- **Generic / Fineco / Yahoo broker CSVs are parsed on the device** (ported `lib/investments/import/{mapping,presets,
  normalize,fineco,providers,messages}.ts` + `lib/pension/import/xlsx.ts`, checked against golden vectors generated from
  the web TypeScript, `fixtures/imports/import-rules-vectors.json`). A server `parse` endpoint for column CSVs would remove
  the two ports (§5). P2, M.
- **Upload size on mobile.** Personal imports send the whole file as one JSON string (≤ 25 MB) and broker imports send
  `statementCsv` again with the dry run and the import: no multipart/resumable upload. P3, M.
- **App Links / universal links for email links** (`/importazioni?job=`): the apps handle
  `https://buddybudget.io/importazioni…` (Android intent filter with `autoVerify`) and `buddybudget://importazioni?job=`,
  but verification needs `/.well-known/assetlinks.json` and `apple-app-site-association` on the web host, and the iOS
  Associated Domains entitlement (signing). P2, S.
- **Free-text errors.** Personal-import job errors, review reasons and broker parser issues are Italian free text with no
  `code`, so English/German users see Italian there (as on the web). P2, M.
---

## 5. Client-side computation: port twice (Swift + Kotlin) or move to server-computed view endpoints

The web follows one pattern everywhere: **the API returns raw rows, and pure TS engines in the browser compute what the screen shows.** Porting an engine means writing it twice (Swift and Kotlin) and keeping both identical to the TS, with golden vectors in `domain/`. iOS/Android parity and a single source of truth strongly favour **server-computed view endpoints** for anything large, tax- or finance-sensitive, or still changing often. Porting is reasonable only for small, stable math that must run offline or interactively (sliders).

| Area | Client-side engine (web) | Size / volatility | Recommendation | P |
|---|---|---|---|---|
| Investments: positions, value, P/L, chart series, period gain, cost impact | `lib/calc/investments.ts`, `fx.ts`, `lib/investments/view.ts` (`buildInvestmentsView`), `period-gain`, `cost-impact`, `broker-filter.ts` | ~1.5k lines, frequently changed | **Server endpoint** `GET /api/investments/view` (G7) ✅ | P1 |
| Investments: TWR/MWR/real returns, risk, heatmap | `lib/calc/returns.ts`, `risk.ts`, `risk-extras.ts`, `return-heatmap.ts` | ~1k lines | **Server endpoint** (G7b) ✅ | P1 |
| Investments: allocation vs targets, exposure, overlap | `lib/investments/analysis-view.ts`, `exposure.ts`, `allocation.ts`, `insights.ts` | medium | **Server** (inside G7 `analysis`) ✅ | P1 |
| Investments: dividends history, dividends to record, 12-month forecast | `lib/investments/income-view.ts`, `income.ts`, `dividends.ts` | medium | **Server** (G8) ✅ | P2 |
| Investments: Italian tax report, stamp duty, loss carryforwards, sale simulator | `lib/calc/taxes.ts`, `lib/investments/tax-view.ts`, `tax-report` | ~650 lines; tax rules are legally sensitive | **Server** (G8, including `simulate-sale`) ✅ | P2 |
| Investments: generic/Fineco/Yahoo CSV parsing and column mapping; provider catalogue `IMPORT_PROVIDERS` | `lib/investments/import/csv.ts`, `mapping.ts`, `normalize.ts`, `presets.ts`, `fineco.ts`, `providers.ts` (used by `components/domain/investments/import/*`). Broker PDF/statement parsing is already on the server (`/api/investments/import/parse` → `parseBrokerStatement`) | medium; per-broker | **Server**: add a CSV `parse` + `preview` endpoint (multipart → normalized rows + mapping suggestions) and `GET /api/investments/import/providers`. Alternative for mobile v1: the AI personal-import flow (`/api/personal-imports`), which is already on the server | P2 |
| Net-worth chart and Overview composition | `lib/calc/net-worth.ts` (`buildNetWorthSeries`, `computeNetWorthChange`), "today" point assembled from accounts, investments view, pension and debts | medium; depends on the investments engine | **Server** (G2). A server equivalent of the summary already exists (`lib/sidebar/summary.ts`) | P0 |
| Liquidity: month summary, pace vs typical, group totals, budget spent/progress | `lib/calc/expenses.ts`, `month-pace.ts` | ~600 lines, stable | **Server** (G3) preferred; porting is acceptable (needed anyway for local filtering) | P0 |
| Liquidity analysis and cash flow (spend curve, income sources, accumulated savings) | `lib/calc/cashflow.ts`, `lib/liquidity/spend-curve.ts`, `lib/calc/movements.ts` | ~350 lines | **Server** (G6) ✅ | P1 |
| Account sparkline, connection health | `lib/liquidity/account-series.ts`, `lib/gocardless/connection-health.ts` | small | **Server** (G5); trivial to port if preferred | P1 |
| Subscriptions: upcoming charges / price rises filtering | `lib/subscriptions/view.ts` (the list itself is computed on the server by `loadSubscriptions`) | small | **Port** (small presentation filter) or add fields to `GET /api/subscriptions` | P2 |
| Debts: overview insights (interest shares), early-repayment / "E se…" simulator, add-form previews, transaction candidates | `lib/debts/overview-insights.ts`, `lib/calc/debt-simulator.ts`, `early-repayment.ts`, `amortization.ts`, `debt-plan.ts` (the persisted plan is already server-side via `buildDebtsView`) | ~750 lines | `interestShares` + exit plans in `GET /api/debts?include=insights` (G12) ✅; per-loan simulators and add-form previews **ported** (no endpoint) | P2 |
| Analytics / FIRE: base, plan, expected return, scenarios, Monte Carlo | `lib/analitiche/*` (`buildAnalyticsBase`, `resolvePlan`, `scenario.ts`, `simulation.ts`), `lib/calc/monte-carlo.ts`, `fire.ts`, `liquidation.ts`. A server equivalent `loadAnalyticsSnapshot` (`lib/analitiche/snapshot.ts`) exists but is exposed only in reduced form through `/api/sidebar/fire` and the goals `fire` block | ~1k lines | **Server** `GET /api/analytics/base` (G9) ✅ (loads like the web's context, not `loadAnalyticsSnapshot`); slider scenarios **ported** | P2 |
| Pension (IT): performance, per-year contributions, exit tax, withdrawal scenarios, TFR comparison, projection, rate simulation | `lib/calc/pension.ts`, `lib/pension/pension-context.tsx`, `use-rate-simulation.ts` | ~400 lines; tax rules | **Server** `GET /api/pension/view` (G10) ✅ | P2 |
| Pension CSV/XLSX snapshot import parsing | `lib/pension/import/{mapping,plan,xlsx}.ts` (client) → `POST /api/pension/funds/[id]/snapshots/import` (rows) | small–medium | **Server**: a multipart parse endpoint returning preview rows | P2 |
| DE financial planning (income, tax, projections) | `lib/financial-planning/*` (`projections.ts`, `income.ts`, `portfolio.ts`, `countries/*`). `/api/financial-planning` only stores and returns the input document `{ plan, revision }` | medium; DE rollout still changing | **Server**: `GET /api/financial-planning?include=results` + `POST /api/financial-planning/results` ✅ | P2 (DE only) |
| Category display names | `lib/localization/categories.ts` `localizeCategory` | small | **Server** (G11: return the localized name or a `displayName`) | P1 |
| Overview voice, risk/return insight sentences, account status labels | `lib/overview/voice.ts`, `lib/investments/risk-insights.ts`, `returns-insights.ts`, `localizedAccountStatus` | small, copy-heavy | **Server** (return inside the computed views), or port as templates with the G15 catalogs | P1 |

Notes for every server-computed endpoint: take `today=YYYY-MM-DD` (the web uses the browser's local day), serialize `Map`s as arrays or records, keep money as JSON numbers (these are computed floats, not Drizzle numeric strings) and say so in each endpoint doc. Consider short-TTL caching per user for the investments engine (`/api/investments/overview` already sets `maxDuration = 60`).

## 6. Ranked gap list

| Priority | Gap | Proposed endpoint / change | Effort |
|---|---|---|---|
| ✅ **P0** | G1 Legal version not exposed (legal gate + onboarding) | `GET /api/legal` (public) | XS |
| ✅ **P0** | Proxy gates return identical empty 403s | add `code` (and `version`) to the proxy 403 bodies | XS |
| ✅ **P0** | G2 Overview derived values | `GET /api/overview?period&includePension&today` (interim: `/api/sidebar/summary`) | M |
| ✅ **P0** | G3 Movements month aggregates | `GET /api/liquidity/month?accountId&today` (or port `expenses.ts`/`month-pace.ts`) | S |
| ✅ **P0** | G4 Unpaginated two-year transaction download | `GET /api/transactions?…&limit&cursor&accountId&categoryId&q&uncategorized` | S–M |
| **P0** | G15a String catalogs bundle-only | generate mobile string tables from `catalogs/{en,de}.json` through the spec | S |
| **P0** (non-data) | Bank-consent callback and auth flows redirect to web pages and cookies | app links / redirect param on `POST /api/gocardless/connections`; native auth (bearer plugin or universal links) | M |
| ✅ **P1** | G7 Investments computed view | `GET /api/investments/view?period&from&to&excludeBrokers&today` | M–L |
| ✅ **P1** | G7b Investments performance | `GET /api/investments/performance?…&asOf` | S (after G7) |
| ✅ **P1** | G5 Account sparkline + connection health | `GET /api/accounts?include=trend,health` | S |
| ✅ **P1** | G6 Spending analysis | `GET /api/liquidity/analysis?period&ref&accountId&today` | S–M |
| ✅ **P1** | G11 Category names localized only on the client | localize in `GET /api/categories` and the embedded `categoryName`s | S |
| ✅ **P1** | G13 Capabilities matrix | `capabilities` in `GET /api/meta` (or in `GET /api/user/settings`) | S |
| ✅ **P1** | G15b Italian-only API error messages | stable `code` on every 4xx body, or server-side translation | M |
| ✅ **P2** | G8 Dividends / Taxes (IT) | `GET /api/investments/income`, `GET /api/investments/taxes`, `POST /api/investments/taxes/simulate-sale` | M |
| ✅ **P2** | G9 Analytics / FIRE plan (IT) | `GET /api/analytics/plan?today` (+ optional `POST /api/analytics/scenario`) | M |
| ✅ **P2** | G10 Pension view (IT) | `GET /api/pension/view?fundId&today` | S–M |
| ✅ **P2** | G12 Debts interest shares (simulator ported) | `interestShares` in `GET /api/debts`; `POST /api/debts/{id}/simulate` | S |
| ✅ **P2** | G13 Other constants (min client version open) (currencies, home pages, notification defaults, category proposal, min client version) | `GET /api/meta` | S |
| ✅ **P2** | G14 What's new | `GET /api/whats-new` | XS |
| **P2** | G16 AI-generation status; `merchantKey` on transactions | `{ jobId }` + `/api/sync-jobs`; add field | XS–S |
| **P2** | §5 CSV import parsing (investments, pension), DE planning results, debts previews, subscriptions view | parse/preview endpoints; computed `results` in `/api/financial-planning`; `POST /api/debts/{id}/simulate` | S–M each |
