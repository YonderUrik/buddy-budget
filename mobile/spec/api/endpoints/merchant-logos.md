# Merchant logos

Feature area(s): Movements list, Categorize (suggestion groups, "Messe dall'app"), Recategorize preview, Categorization rules — merchant avatar next to a transaction/group
Source: `app/api/merchant-logos/[domain]/route.ts`, `app/api/merchant-logos/name/[name]/route.ts`; logic in `lib/categorization/merchant-logo/*`, `lib/investments/logos/logo-service.ts`

## Endpoints

| Method | Path | Purpose | Auth | Notes (job / demo-guard / country-gate) |
|---|---|---|---|---|
| GET | `/api/merchant-logos/{domain}` | Merchant logo image by domain (image proxy via Logo.dev + Redis cache) | session | returns image bytes, not JSON |
| GET | `/api/merchant-logos/name/{name}` | Merchant logo image resolved by brand name (Logo.dev brand search, then image) | session | returns image bytes, not JSON; requires signature |

## How clients get these URLs

Clients never build these URLs themselves. Several JSON endpoints return a `logoPath: string | null` field (a path relative to the web origin, already including any signature):

- `GET /api/transactions` (each row)
- `GET /api/transactions/categorize-suggestions` (each group)
- `GET /api/transactions/auto-categorized` (each group)
- `GET /api/transactions/recategorize` (each group)
- `GET /api/categorization-rules` (each rule)

`logoPath` shapes (`merchantLogoPath`, `lib/categorization/merchant-logo/sign.ts`):
- dictionary brand (known domain list): `/api/merchant-logos/{domain}` — no signature
- domain found in the transaction text: `/api/merchant-logos/{domain}?s={sig}`
- brand name to look up: `/api/merchant-logos/name/{encodeURIComponent(name)}?s={sig}`
- `null` — no logo candidate (or the server signing secret is missing): show the merchant initial.

`sig` = first 24 hex chars of HMAC-SHA256 (key derived from `BETTER_AUTH_SECRET`) of `"domain:<domain>"` or `"name:<name>"`. It is deterministic (no expiry). This prevents the route from being an open proxy.

## GET /api/merchant-logos/{domain}
Route name: `merchant_logos.get` · Auth: session cookie required

**Path params**

| Name | Type | Required | Constraints |
|---|---|---|---|
| domain | string | yes | either a dictionary domain (`isKnownMerchantLogoDomain`), or a registrable domain (eTLD+1, `registrableDomain(domain) === domain`) with a valid `s` |

**Query params**

| Name | Type | Required | Notes |
|---|---|---|---|
| s | string (24 hex) | only for non-dictionary domains | signature from `logoPath` |

**Response** `200`
- Body: raw image bytes (proxied from `https://img.logo.dev/{domain}?size=128&format=webp&fallback=404`, or from the Redis cache).
- `Content-Type`: the upstream image type (normally `image/webp`; any `image/*` accepted).
- `Cache-Control: private, max-age=86400` (1 day).
- Image is 128x128 px, max 100 KB.

**Errors**

| Status | Body | Headers | When |
|---|---|---|---|
| 401 | empty | — | no session |
| 404 | empty | `Cache-Control: private, max-age=3600` | domain not allowed / bad or missing signature / Logo.dev has no logo / Logo.dev disabled (no key) / upstream error or cooldown |

**Side effects**
- Redis cache `merchant:{domain}`: hit cached 30 days, miss cached 3 days; after an upstream error the service is not called for 5 minutes (cooldown, all logos).
- External call to Logo.dev (publishable key `LOGODEV_PUBLISHABLE_KEY`) only on cache miss; only the domain is sent, never user info.
- Metrics `recordLogoRequest("merchant", outcome)` and logs `merchant.logo.fetched|missing|failed` when the service was actually called.

## GET /api/merchant-logos/name/{name}
Route name: `merchant_logos.by_name` · Auth: session cookie required

**Path params**: `name` — URL-encoded brand search key (lower-case, no accents/punctuation/company suffix; must equal `nameSearchKey(name)`), decoded once server-side.
**Query params**: `s` (required) — signature.

**Behaviour**
1. Invalid key or signature -> 404.
2. Resolve name -> domain (`resolveNameDomain`): Redis cache first (found: 30 days; not found: 7 days). If not cached, Logo.dev brand search (secret key `LOGODEV_SECRET_KEY`) is performed only if the name has been seen in the transactions of at least **3 distinct users** and the global budget of **100 searches/day** is not exhausted; otherwise skipped (404 now, may succeed later).
3. If a domain is found, serve it exactly like `/api/merchant-logos/{domain}`.

**Response**: identical to the domain route (`200` image bytes with `Cache-Control: private, max-age=86400`, or `404` empty with `Cache-Control: private, max-age=3600`).

**Errors**: 401 empty (no session); 404 empty (see above).

**Side effects**: Redis (name->domain cache, daily search budget counter), Logo.dev brand search, metrics `recordLogoRequest("merchant_search", hit|miss|error|skipped)`, logs `merchant.logo.search_*`.

## Mobile notes
- These are **authenticated image endpoints**: the native image loader must send the better-auth session cookie (e.g. a shared `URLSession`/OkHttp cookie jar, or a custom image fetcher). Plain `AsyncImage`/Coil without cookies will get 401.
- Resolve `logoPath` against the API base URL; keep the `?s=` query string intact.
- Treat 404 (and any error) as "no logo" and show the initial; respect `Cache-Control` (1 day for hits, 1 hour for misses) — the response has no ETag.
- A name logo can start returning 200 later (once enough users share the merchant), so don't cache 404s longer than the header says.
- Content type is usually WebP: Android supports it natively; iOS supports WebP since iOS 14.
