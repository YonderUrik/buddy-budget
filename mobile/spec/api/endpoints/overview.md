# Overview (Panoramica) view

Feature area(s): Overview tab — net-worth hero and chart, "Dove sta il patrimonio" composition, month pace card,
voice sentences, investments pulse, upcoming dues, bank renewal banner ([features/02-overview.md](../../features/02-overview.md))
Source: `app/api/overview/route.ts`, `lib/views/overview.ts` (`buildOverviewView`, pure), `lib/views/overview.server.ts`
(`loadOverviewView`), `lib/views/schemas.ts` (`overviewViewSchema`, zod)
Status: implemented on branch `feat/mobile-api-foundations` of `buddy-budget` (gaps.md **G2**). Not merged yet.

The server runs **the same functions as `app/(app)/panoramica/page.tsx`** on the same data its queries fetch:
`computeAccountsKpi`, `buildInvestmentsView(…, "1mese", today)` + `computeValueBreakdown`, `pensionTotalOn`,
`buildNetWorthSeries` / `excludeClassFromSeries` / `computeNetWorthChange`, `buildCompositionItems`,
`computeMonthPace`, `buildVoiceLines`, `buildRenewalAlerts` + `describeRenewalAlert`. Nothing is re-implemented, so
the app shows the web's numbers. Port nothing of this on the client.

## Endpoints

| Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|
| GET | `/api/overview` | Everything the Overview tab computes, in one call | session (Bearer) | `maxDuration` 60 s (runs the investments engine); not country-gated (pension is left out where unavailable) |

Separate calls the Overview still needs (independent cards, unchanged): `GET /api/start` («Primi passi», demo offer),
`GET /api/goals` (goals tile, IT only — `capabilities.sections.goals`), what's-new (bundle, gaps.md G14).

---

## GET /api/overview

Route name: `overview.view` · Auth: session required · Guards: proxy gates (deactivated / legal → coded 403)

**Query params**

