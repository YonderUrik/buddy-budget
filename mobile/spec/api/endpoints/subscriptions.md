# Subscriptions (recurring charges)

Feature area(s): Abbonamenti (detected subscriptions to confirm/exclude, confirmed list with totals, upcoming charges, price rises, manual subscriptions). Available for IT and DE (no country gate).
Source: `app/api/subscriptions/**/route.ts`, `lib/subscriptions/data.ts`, `lib/subscriptions/view.ts`, `lib/calc/subscriptions.ts`, `lib/validation/subscriptions.ts`, `lib/db/schema/subscriptions.ts`

## Endpoints

| Method | Path | Purpose | Auth | Notes (job / demo-guard / country-gate) |
|---|---|---|---|---|
| GET | /api/subscriptions | Detected (from last 26 months of expenses) + saved decisions + manual, with totals and merchant logos | session | computed on the fly |
| POST | /api/subscriptions | Save a decision on a detected subscription (upsert by key) or add a manual one | session | — |
| PATCH | /api/subscriptions/{id} | Edit a saved decision/manual subscription | session | — |
| DELETE | /api/subscriptions/{id} | Remove decision (detected goes back to "da-confermare") or delete manual | session | — |

No `rejectIfDemoActive`, no `withCountryGuard`, no jobs, no cache revalidation. Metrics only: `recordSubscriptionAction(action)` (`confirmed|excluded|ended|added|updated|removed|restored`) and `recordSubscriptionsDetect(durationMs)`.

Model: detection is **not persisted**. The `subscriptions` table stores only user decisions (`confermato`, `escluso`, `terminato`) and manual subscriptions, joined to detected ones by a stable `key` (merchant key without digit tokens, `subscriptionKey()` in `lib/calc/subscriptions.ts`).

Enums:
- `SubscriptionStatus`: `"confermato" | "escluso" | "terminato"`
- `SubscriptionDecision` (view): `"da-confermare" | SubscriptionStatus`
- `SubscriptionCadence`: `"settimanale" | "mensile" | "trimestrale" | "semestrale" | "annuale"`
- `origin`: `"rilevato" | "manuale"`

---

## GET /api/subscriptions
Route name: `subscriptions.list` · Auth: session

`loadSubscriptions(userId)`: reads expenses (`amount < 0`) of the last 26 months (`SUBSCRIPTION_LOOKBACK_MONTHS`), excluding categories of type `futuro`, `entrata`, `trasferimento`; runs `detectSubscriptions`; merges saved rows; attaches merchant logos.

**Response** `200`
```ts
interface SubscriptionsResponse {
  items: SubscriptionItem[];     // sorted by nextDate asc (null last)
  totals: {
    count: number;               // confirmed AND activity "attivo" (with monthly != null)
    monthly: number;             // sum of their monthly equivalents
    yearly: number;              // monthly * 12
    pendingCount: number;        // "da-confermare" and active
    pendingMonthly: number;
  };
  currency: string;              // user's currency, default "EUR"
  today: string;                 // server UTC date "YYYY-MM-DD"
}

interface SubscriptionItem {
  key: string;                   // stable key; used to POST decisions
  id: string | null;             // saved row id; null until the user decides
  name: string;                  // user name, else detected merchant name (else key)
  origin: "rilevato" | "manuale";
  decision: "da-confermare" | "confermato" | "escluso" | "terminato";
  activity: "attivo" | "fermo";  // fermo = expected charge missed beyond grace days (stored-only detected rows are always "fermo"; manual always "attivo")
  cadence: SubscriptionCadence | null;
  amount: number | null;         // last charge amount (detected) or declared amount (manual)
  monthly: number | null;        // monthly equivalent
  lastDate: string | null;       // "YYYY-MM-DD"
  nextDate: string | null;       // expected next charge; for manual rows rolled forward past today
  overdueDays: number;
  priceChange: { from: number; to: number; since: string } | null;
  charges: { id: string; date: string; amount: number }[]; // matched transactions (amount positive), [] for stored-only
  reasons: Array<                // explanation chips for the detail sheet
    | { kind: "count"; count: number }
    | { kind: "cadence"; cadence: SubscriptionCadence; skipped: boolean }
    | { kind: "amount"; mode: "costante" | "variabile-lieve" }
    | { kind: "price-change"; from: number; to: number; since: string }
    | { kind: "day"; day: number }>;
  confidence: number | null;     // 0..1 (>= 0.6 to be proposed); null for stored-only
  categoryId: string | null;
  logoPath: string | null;       // relative URL, e.g. "/api/merchant-logos/netflix.com" or ".../name/<enc>?s=<sig>"; null => show initial
}
```
All amounts here are JSON **numbers**.
```json
{ "items": [ { "key": "netflix", "id": "5b1…", "name": "Netflix", "origin": "rilevato", "decision": "confermato", "activity": "attivo",
  "cadence": "mensile", "amount": 13.99, "monthly": 13.99, "lastDate": "2026-10-03", "nextDate": "2026-11-03", "overdueDays": 0,
  "priceChange": { "from": 12.99, "to": 13.99, "since": "2026-04-03" },
  "charges": [ { "id": "t1…", "date": "2026-10-03", "amount": 13.99 } ],
  "reasons": [ { "kind": "count", "count": 12 }, { "kind": "cadence", "cadence": "mensile", "skipped": false } ],
  "confidence": 0.93, "categoryId": "c1…", "logoPath": "/api/merchant-logos/netflix.com" } ],
  "totals": { "count": 1, "monthly": 13.99, "yearly": 167.88, "pendingCount": 0, "pendingMonthly": 0 },
  "currency": "EUR", "today": "2026-10-18" }
```
**Errors:** 401 empty.
**Mobile notes:** `logoPath` is relative to the web origin; prefix with the API base URL and send the session cookie (see merchant-logos doc). "Upcoming charges" (next 30 days, `UPCOMING_WINDOW_DAYS`) and "recent price rises" (within 365 days) are filtered client-side on web via `upcomingCharges()` / `recentPriceRises()` in `lib/subscriptions/view.ts`; native must reimplement.

