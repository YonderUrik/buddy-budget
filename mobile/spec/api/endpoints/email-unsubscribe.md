# Email unsubscribe (public, token-based)

Feature area(s): links in notification emails (digest, budget/deadline/goal alerts); web page `/disiscrizione`; mail-client one-click unsubscribe (RFC 8058)
Source: `app/api/email/unsubscribe/route.ts`, `lib/notifications/token.ts`, `lib/notifications/store.ts` (`applyUnsubscribe`)

## Endpoints

| Method | Path | Purpose | Auth | Notes |
|---|---|---|---|---|
| POST | `/api/email/unsubscribe?t=<token>[&source=page]` | Turn off one email type (or all) for the token's user | public (signed token) | idempotent |
| GET | `/api/email/unsubscribe?t=<token>` | Never unsubscribes; 303 redirect to the web confirmation page | public | redirect |

`/api/email/*` is a public prefix in the proxy: no session, no deactivation/legal gates.

## Token
`<base64url(userId)>.<scope>.<signature>` where `scope ∈ "digest" | "budget" | "deadlines" | "goals" | "all"` and signature = first 32 hex chars of HMAC-SHA256 (key derived from `BETTER_AUTH_SECRET` + context `buddybudget:email-unsubscribe:v1`) over `"{scope}:{userId}"`. It never expires and only allows disabling that scope for that user. Emails carry it in:
- page link: `{APP_URL}/disiscrizione?t={token}`
- `List-Unsubscribe` header: `{APP_URL}/api/email/unsubscribe?t={token}` (POST one-click)

## POST /api/email/unsubscribe
Route name: `email.unsubscribe` · Auth: none

**Query params**
| Name | Type | Required | Notes |
|---|---|---|---|
| `t` | string | yes | token |
| `source` | `"page"` | no | `page` when sent by the `/disiscrizione` button; otherwise counted as `one_click` (metrics only) |

**Request body**: ignored (mail clients send `List-Unsubscribe=One-Click` form data).

**Response** `200 { "ok": true }` — also when the user no longer exists.

**Errors**: `400 { error: "Link non valido" }` (missing/malformed/bad signature).

**Side effects**: upsert `notification_preferences`: `digest` → `digestEnabled=false`; `budget` → `budgetAlertsEnabled=false`; `deadlines` → `deadlineAlertsEnabled=false`; `goals` → `goalAlertsEnabled=false`; `all` → all four false. Metric `recordNotificationUnsubscribe(scope, source)`.

## GET /api/email/unsubscribe
Route name: `email.unsubscribe_redirect` · Auth: none

**Response** `303` → `{APP_URL}/disiscrizione?t={token}` (link previews and antivirus scanners must not unsubscribe).

**Mobile notes**: not needed by the app. If the app registers universal/app links for `APP_URL`, exclude `/disiscrizione` and `/api/email/*` (or handle them by calling POST with `source=page` after a confirmation tap). In-app management of the same preferences uses `PATCH /api/user/notifications`.
