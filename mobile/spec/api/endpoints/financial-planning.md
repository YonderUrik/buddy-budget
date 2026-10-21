# Financial planning (country-specific planning document — Germany)

Feature area(s): DE-only planning screens that replace the Italian ones: Pension (`/pensione`), Retirement (`/analitiche`), Investment tax (`/investimenti/tasse`), Investment income (`/investimenti/proventi`). Web UI: `components/domain/financial-planning/*` (`planning-screen.tsx` loads/saves).
Source: `app/api/financial-planning/route.ts`, `lib/financial-planning/*` (`schema.ts`, `registry.ts`), `lib/db/schema/financial-plans.ts`

## Endpoints

| Method | Path | Purpose | Auth | Notes (job / demo-guard / country-gate) |
|---|---|---|---|---|
| GET | /api/financial-planning | Load the user's planning document for their product country | session | Only DE has a model; IT -> 403 |
| PUT | /api/financial-planning | Replace the document with optimistic concurrency (`revision`) | session | Only DE; 409 on stale revision |
| GET | /api/financial-planning?include=results | Document + computed results of the enabled sections | session | Only DE (branch `feat/mobile-api-foundations`) |
| POST | /api/financial-planning/results | Results of an unsaved plan (pure, no writes) | session | Only DE (branch `feat/mobile-api-foundations`) |

Country handling is **inverted** relative to other gated resources: the proxy explicitly allows `/api/financial-planning` for DE; the handler resolves `planningModel(productCountry)` from `PLANNING_MODELS = { DE: { schema: germanPlanSchema, version: 1, currency: "EUR" } }`. For IT users (no model) the handler returns `403 { "code": "country_feature_unavailable", "error": "<localized>" }`, the same body as `withCountryGuard` (fixed on branch `feat/mobile-api-foundations`; before, the code was in `error` and there was no `code`). `GET /api/me/bootstrap` `capabilities.sections.financialPlanning` is now false for IT.

Not wrapped by `withCountryGuard`; uses `sessionOrUnauthorized` (401 empty body). No demo guard, no jobs, no metrics besides logs `financial_plan.saved` / `financial_plan.save.conflict`.

Storage: table `financial_plans` (PK `(user_id, country)`), `data` jsonb, `revision` int (default 0), `updated_at`.

---

## GET /api/financial-planning
Route name: `financial_plan.get` · Auth: session

**Response** `200`
```ts
{ plan: GermanPlan; revision: number } // revision 0 when nothing saved yet; plan = schema defaults applied to stored data (or {})
```
Stored data is re-parsed through `germanPlanSchema` on every read (defaults filled). If stored data became invalid against the current schema, `parse` throws -> `500 { error: "Errore interno" }` (unverified edge case).

**Errors**
| Status | Body | When |
|---|---|---|
| 401 | empty | no session |
| 403 | `{ code: "country_feature_unavailable", error }` | product country has no planning model (IT) |

---

## PUT /api/financial-planning
Route name: `financial_plan.update` · Auth: session

**Request body** (`application/json`, **strict** — unknown keys rejected at every level)
```ts
{ plan: GermanPlan; revision: number /* int >= 0: the revision the client last loaded */ }
```

