# Client errors (crash reporting)

Feature area(s): global — error boundaries of every screen (web `error.tsx` / `global-error.tsx`)
Source: `app/api/client-errors/route.ts`, `lib/client-errors/{constants,quota,report}.ts`

## Endpoints

| Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|
| POST | `/api/client-errors` | Report a client-side rendering crash to server logs/metrics | session | rate-limited 20 / 10 min (Redis) |

## POST /api/client-errors
Route name: `client_errors.report` · Auth: session cookie required (crashes before login cannot be reported)

**Request body** (`clientErrorSchema`)
```ts
interface ClientErrorReport {
  kind: "sezione" | "globale";   // screen-level boundary vs root/global crash
  area: "panoramica" | "liquidita" | "conti" | "investimenti" | "debiti" | "pensione" | "analitiche"
      | "categorizza" | "importazioni" | "impostazioni" | "aiuto" | "onboarding" | "altro";  // first path segment, never the full path
  name?: string;                 // max 80 (error class name)
  message: string;               // max 500 (server redacts and truncates in logs)
  digest?: string;               // max 64 (web: Next.js error digest; mobile: could be a crash id)
}
```

**Response** `204`.

**Errors**: `401` empty; `400` EMPTY body (validation — note: no JSON); `429` EMPTY body (> `CLIENT_ERROR_RATE_LIMIT = 20` per `CLIENT_ERROR_RATE_WINDOW_SECONDS = 600` per user, Redis key `client-errors:{userId}`, fails open).

**Side effects**: log at level `error` (`client.error.reported`) and metric `buddybudget_client_errors_total{kind,area,outcome}`. Nothing stored in DB.

**Mobile notes**: optional; areas are a closed enum used as metric labels — map native screens to the nearest area or `"altro"`. Do not send PII in `message`. Fire-and-forget; ignore failures.