---

## POST /api/subscriptions
Route name: `subscriptions.save` · Auth: session

**Request body** — discriminated union on `origin`:
```ts
type CreateSubscription =
  | { // decision on a detected item (snapshot of what the user saw)
      origin: "rilevato";
      key: string;                 // trim 1..200 (item.key from GET)
      status: "confermato" | "escluso" | "terminato";
      name: string;                // trim 1..80 ("Dai un nome all'abbonamento", "Il nome è troppo lungo")
      amount: number;              // > 0 ("L'importo deve essere maggiore di zero"), <= 100000
      cadence: SubscriptionCadence;
      categoryId?: string | null;  // uuid, must be the user's category
    }
  | { // manual subscription
      origin: "manuale";
      name: string; amount: number; cadence: SubscriptionCadence;
      nextDate: string;            // "YYYY-MM-DD" next charge
      categoryId?: string | null;
    };
```
Behaviour:
- `rilevato`: insert; on conflict `(userId, key)` **only `status` and `updatedAt` are updated** (name/amount/cadence/category from the first save are kept). Returns **200**.
- `manuale`: `key = subscriptionKey(name)`; empty key -> 400 "Il nome non è valido"; existing row with same key -> 409. Status forced `confermato`. Returns **201**.

**Response** — the raw DB row (`StoredSubscription`):
```ts
interface StoredSubscription {
  id: string; userId: string; key: string;
  status: "confermato" | "escluso" | "terminato";
  origin: "rilevato" | "manuale";
  name: string | null;
  amount: string | null;     // STRING numeric, e.g. "13.99"
  cadence: SubscriptionCadence | null;
  nextDate: string | null;   // "YYYY-MM-DD" (manual only)
  categoryId: string | null;
  createdAt: string; updatedAt: string; // ISO-8601
}
```
```json
{ "id": "5b1…", "userId": "u_…", "key": "netflix", "status": "confermato", "origin": "rilevato", "name": "Netflix",
  "amount": "13.99", "cadence": "mensile", "nextDate": null, "categoryId": null,
  "createdAt": "2026-10-18T10:00:00.000Z", "updatedAt": "2026-10-18T10:00:00.000Z" }
```

**Errors**
| Status | Body | When |
|---|---|---|
| 400 | `{ error: "<first zod issue>", code: "validation_failed", field: "<path>" }` | invalid body |
| 400 | `{ error: "Il nome non è valido", code: "validation_failed", field: "name" }` | manual name yields empty key |
| 404 | `{ error: "Categoria non trovata", code: "category_not_found" }` | categoryId not owned |
| 409 | `{ error: "Hai già un abbonamento con questo nome", code: "subscription_exists" }` | manual key already exists |
| 401 | empty | |

---

## PATCH /api/subscriptions/{id}
Route name: `subscriptions.update` · Auth: session

**Request body** — partial, at least one field ("Nessuna modifica"):
```ts
{
  status?: "confermato" | "escluso" | "terminato";
  name?: string;              // trim 1..80
  amount?: number;            // >0, <=100000
  cadence?: SubscriptionCadence;
  nextDate?: string;          // "YYYY-MM-DD"
  categoryId?: string | null; // null clears
}
```
**Response** `200` — updated raw row (`StoredSubscription`, `amount` as string).

**Errors**
| Status | Body | When |
|---|---|---|
| 404 | `{ code: "not_found" }` (generic code, see README §5) | row missing / not owned (checked before parsing body) |
| 400 | `{ error }` | zod |
| 404 | `{ error: "Categoria non trovata" }` | |
| 401 | empty | |

---

## DELETE /api/subscriptions/{id}
Route name: `subscriptions.delete` · Auth: session

**Response** `204` empty.
**Errors:** 404 empty body; 401.
**Side effects:** deletes the row. For `origin = "rilevato"` this "restores" the item to `da-confermare` (it will be detected again); for `manuale` it deletes the subscription.

## Cross-cutting observations
- GET returns amounts as numbers; POST/PATCH return raw Drizzle rows with `amount` as **string** and include `userId`.
- 404 for unknown id on PATCH/DELETE has an **empty body**.
- POST status code differs by branch: 200 for detected decision (upsert), 201 for manual creation.
