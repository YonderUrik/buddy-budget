# «Dall'ultima visita» (welcome back) and visits

Web #457 (decision `2026-10-19-dall-ultima-visita.md`). A returning user gets one toast per visit with what happened
while away and what waits. A visit ends after 30 minutes without a heartbeat (migration 0046).

## Endpoints
| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/api/welcome` | Records the visit and returns the summary (or null) | session |
| PATCH | `/api/welcome` | `{ "shown": true }`: the toast appeared, not again in this visit on any device | session |
| POST | `/api/visits` | Heartbeat of the open app: `{ newVisit: boolean }` | session |

## GET /api/welcome
Route name: `welcome.get`. It counts as a heartbeat. `summary` is `null` on the first visit, once shown in this visit,
or when there is nothing to say.
```ts
interface WelcomeResponse {
  summary: {
    since: string;                 // ISO-8601, end of the previous visit
    happened: WelcomeItem[];       // kinds: movements, price_alerts, price_rises
    waiting: WelcomeItem[];        // kinds: to_decide, subscriptions, import_review
  } | null;
}
interface WelcomeItem { kind: string; count: number; jobId?: string } // jobId only for import_review
```
## PATCH /api/welcome
Route name: `welcome.shown` · body `{ "shown": true }` · `204`; `400 { error: "Dati non validi" }` otherwise.

## POST /api/visits
Route name: `visits.heartbeat` · no body · `{ "newVisit": boolean }`. The shared public demo always answers `false`.

## Mobile notes (SHELL-058/059)
- First call: `GET /api/welcome` on shell start; then `POST /api/visits` every 5 minutes while in the foreground and on
  returning to the foreground, throttled to one per minute; `newVisit: true` → `GET /api/welcome` again.
- The toast (info, 10 s) shows one line per group joined with the locale's list format (`WelcomeText`), with the action
  of the first waiting item (`Decidi`/`Controlla`/`Apri`) or `Vedi` on the first thing that happened; then `PATCH`.
- Paths: movements → `/liquidita`, price_alerts → `/investimenti/titoli`, price_rises/subscriptions →
  `/liquidita/abbonamenti`, to_decide → `/categorizza`, import_review → `/importazioni?job={jobId}`.