| Name | Type | Required | Default | Notes |
|---|---|---|---|---|
| period | string | no | `3mesi` | chart window: `1mese` \| `3mesi` \| `1anno` \| `max` (same as the web's period selector) |
| includePension | `0` \| `1` | no | `1` | `0` removes pension from the totals (`series[].value`, `change`, composition shares); `byClass.previdenza` stays so the chart can draw it greyed. The web keeps this per device (`use-pension-in-net-worth`); the app keeps it as a local setting and passes it |
| today | `YYYY-MM-DD` | no | server's day | **send the device's local day** (the web uses the browser's). Drives the month, the last series point and "due in N days" |

**Response** `200` — `OverviewView` (validated by `overviewViewSchema`). Money is **JSON numbers** (computed floats),
dates `YYYY-MM-DD`. Fixtures: [overview.json](../fixtures/overview.json) (demo user, `3mesi`),
[overview-1anno-no-pension.json](../fixtures/overview-1anno-no-pension.json).

```ts
interface OverviewView {
  currency: string;                      // user currency, every amount is in it
  today: string;                         // the day used
  period: "1mese" | "3mesi" | "1anno" | "max";
  includePension: boolean;
  isEmpty: boolean;                      // no account, no investments, no pension → show «Primi passi» + demo offer (GET /api/start)
  todayByClass: Record<"liquidita" | "investimenti" | "previdenza" | "debiti", number>; // only classes present; debiti negative
  series: { date: string; value: number; byClass: Record<string, number>; isEstimated: boolean }[]; // oldest first, last point = today
  change: { start: number; end: number; delta: number; deltaPct: number | null };   // first vs last point of `series`
  composition: {
    key: "liquidita" | "investimenti" | "previdenza" | "debiti";
    label: string;                       // localized class name
    detail: string;                      // localized ("4 conti", "13 posizioni", "1 fondo · fuori dal totale")
    amount: number;                      // debiti negative
    share: number;                       // 0–1 of the positive total (0 for debts and excluded pension)
    isLiability: boolean;
    highlight: { amount: number; ratio: number | null; label: string } | null; // investments: market gain and ratio on paid ("dal mercato", localized)
  }[];
  monthLabel: string;                    // localized month name ("ottobre")
  monthPace: {                           // computeMonthPace: this month vs the average of the last 3 months at the same day
    spentSoFar: number; typicalSoFar: number | null; income: number;
    budgetTotal: number | null; budgetSpent: number;  // budgetSpent = spend on budgeted categories only
    dayOfMonth: number; daysInMonth: number;
    current: number[];                   // cumulative spend per day, 1..today
    typical: number[] | null;            // average cumulative curve, 1..daysInMonth (null without history)
  };
  voice: { key: "pace" | "due"; segments: { text: string; strong?: boolean }[] }[]; // localized sentences; render `strong` emphasized
  investments: { value: number; positions: number; paid: number; marketGain: number } | null; // null without investment operations
  pension: { value: number; funds: number; included: boolean } | null;                    // null without snapshots or outside IT
  debts: { total: number; count: number; debtFreeDate: string | null;
           nextDue: { debtId: string; name: string; date: string; amount: number; overdue: boolean }[] } | null; // up to 5
  renewalAlerts: { connectionId: string; institutionName: string; state: "expiring" | "expired" | "error";
                   daysLeft: number | null; message: string }[];   // message = localized banner sentence
}
```

The greeting ("Buongiorno, Giulia") is **not** included: it depends on the device clock; build it locally from
`greetingFor(hour)` strings (catalog) and `user.name`.

Example (trimmed: two series points, four curve values, one due):

```json
{
  "currency": "EUR", "today": "2026-10-18", "period": "3mesi", "includePension": true, "isEmpty": false,
  "todayByClass": { "liquidita": 23915.34, "investimenti": 71038.29324820726, "previdenza": 11082.07, "debiti": -39937.23 },
  "series": [
    { "date": "2026-07-18", "value": 69569.58, "byClass": { "previdenza": 10337.39, "debiti": -41749.56, "investimenti": 77486.41, "liquidita": 23495.34 }, "isEstimated": true },
    { "date": "2026-10-18", "value": 66098.47, "byClass": { "liquidita": 23915.34, "investimenti": 71038.29324820726, "previdenza": 11082.07, "debiti": -39937.23 }, "isEstimated": false }
  ],
  "change": { "start": 69569.58, "end": 66098.47, "delta": -3471.1100000000006, "deltaPct": -0.04989407726767936 },
  "composition": [
    { "key": "liquidita", "label": "Liquidità", "detail": "4 conti", "amount": 23915.34, "share": 0.2255404478623509, "isLiability": false, "highlight": null },
    { "key": "investimenti", "label": "Investimenti", "detail": "13 posizioni", "amount": 71038.29324820726, "share": 0.6699469242159085, "isLiability": false,
      "highlight": { "amount": 7048.765114094407, "ratio": 0.11015497878529759, "label": "dal mercato" } },
    { "key": "previdenza", "label": "Previdenza", "detail": "1 fondo", "amount": 11082.07, "share": 0.10451262792174074, "isLiability": false, "highlight": null },
    { "key": "debiti", "label": "Debiti", "detail": "3 debiti", "amount": -39937.23, "share": 0, "isLiability": true, "highlight": null }
  ],
  "monthLabel": "ottobre",
  "monthPace": { "spentSoFar": 2163.83, "typicalSoFar": 1355.9733333333334, "income": 0, "budgetTotal": 780, "budgetSpent": 398.83000000000004,
                 "dayOfMonth": 18, "daysInMonth": 31, "current": [0, 428, 428, 428], "typical": [0, 0, 39.416666666666664, 39.416666666666664] },
  "voice": [
    { "key": "pace", "segments": [ { "text": "Ottobre è partito sopra il solito: " }, { "text": "2164 €", "strong": true }, { "text": " spesi, " },
                                   { "text": "808 € in più", "strong": true }, { "text": " della tua media a questo punto." } ] },
    { "key": "due", "segments": [ { "text": "La rata Cucina e lavatrice scade il 20 ottobre: " }, { "text": "113 €", "strong": true }, { "text": "." } ] }
  ],
  "investments": { "value": 71038.29324820726, "positions": 13, "paid": 63989.52813411287, "marketGain": 7048.765114094407 },
  "pension": { "value": 11082.07, "funds": 1, "included": true },
  "debts": { "total": 39937.23, "count": 3, "debtFreeDate": "2033-09-05",
             "nextDue": [ { "debtId": "82e1d634-68ff-4b84-a465-e0ea85358c67", "name": "Cucina e lavatrice", "date": "2026-10-20", "amount": 112.86, "overdue": false } ] },
  "renewalAlerts": [ { "connectionId": "f4ba9de6-444c-4fb3-b5ef-d3f3e6cfe2b4", "institutionName": "Banca Demo", "state": "expiring", "daysLeft": 6,
                       "message": "Il collegamento con Banca Demo scade tra 6 giorni." } ]
}
```

**Errors** (every error body has a stable `code`, see [README §5](../README.md#5-error-format))

| Status | Body | When |
|---|---|---|
| 401 | empty | no / invalid session |
| 403 | `{ "code": "account_deactivated" }` / `{ "code": "legal_acceptance_required", "version" }` | proxy gates |
| 400 | `{ "error": "period deve essere uno tra 1mese, 3mesi, 1anno, max", "code": "invalid_period", "field": "period" }` | unknown period |
| 400 | `{ "error": "today deve avere formato YYYY-MM-DD", "code": "invalid_date", "field": "today" }` | malformed `today` |
| 500 | `{ "error": "Errore interno", "code": "internal_error" }` | unexpected |

**Partial data**: like the web page, investments, debts, pension and bank connections are optional. If one of them
fails to load, it is left out (`null` / `[]`) and the rest is still returned (server log `overview.view.partial`).

**Side effects**: the same as `GET /api/net-worth/snapshots` (rebuilds missing or stale derived net-worth history).

## Mobile notes

- Call on tab open, on pull-to-refresh, and after any mutation that changes balances, transactions, investments,
  debts or pension. Cache per `(period, includePension)`; switching period is a new call (the payload is small:
  ~19 KB for `3mesi`, the series is daily up to a year and monthly beyond, as the web's `compact` history).
- `series[].isEstimated = true` points are reconstructed history (draw them as the web does, e.g. lighter).
- `amount` sign: debts are negative everywhere (`todayByClass.debiti`, `composition[debiti].amount`, `byClass.debiti`).
- Format numbers locally (`it-IT` / `en-GB` / `de-DE`); the only pre-formatted strings are `label`, `detail`,
  `highlight.label`, `monthLabel`, `voice` and `renewalAlerts[].message` (already in the user's language). Respect
  `hideAmounts`: the `voice` sentences contain amounts — mask the `strong` segments when amounts are hidden.
