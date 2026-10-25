# Debts (loans / financing)

Feature area(s): Debiti (overview, debt detail with amortization plan, event log, mark installments paid, early repayment). Available for IT and DE (no country gate).
Source: `app/api/debts/**/route.ts`, `lib/debts/*`, `lib/calc/debt-plan.ts`, `lib/calc/amortization.ts`, `lib/validation/debts.ts`, `lib/db/schema/debts.ts`

## Endpoints

| Method | Path | Purpose | Auth | Notes (job / demo-guard / country-gate) |
|---|---|---|---|---|
| GET | /api/debts | Full computed debts view (plans, totals, next dues, residual series); `?include=insights` adds the overview readings (G12) | session | — |
| POST | /api/debts | Create a loan | session | — |
| PATCH | /api/debts/{id} | Edit name and/or costs | session | — |
| DELETE | /api/debts/{id} | Delete debt + events (cascade) | session | — |
| POST | /api/debts/{id}/events | Add an event (payment, rate change, balance correction, early repayment) | session | — |
| DELETE | /api/debts/{id}/events/{eventId} | Delete an event | session | — |
| POST | /api/debts/{id}/payments/bulk | Mark all overdue unpaid installments up to N as paid | session | — |

None of these routes call `rejectIfDemoActive` or `withCountryGuard`; no country restriction in `isCountryPathAvailable`. No jobs, no `track()`, no cache revalidation, no explicit logs beyond `withRoute`.

"Today" is always `todayIso()` = current **UTC** date (`new Date().toISOString().slice(0,10)`), which drives installment statuses.

Only debts with `kind = "loan"` are exposed/managed. Legacy `credit_line` rows (feature removed) are silently filtered out of `GET` and rejected by event endpoints.

Shared validators (`lib/validation/debts.ts`):
- `dateKey`: `/^\d{4}-\d{2}-\d{2}$/` ("Data non valida").
- `money`: finite number, `>= 0`, `<= 1e9`. `positiveMoney`: finite, `> 0`, `<= 1e9`.
- `annualRate`: number 0..100 (% TAN), message "Tasso non valido".
- `DebtCost`: `{ label: string (trim, 1..80, "Etichetta mancante"); amount: money; kind: "una_tantum" | "per_rata" }`; max 10 costs.
- Limits: name max 80, note max 500, installments max 600.

Path ids are UUIDs. Non-UUID ids are not validated and likely cause a DB error -> `500 { "error": "Errore interno" }` (unverified).

---

## GET /api/debts
Route name: `debts.list` · Auth: session · Guards: none