`GermanPlan` (`lib/financial-planning/schema.ts`, all objects `.strict()`, every field has a default so `{}` is valid input). `money` = finite number 0..1e12; `rate` = 0..1; rates are fractions (0.02 = 2%).
```ts
interface GermanPlan {
  version: 1;                       // default 1
  country: "DE";                    // default "DE"; must equal the user's productCountry
  tax: {
    year: 2026;                     // literal
    futureForecast: "verified" | "constant-2026";   // default "verified"
    joint: boolean;                 // default false
    churchRate: 0 | 0.08 | 0.09;    // default 0
    allowanceUsedElsewhere: money; shareLosses: money; generalLosses: money;
    otherCapitalIncome: money; verifiedForeignCredit: money;     // all default 0
    historyConfirmed: boolean;      // default false
    fundKinds: Record<string /*<=100*/, FundKind>;              // default {}
    priorAdvancesBySale: Record<string /*<=100*/, money>;       // default {}
    fundHistoryConfirmed: boolean;  // default false
  };
  fund: { kind: FundKind /*"unknown"*/; startValue: money; endValue: money; distributions: money; acquisitionMonth: number /*int 1..12, default 1*/ };
  pensions: PensionPlan[];          // max 100, default []
  pensionTax: {
    mode: "manual" | "rules";       // default "manual"
    insurance: "kvdr" | "voluntary" | "private";   // default "kvdr"
    additionalHealthRate: number;   // 0..0.1, default 0.029
    childless: boolean; childrenUnder25: number /*int 0..20*/;
    otherInsuranceIncome: money; voluntarySubsidy: boolean;
    annualPrivatePremium: money; annualDeductiblePremium: money; surchargeChildAllowance: money;
    otherTaxableIncome: money; otherDeductions: money;
  };
  retirement: {
    liquidCapital: money; annualSaving: money; annualSpending: money;
    yearsUntilRetirement: number;   // int 0..80
    realReturn: number;             // -0.5..0.3, default 0.02
    withdrawalRate: number;         // 0.005..0.2, default 0.035
    inflation: number;              // 0..0.2, default 0.02
    pensionDeductionRate: number;   // 0..1, default 0.25
    withdrawalTaxShare: number;     // 0..0.9, default 0
  };
  crypto: CryptoSale[];             // max 1000, default []
  cryptoOtherGains: number;         // -1e12..1e12, default 0
  cryptoLossCarryforward: money;
  otherTaxableIncome: money;
}
type FundKind = "unknown" | "equity" | "mixed" | "property" | "foreign-property" | "other";

interface PensionPlan {
  id: string;                       // 1..100, unique within pensions
  name: string;                     // trim 1..100
  kind: "statutory" | "occupational" | "riester" | "ruerup" | "private" | "avd";
  capital: money; monthlyContribution: money; monthlyGross: money;
  yearsUntilPayment: number;        // int 0..80
  nominalReturn: number;            // -0.5..0.3
  points: number;                   // 0..1000 (statutory pension points)
  annualPoints: number;             // 0..10
  accessFactor: number;             // 0..2, default 1
  taxTreatment: "unknown" | "funded" | "private-annuity" | "statement";   // default "unknown"
  taxableAnnualFromStatement: money;
  pensionStartYear: number | null;  // int 1900..2200, default null
  taxFreeAnnualAmount: money | null;// default null
  ageAtPayment: number;             // int 0..120, default 67
  avd: {
    enabled: boolean; contributionStartYear: number /*2027..2100*/;
    eligibility: "none" | "direct" | "indirect";
    spouseAnnualContribution: number /*0..6840*/;
    childAllowanceYears: number[] /*ints 0..30, max 20*/;
    starterBonus: boolean; ageAtStart: number /*18..100, default 40*/;
    taxableIncomeBeforeDeduction: money;
    payout: "provider" | "drawdown"; payoutStartAge: number /*65..70, default 67*/; payoutEndAge: number /*85..120, default 85*/;
    lumpSumRate: number /*0..0.3*/; payoutReturn: number /*-0.5..0.3*/;
  };                                // refine: drawdown requires payoutEndAge > payoutStartAge
  paymentMode: "income" | "capital";// default "income"
}
// PensionPlan refinements: kind "avd" with avd.enabled => monthlyContribution*12 <= 6840;
// kinds statutory/ruerup/riester/avd => paymentMode must be "income".

interface CryptoSale {
  id: string /*1..100, unique*/; name: string /*trim 1..100*/;
  acquired: string; sold: string;   // ISO dates "YYYY-MM-DD"; sold >= acquired; sold must start with "2026-"
  proceeds: money; cost: money; fees: money /*default 0*/;
}
// Plan-level superRefine: at most one enabled AVD pension; for each enabled AVD:
// yearsUntilPayment == payoutStartAge - ageAtStart + contributionStartYear - tax.year, and tax.year + yearsUntilPayment > contributionStartYear;
// pensionTax.childless with childrenUnder25 > 0 is invalid; duplicate ids in pensions/crypto invalid.
```

**Behaviour:** in a transaction, ensure a row exists (insert defaults, `onConflictDoNothing`), then `UPDATE ... SET data = plan, revision = revision + 1 WHERE user, country AND revision = <sent revision>`. If no row updated -> 409.

**Response** `200` `{ plan: GermanPlan /* as sent, after zod defaults */, revision: number /* new revision */ }`

**Errors**
| Status | Body | When |
|---|---|---|
| 400 | `{ error: "invalid_plan", code: "invalid_plan" }` | any schema failure, unknown key, or `plan.country !== productCountry`. **No details**: the web client validates locally with `germanPlanSchema` first to show field errors |
| 403 | `{ code: "country_feature_unavailable", error }` | no model for the user's country |
| 409 | `{ error: "plan_changed", code: "plan_changed" }` | `revision` is stale (another device saved first) |
| 401 | empty | no session |

