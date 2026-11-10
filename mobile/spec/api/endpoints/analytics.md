# Analytics (Analitiche: FIRE assumptions and walkthrough)

Feature area(s): Analitiche (FIRE number, projections, Monte Carlo, scenarios, assumptions editor, first-run walkthrough). IT-only. Also consumed indirectly by Goals and the sidebar FIRE module (same assumptions).
Source: `app/api/analytics/**/route.ts`, `lib/analitiche/assumptions.ts`, `lib/analitiche/period.ts`, `lib/analitiche/data.ts`, `lib/queries/analytics.ts`, `lib/db/schema/analytics.ts`

Note: "analytics" here means the Analitiche product feature, not product telemetry.

## Endpoints

| Method | Path | Purpose | Auth | Notes (job / demo-guard / country-gate) |
|---|---|---|---|---|
| GET | /api/analytics/base | Everything Analitiche loads and computes, in one call (G9, branch `feat/mobile-api-foundations`) | session | DE -> 403 |
| GET | /api/analytics/assumptions | User assumptions (defaults filled) + walkthrough flag | session | DE -> 403 |
| PUT | /api/analytics/assumptions | Partial update; returns merged result | session | DE -> 403 |
| POST | /api/analytics/walkthrough | Mark the first-run guide as seen | session | DE -> 403 |

Country gate: proxy prefix `/api/analytics` + `withRoute(name, withCountryGuard(handler))` -> `403 { code: "country_feature_unavailable", error: "<localized>" }` for DE. No demo guard, no jobs.

Storage: table `analytics_assumptions` (one row per user, `data` jsonb, `walkthroughSeenAt`, `updatedAt`).

## Types

```ts
interface AnalyticsAssumptions {
  withdrawalRate: number;          // 0.01..0.1 (fraction; default 0.035)
  dataPeriod:                      // period of user data used to derive spending/savings/return; default { kind: "ultimi", months: 12 }
    | { kind: "ultimi"; months: 12 | 24 }
    | { kind: "personalizzato"; from: string; to: string }; // "YYYY-MM" (regex ^\d{4}-(0[1-9]|1[0-2])$, "Mese non valido"); span 3..120 months inclusive
  annualSpending: number | null;   // 0..1e8; null = derive from data period (default null)
  annualSavings: number | null;    // 0..1e8; null = derive (default null)
  expectedReturn: number;          // real annual return, -0.02..0.5 (default 0.04)
  expectedReturnAuto: boolean;     // true = derive from investment history; expectedReturn is fallback (default true)
  volatility: number;              // 0..0.6 (default 0.12)
  inflation: number;               // -0.02..0.15 (default 0.02)
  retirementYears: number;         // int 5..70 (default 40)
  rule: "fissa" | "percentuale" | "guyton-klinger" | "vanguard"; // withdrawal rule (default "fissa")
  includePensionFunds: boolean;    // count supplementary pension in FIRE wealth (default false)
  includeLatentTax: boolean;       // gross up FIRE number for latent capital-gains tax (default true)
  publicPension: { annual: number /*0..1e8, real*/; startsAfterYears: number /*int 0..60*/ } | null; // default null
  terByInstrument: Record<string /*instrumentId, <=64*/, number /*0..0.05*/>; // default {}
}
interface AssumptionsResponse { assumptions: AnalyticsAssumptions; walkthroughSeen: boolean }
```
All values are JSON numbers (fractions, not percentages).

---

## GET /api/analytics/base

Route name: `analytics.base` · Auth: session · Guards: proxy + `withCountryGuard` (DE → 403 `country_feature_unavailable`) ·
`maxDuration` 60 s. Source: `app/api/analytics/base/route.ts`, `lib/views/analytics.ts` (`buildAnalyticsView`, pure),
`lib/views/analytics.server.ts`, `analyticsViewSchema` in `lib/views/schemas.ts`. Implemented on branch
`feat/mobile-api-foundations` (gaps.md **G9**).