**Response** `200` — `DebtsViewData` (`lib/debts/view.ts`). All amounts are JSON **numbers** (converted with `Number()`), rounded to 2 decimals where computed.
```ts
interface DebtsViewData {
  debts: DebtView[];        // loans only, ordered by createdAt asc
  overview: DebtsOverview;
}

interface DebtView {
  id: string;
  kind: "loan";
  name: string;
  startMode: "nuovo" | "origine" | "fotografia";
  principal: number;              // disbursed capital (nuovo/origine) or current residual (fotografia)
  annualRate: number;             // TAN %, e.g. 3.25
  installments: number;           // total (nuovo/origine) or remaining (fotografia)
  firstInstallmentDate: string;   // "YYYY-MM-DD" first (or next, for fotografia) due date
  declaredInstallment: number | null; // user-declared installment; null => computed
  anchorDate: string | null;      // only for fotografia
  costs: { label: string; amount: number; kind: "una_tantum" | "per_rata" }[];
  plan: LoanPlan;
  apr: number | null;             // TAEG %, null if not computable
  events: DebtEventView[];        // sorted by date asc
}

interface LoanPlan {
  rows: Array<{
    number: number; dueDate: string; installment: number; interest: number; capital: number;
    residual: number;  // residual after this installment
    status: "pagata" | "da_pagare" | "scaduta" | "da_confermare";
      // pagata = payment recorded; da_pagare = dueDate >= today; past unpaid => "da_confermare" if startMode "origine", else "scaduta"
    payment: { date: string; amount: number; transactionId: string | null } | null;
  }>;
  totals: {
    residual: number; currentInstallment: number; interestToDate: number; interestRemaining: number;
    paidTotal: number; remainingInstallments: number; endDate: string; nextDueDate: string | null;
    overdueCount: number; unconfirmedCount: number; finished: boolean; penaltiesPaid: number;
    closedOn: string | null;     // date an early repayment closed the debt
  };
  residualSeries: { date: string; residual: number }[];
  earlyRepayments: { date: string; amount: number; penalty: number; effect: "reduce_installment" | "reduce_duration"; residualAfter: number }[];
  warnings: string[];            // non-applicable events (Italian text)
}

interface DebtEventView {
  id: string;
  type: "payment" | "rate_change" | "balance_correction" | "early_repayment"; // (DB enum also has draw/repay/interest_charged for legacy credit lines)
  date: string;
  amount: number | null;
  installmentNumber: number | null;
  rate: number | null;
  penalty: number | null;
  effect: "reduce_installment" | "reduce_duration" | null;
  transactionId: string | null;
  note: string | null;           // encrypted at rest, decrypted here
}

interface DebtsOverview {
  totalResidual: number;          // sum of residuals of open loans
  totalDebt: number;              // == totalResidual
  monthlyPayment: number;         // sum of currentInstallment of open loans
  interestToDate: number;         // all loans
  interestRemaining: number;      // all loans
  debtFreeDate: string | null;    // latest endDate among open loans
  openCount: number;
  weightedApr: number | null;     // residual-weighted APR of open loans
  nextDue: { debtId: string; name: string; date: string; amount: number; overdue: boolean }[]; // max 5, by date asc
  residualSeries: { date: string; residual: number }[]; // first point = today, then each future due date
}
```
```json
{ "debts": [ { "id": "d1…", "kind": "loan", "name": "Mutuo casa", "startMode": "nuovo", "principal": 150000, "annualRate": 3.1,
  "installments": 300, "firstInstallmentDate": "2023-02-01", "declaredInstallment": null, "anchorDate": null, "costs": [],
  "plan": { "rows": [ { "number": 1, "dueDate": "2023-02-01", "installment": 718.97, "interest": 387.5, "capital": 331.47,
    "residual": 149668.53, "status": "pagata", "payment": { "date": "2023-02-01", "amount": 718.97, "transactionId": null } } ],
    "totals": { "residual": 139800.12, "currentInstallment": 718.97, "interestToDate": 12000.4, "interestRemaining": 66000.2, "paidTotal": 31635,
      "remainingInstallments": 256, "endDate": "2048-01-01", "nextDueDate": "2026-11-01", "overdueCount": 0, "unconfirmedCount": 0,
      "finished": false, "penaltiesPaid": 0, "closedOn": null },
    "residualSeries": [], "earlyRepayments": [], "warnings": [] },
  "apr": 3.15, "events": [] } ],
  "overview": { "totalResidual": 139800.12, "totalDebt": 139800.12, "monthlyPayment": 718.97, "interestToDate": 12000.4,
    "interestRemaining": 66000.2, "debtFreeDate": "2048-01-01", "openCount": 1, "weightedApr": 3.15,
    "nextDue": [ { "debtId": "d1…", "name": "Mutuo casa", "date": "2026-11-01", "amount": 718.97, "overdue": false } ],
    "residualSeries": [ { "date": "2026-10-18", "residual": 139800.12 } ] } }
```

**Errors:** 401 empty.
**Mobile notes:** the payload can be large (one row per installment, up to 600 per loan). It is the single source for every Debts screen; refetch after any mutation. Web-only client-side helpers exist for previews (`lib/debts/add-form.ts`, `early-repayment-form.ts`, `overview-insights.ts`, `transaction-candidates.ts`); see Gaps.