**Side effects:** upsert/update `financial_plans`.

**Mobile notes**
- Optimistic concurrency: always send the `revision` received from the last GET/PUT; on 409 reload and let the user re-apply.
- Validate locally with the full schema (port of `germanPlanSchema`) to give field-level errors, as web does.
- Every error body has a stable `code` (`invalid_plan`, `plan_changed`, `country_feature_unavailable`); `error` stays a machine string except the localized 403.
- All computations (tax: `germanCapitalTax`, `germanFundAdvance`, `germanCrypto`, `germanIncomeTax`; pension: `projectGermanPension`, `germanPensionNet`, AVD helpers; retirement: `germanRetirement`; portfolio/income: `germanPortfolioReport`, `germanIncomeForecast`) run **client-side** on web from this document plus investments data; there is no API returning computed results. Web also requires the investments overview currency to be `EUR`.

## Computed results (`?include=results`, `POST /api/financial-planning/results`)

Implemented on branch `feat/mobile-api-foundations`. Source: `lib/views/financial-planning.ts` (`buildPlanningResults`,
pure), `lib/views/financial-planning.server.ts`, `app/api/financial-planning/results/route.ts`. The web computes these in
the browser from the plan and `GET /api/investments/overview?period=max` (all brokers); the server now runs the same
`lib/financial-planning` functions, for the sections the rollout switches enable (`isPlanningAvailable`, today: tax and
income). `today` is the UTC day, as on the web.

- `GET /api/financial-planning?include=results` → `{ plan, revision, results }` for the saved plan. Any other `include`
  → 400 `validation_failed`. Fixture: [financial-planning-results-de.json](../fixtures/financial-planning-results-de.json)
  (German demo user; `historyConfirmed: false`, so the estimate is null and `issues` explain why).
- `POST /api/financial-planning/results` body `{ plan }` (a full `germanPlanSchema` document) → `results` for an
  **unsaved** plan: call it debounced while the user edits the tax profile; nothing is saved (save with PUT). 400
  `validation_failed` for a bad body, `invalid_plan` when `plan.country` ≠ product country, 403 for IT. Fixture:
  [financial-planning-results-preview-de.json](../fixtures/financial-planning-results-preview-de.json) (same plan with
  `historyConfirmed: true`).

```ts
interface PlanningResults {
  currency: string;
  supported: boolean;                 // false when the account currency is not EUR (web: «requires account currency EUR»); tax/income null
  sections: { tax; income; pension; retirement; simulations: boolean };   // rollout switches (DE today: tax, income)
  tax: {
    report: {                         // germanPortfolioReport(data, plan.tax, today): FIFO per custody account
      events: { id; instrumentId; date; gain; taxable; basket: "shares" | "general" }[];
      issues: { instrumentId: string; reason: "currency" | "history" | "classification" | "fund-history" | "legacy" | "unsupported" | "missing-lots" | "invalid" }[];  // estimate is null while any issue exists
      recordedTaxes: number; shareGains: number; generalIncome: number;
      estimate: { taxable; foreignCredit; usedAllowance; remainingAllowance; capitalTax; solidarity; church; total;
                  remainingShareLosses; remainingGeneralLosses } | null;
    };
    fundAdvance: { gross; taxable; receiptYear } | null;   // Vorabpauschale scenario, only with simulations
    fundInstrumentIds: string[];      // funds/ETFs to classify (plan.tax.fundKinds)
    fundSaleIds: string[];            // 2026 fund sales that take prior advances (plan.tax.priorAdvancesBySale)
  } | null;
  income: {                           // germanIncomeForecast; futureForecast forced to "verified" without simulations
    events: { instrumentId; kind; date; gross; net: number | null; benchmark: boolean; basis }[];
    totalGross: number; bondsWithoutTerms: string[];
    history: { year; months; gross; withheld; net }[];
    issues: unknown[];
  } | null;
}
```

The editors (tax profile form, crypto, pension/AVD/retirement when enabled) stay on the device
([domain/financial-planning-de.md](../../domain/financial-planning-de.md)); the DE sale simulator is hidden by the
`simulations` switch and has no endpoint yet.

## Cross-cutting observations
- Error body uses machine codes in `error` (no `code` field, not localized), unlike the rest of the API.
- 403 for the "wrong country" case is the opposite gate: IT users are refused here.