Replaces the eight queries of `AnalyticsProvider` (accounts, assumptions, transactions of
`analyticsTransactionsRange(dataPeriod)`, localized categories, investments `max`, pension, debts total, net-worth
snapshots) with one call that runs `buildAnalyticsBase`, `resolveExpectedReturn` / `withExpectedReturn` and
`resolvePlan` with the **saved** assumptions, plus the static readings of that plan. Query: `today=YYYY-MM-DD`
(device's local day). Fixture: [analytics-base.json](../fixtures/analytics-base.json).

```ts
interface AnalyticsView {
  currency: string; today: string; walkthroughSeen: boolean;
  storedAssumptions: AnalyticsAssumptions;   // as saved: what PUT /api/analytics/assumptions edits
  assumptions: AnalyticsAssumptions;         // in use: expectedReturn from history when expectedReturnAuto
  returnInfo: ExpectedReturnInfo;            // { value, source: "storico" | "prudente" | "manuale", history, historyReal, clamped, high }
  base: AnalyticsBase;                       // wealth, cashflow (months, annual income/spending/savings, savingsRate…), positions,
                                             // growthPoints, risk, riskContribution, names, instrumentTypes, historicalReturn
  plan: AnalyticsPlan;                       // spending(+Source), savings(+Source), wealth, liquidation, taxShare, fireNumberGross,
                                             // target, progress, yearsToFire, coast[{ years, number }]
  growth: { split: GrowthSplit; journey: string[] };          // «Il percorso»: localized sentences
  timeline: { headline: string; series: { year: number; wealth: number }[] };  // «Quando arrivi» with the saved assumptions
}
```

What stays on the device (ported, [domain/fire-and-simulations.md](../../domain/fire-and-simulations.md)), starting from
`plan`, `assumptions` and `base`: the «e se…» sliders (`applyScenario` → `resolvePlan`, `timelineSeries` for the
dashed comparison), Monte Carlo (`compareRules`, `runMonteCarlo`), FIRE sensitivity tables, costs (`summarizeCosts`,
`costDrag` with the editable TER). After `PUT /api/analytics/assumptions` refetch this view (the data period changes
which transactions count).

## GET /api/analytics/assumptions
Route name: `analytics.assumptions.get` · Auth: session · Guards: country

**Response** `200` `AssumptionsResponse`. Stored data is merged over `DEFAULT_ASSUMPTIONS` field by field; any stored field that no longer validates silently falls back to its default (never an error). Legacy rows without `expectedReturnAuto` get `expectedReturnAuto = (expectedReturn === 0.04)`.
```json
{ "assumptions": { "withdrawalRate": 0.035, "dataPeriod": { "kind": "ultimi", "months": 12 }, "annualSpending": null, "annualSavings": null,
  "expectedReturn": 0.04, "expectedReturnAuto": true, "volatility": 0.12, "inflation": 0.02, "retirementYears": 40, "rule": "fissa",
  "includePensionFunds": false, "includeLatentTax": true, "publicPension": null, "terByInstrument": {} },
  "walkthroughSeen": false }
```
**Errors:** 401 empty; 403 country.

---

## PUT /api/analytics/assumptions
Route name: `analytics.assumptions.update` · Auth: session · Guards: country

**Request body** (`application/json`): `Partial<AnalyticsAssumptions>`, at least one key ("Niente da aggiornare"); each field validated as above. Unknown keys are stripped (non-strict zod object). `terByInstrument`, `dataPeriod`, `publicPension` are replaced as whole values (no deep merge).

**Merge rule:** if `expectedReturn` is sent without `expectedReturnAuto`, the server sets `expectedReturnAuto = false` (writing a return means choosing it manually).

**Response** `200` `AssumptionsResponse` (full merged assumptions; `walkthroughSeen` from before the update).

**Errors**
| Status | Body | When |
|---|---|---|
| 400 | `{ error: "<first zod issue message>" }` (fallback `"Dati non validi"`) | invalid body / empty object / non-JSON |
| 401 | empty | |
| 403 | country body | DE |

**Side effects:** upsert `analytics_assumptions.data` (full object). Logs `analytics.assumptions.saved`, `analytics.return_source.changed`, `analytics.data_period.changed`. Web client additionally fires `track("analytics_assumptions_saved", { fields })` client-side and invalidates the sidebar FIRE query.
**Mobile notes:** after saving, refetch `GET /api/sidebar/fire` and `GET /api/goals` (they use these assumptions server-side).

---

## POST /api/analytics/walkthrough
Route name: `analytics.walkthrough.seen` · Auth: session · Guards: country

**Request body:** none.
**Response** `204` empty.
**Errors:** 401 empty; 403 country.
**Side effects:** upsert `walkthroughSeenAt = now()`. Idempotent.

## Mobile notes (feature-level)
The Analitiche screen's numbers (FIRE target, wealth, progress, years to FIRE, projections, Monte Carlo across withdrawal rules, historical return, scenarios) are computed **client-side** on web (`lib/analitiche/analytics-context.tsx` -> `buildAnalyticsBase`, `resolveExpectedReturn`, `resolvePlan`, `lib/analitiche/simulation.ts`, `scenario.ts`, `lib/calc/monte-carlo.ts`) from: accounts, transactions for the data period, categories, investments overview (`max`), pension, debts, and net-worth snapshots from `2000-01-01`. A server equivalent (`loadAnalyticsSnapshot`) exists but is only exposed in reduced form through `GET /api/sidebar/fire` and `GET /api/goals` (`fire` block). Native apps must either port these calculations or a new endpoint must be added.