---

### `?include=insights` (gaps.md G12)

Implemented on branch `feat/mobile-api-foundations` (not merged). Any other `include` value → 400
`{ code: "validation_failed", field: "include" }`. Adds `insights` (`buildDebtsInsights` in `lib/debts/overview-insights.ts`,
`debtsInsightsSchema` in `lib/views`) with the readings the web's Debiti overview computes in the browser. Fixture:
[debts-insights.json](../fixtures/debts-insights.json).

```ts
insights: {
  interestShares: { items: { id; name; yearly /* residual × rate today */; share /* 0-1 */ }[]; total };  // «Dove paghi più interessi», highest first
  repaid: { debtId; share }[];                     // ring/progress: share of principal already repaid (0-1)
  exit: {                                          // «Come uscirne prima» (avalanche: extra to the highest rate)
    loans: { id; name; residual; annualRate; installment }[];   // inputs, if the app wants to run comparePayoffStrategies itself
    slider: { min: 0; max: 1000; step: 50; default: 200 };
    extras: number[];                              // 0, 50, …, 1000
    plans: ({ steps: { id; name; endDate; baselineEndDate; monthsSaved }[]; endDate; baselineEndDate; interestSaved } | null)[];
                                                   // plans[i] = plan with extras[i] per month; null without open loans or if
                                                   // a payment never closes a loan within 600 months
  };
}
```

The slider only indexes into `plans`: nothing to port for the overview. The per-loan «E se…» simulators
(`simulatePayoff`, `compareRefinance`, early repayment) stay ported ([domain/debts.md](../../domain/debts.md)).

## POST /api/debts
Route name: `debts.create` · Auth: session

**Request body** (`application/json`)
```ts
interface CreateDebt {
  name: string;                       // trim, 1..80 ("Il nome è obbligatorio")
  startMode: "nuovo" | "origine" | "fotografia";
  principal: number;                  // > 0, <= 1e9 (residual today if fotografia)
  annualRate: number;                 // 0..100 (%)
  installments: number;               // int 1..600 (remaining if fotografia)
  firstInstallmentDate: string;       // "YYYY-MM-DD" (next due if fotografia)
  installment?: number;               // > 0, <= 1e9; declared installment, else computed
  anchorDate?: string;                // "YYYY-MM-DD"; REQUIRED when startMode = "fotografia"
                                      //   ("Per la fotografia di oggi serve la data della fotografia"); ignored otherwise
  costs?: DebtCost[];                 // default [], max 10
}
```
Stored with `principal.toFixed(2)`, `annualRate.toFixed(4)`, `installment.toFixed(2)`; `kind` forced to `"loan"`.

**Response** `201` `{ "id": "<uuid>" }`

**Errors**
| Status | Body | When |
|---|---|---|
| 400 | `{ error: "<first zod issue>" }` | invalid body |
| 401 | empty | |

**Side effects:** insert `debts`.

---

## PATCH /api/debts/{id}
Route name: `debts.update` · Auth: session

Only name and costs are editable (changing contract terms must be done with events).

**Request body**
```ts
interface UpdateDebt {
  name?: string;     // trim, 1..80
  costs?: DebtCost[];// max 10; replaces the whole array
} // at least one defined, else "Nessuna modifica"
```
**Response** `200` `{ "id": "<uuid>" }`

**Errors:** `400 { error }` (zod); `404 { error: "Debito non trovato" }` (missing or not owned); 401.
**Side effects:** update `name`/`costs` (undefined fields untouched), `updatedAt = now()`.

---

## DELETE /api/debts/{id}
Route name: `debts.delete` · Auth: session

**Response** `204` empty. **Errors:** `404 { error: "Debito non trovato" }`; 401.
**Side effects:** deletes debt; `debt_events` cascade. Linked transactions are NOT touched.

---

## POST /api/debts/{id}/events
Route name: `debts.events.create` · Auth: session

**Request body** — discriminated union on `type`:
```ts
type CreateDebtEvent =
  | { type: "payment"; installmentNumber: number /* int 1..600 */; date: string; amount: number /* >0 */;
      transactionId?: string /* uuid of the user's own transaction (manual link) */; note?: string /* trim, <=500 */ }
  | { type: "rate_change"; date: string; rate: number /* 0..100 % */; note?: string }
  | { type: "balance_correction"; date: string; amount: number /* >=0 schema, but must be >0 (see below) */; note?: string }
  | { type: "early_repayment"; date: string; amount: number /* >0 */; penalty?: number /* >=0, default 0 */;
      effect: "reduce_installment" | "reduce_duration"; note?: string };
```

**Business checks** (`checkEventApplicable`, run against the plan computed at UTC today), each returns 400 `{ error }`:
- debt not a loan: "Questo debito non accetta eventi"
- event type not allowed: "Questo evento non vale per un finanziamento"
- balance_correction with amount <= 0: "Il residuo deve essere maggiore di zero"
- payment: installment number not in plan: "Questa rata non esiste"; already paid: "Questa rata è già segnata come pagata"
- non-payment: date on/after the last installment due date: "La data è dopo l'ultima rata del piano"
- early_repayment on a debt already closed by an earlier one: "Il debito è già stato estinto"

**Response** `201` `{ "id": "<uuid>" }`

**Errors**
| Status | Body | When |
|---|---|---|
| 400 | `{ error }` | zod (first issue) or business check above |
| 404 | `{ error: "Debito non trovato" }` | debt missing / not owned |
| 404 | `{ error: "Transazione non trovata" }` | payment with `transactionId` not owned by the user |
| 401 | empty | |

**Side effects:** insert `debt_events` (amount/penalty `toFixed(2)`, rate `toFixed(4)`, `note` encrypted at rest). A partial unique index allows one `payment` per `(debtId, installmentNumber)`; a concurrent duplicate would surface as 500 (unverified).
**Mobile notes:** to pick a matching transaction for a payment, web uses client-side `lib/debts/transaction-candidates.ts` over already-loaded transactions (no dedicated API).

---

## DELETE /api/debts/{id}/events/{eventId}
Route name: `debts.events.delete` · Auth: session

**Response** `204` empty. **Errors:** `404 { error: "Evento non trovato" }` (no match on eventId + debtId + userId); 401.
**Side effects:** delete row; plan recomputes on next GET.

---

## POST /api/debts/{id}/payments/bulk
Route name: `debts.payments.bulk` · Auth: session

Marks as paid, in one go, all installments that are not `pagata`, have `number <= upToInstallment`, and `dueDate <= today` (UTC), using the plan's due date and installment amount.

**Request body**
```ts
{ upToInstallment: number } // int 1..600
```
**Response** `201` `{ "count": 14 }` (number of payment events created)

**Errors**
| Status | Body | When |
|---|---|---|
| 400 | `{ error: "Numero di rata non valido" }` | any schema failure (fixed message, not the zod issue) |
| 404 | `{ error: "Debito non trovato" }` | |
| 400 | `{ error: "Questo debito non ha rate" }` | debt kind != loan |
| 400 | `{ error: "Nessuna rata scaduta da segnare" }` | no matching rows |
| 401 | empty | |

**Side effects:** multi-row insert into `debt_events` (`type: "payment"`, no note, no transactionId). Rows with status `da_confermare` (origine mode) are included.

## Cross-cutting observations
- Response amounts are JSON **numbers**, not strings (route goes through `buildDebtsView`, which converts `numeric` with `Number()`).
- `POST /payments/bulk` returns a fixed validation message instead of the first zod issue.
- `PATCH /api/debts/{id}` returns `200 { id }`, not the updated object and not 204.
- No demo guard on any debts write route.
