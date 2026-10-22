# Authentication — current state and what native clients need

Status: analysis of `buddy-budget` @ better-auth **1.6.33**, Next.js 16.3.8. All claims below were verified against the source
(`lib/auth/index.ts`, `lib/auth/client.ts`, `proxy.ts`, `lib/account/*`, `app/api/auth/[...all]/route.ts`,
`node_modules/better-auth/dist/**`).

**Verdict:** native apps can't use the backend as-is. Login (magic link and Google) and bank linking (GoCardless) both
depend on a browser holding the session cookie. Every other `/api/*` route only calls
`auth.api.getSession({ headers })`. Add the better-auth **`bearer` plugin** and every existing route works with
`Authorization: Bearer <token>` without changes. The other blockers are small:

- add a native login method (email OTP recommended),
- accept the iOS and Android Google client IDs,
- add Sign in with Apple, which iOS needs because Google sign-in is offered,
- make the GoCardless return flow work without a browser cookie.

See [Backend changes](#6-backend-changes-required-for-mobile).

> **Implementation status (2026-10-18):** R1 (bearer), **R2 (email OTP)**, R7 (`GET /api/legal` + coded gate 403s) and
> R8 (Origin check skipped for bearer-only requests) are implemented on branch **`feat/mobile-api-foundations`** of
> `buddy-budget`, together with `GET /api/me/bootstrap` (gaps.md G1/G13 subset, see [endpoints/me.md](./endpoints/me.md))
> and the Phase 2 view endpoints (see [gaps.md](./gaps.md)). Not merged yet. The sections below describe the behaviour
> **with that branch**; R3–R5 are still open. **R6 (GoCardless return without cookies) is implemented** on the same branch
> (commit `f4895875`): see the R6 row below and [endpoints/gocardless.md](./endpoints/gocardless.md#native-connection-flow-r6). The R2 flow was verified end to end against a local dev server
> (send code → sign in → `GET /api/me/bootstrap` with the bearer token → 200).

---

## 1. How authentication works today

### 1.1 Configuration (`lib/auth/index.ts`)

| Aspect | Value |
|---|---|
| Library | `better-auth` 1.6.33, Drizzle adapter (`pg`), tables `auth_user`, `auth_session`, `auth_account`, `auth_verification` |
| Mount point | `app/api/auth/[...all]/route.ts` → `toNextJsHandler(auth)` for GET and POST, wrapped in `withRoute("auth", …)`. It also counts 429s for metrics. Every better-auth endpoint is under **`/api/auth/*`**. |
| `baseURL` | Not set in code. better-auth reads env **`BETTER_AUTH_URL`** (validated http/https in `lib/env.ts`). The app's own URL is **`APP_URL`**. In production both should be `https://app.buddybudget.io` (the move from the apex is in progress, see CLAUDE.md "Previsto"). |
| `secret` | env `BETTER_AUTH_SECRET` (≥ 32 chars). It signs the session cookie and encrypts Google OAuth tokens (`account.encryptOAuthTokens: true`). |
| Plugins | `magicLink`, **`emailOTP`** (R2: 6 digits, 10 min, stored hashed, 3 attempts, sign-in only), `lastLoginMethod`, `publicDemo` (app plugin) and **`bearer`** (R1, default options: unsigned tokens accepted); both on branch `feat/mobile-api-foundations`. Web client: `magicLinkClient()` + `inferAdditionalFields`. **No** `jwt`, `twoFactor`, `oneTimeToken`, `multiSession`, `admin`, `organization`, `username`, `passkey`. |
| Email + password | **Not enabled** (`emailAndPassword` not configured). `auth_account.password` exists only because better-auth's schema has it; it is never written. **There is no password, no password reset and no "verify your email" flow.** A magic-link sign-in marks the email as verified. |
| Social providers | **Google**, only when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set (self-hosters may run without it). `clientId` is a **single string** (the web client). Redirect URI registered at Google: `<BETTER_AUTH_URL>/api/auth/callback/google`. |
| Account linking | `accountLinking.enabled: true`, `updateUserInfoOnLink: true`. Settings → "Collega Google" uses `authClient.linkSocial({ provider: "google", callbackURL })`. |
| Sign-up | Implicit. The first magic-link verification or first Google sign-in creates the user. The `user.create.after` hook seeds the default categories (`defaultCategoryRows`). |
| 2FA / passkeys | None. |
| Session lifetime | `expiresIn` = **7 days**, `updateAge` = **1 day** (`lib/auth/constants.ts`). Using a session that was last refreshed more than 1 day ago pushes its expiry out to 7 days from now. A session unused for 7 days expires. |
| Cookie cache | Not enabled. Every `getSession` hits Postgres. |
| `trustedOrigins` | **Not configured.** Effective list = origin of `BETTER_AUTH_URL`, plus anything in env `BETTER_AUTH_TRUSTED_ORIGINS` (comma-separated; better-auth reads it natively). |
| Rate limiting | better-auth built-in. **Enabled only in production**, storage **`memory`** (no `secondaryStorage`, so it's per pod and resets on restart). Defaults: 100 req / 10 s per IP and path. `/sign-in/*`, `/sign-up/*`: 3 / 10 s. `/sign-in/magic-link` and `/magic-link/verify`: **5 / 60 s** (plugin rule overrides). The IP comes from `x-forwarded-for` (default headers). A 429 returns `{"message":"Too many requests. Please try again later."}` with header `X-Retry-After: <seconds>`. |
| Database hooks | Session create: the IP is stored truncated (`truncateIp`), and `lastActiveAt` is updated (inactivity cron). Session update (daily refresh): `lastActiveAt` is updated again. |
| Extra user fields (`additionalFields`, all `input: false`) | `productCountry` ("IT"\|"DE", default "IT"), `language` ("it"\|"en"\|"de", default "it"), `currency` (default "EUR"), `onboardingCompleted` (bool), `homePage` (string path), `hideAmounts` (bool), `deletionScheduledAt` (date\|null), `legalAcceptedAt` (date\|null), `legalAcceptedVersion` (string\|null). They're returned by `/api/auth/get-session` but **can't be changed via `/api/auth/update-user`**. They're written only by app routes (`/api/user/onboarding`, `/api/user/settings`, `/api/user/legal-acceptance`, …). |

### 1.2 Session cookie

| Cookie | Attributes | Notes |
|---|---|---|
| `__Secure-better-auth.session_token` (production, https). `better-auth.session_token` on http/dev. | `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800` | Value is `<token>.<HMAC-SHA256 signature>` (signed with `BETTER_AUTH_SECRET`), URL-encoded. better-auth also reads the non-`__Secure-` name. |
| `better-auth.session_data` | — | **Not issued** (cookie cache disabled). |
| `better-auth.dont_remember` | — | Only if `rememberMe: false` is used. The web never uses it. |
| `bb-language` | Set by client JS (`lib/localization/provider.tsx`), 1 year, not HttpOnly | Only server-rendered pages read it, before the session is known. **APIs don't read it.** Localized API errors use the session user's `language`. |

**Important for cookie-jar clients:** app API routes call `auth.api.getSession()` internally and **never send
`Set-Cookie`**. The 7-day `Max-Age` stored in a client cookie jar is only refreshed when the client calls a better-auth
endpoint, typically `GET /api/auth/get-session`, which re-issues the cookie when the session was refreshed. The web
does this through `authClient.useSession()`. If a native app only called `/api/*`, the server would keep extending the
session, but the cookie in the jar would expire 7 days after login.

### 1.3 CSRF and origin checks (better-auth `originCheckMiddleware` / `formCsrfMiddleware`)

These apply **only to better-auth endpoints (`/api/auth/*`)**. App routes under `/api/*` don't check CSRF or origin.
They rely on `SameSite=Lax` and only accept JSON. **One exception:** the personal-imports write routes compare `Origin`
with the `APP_URL` origin themselves and return an empty 403 on mismatch, **unless** the request carries
`Authorization: Bearer …` and no `Cookie` header (R8, `lib/http/same-origin.ts` `isTrustedWriteOrigin`). Native
clients that send no cookies therefore need no `Origin`.

- GET, HEAD and OPTIONS are never checked.
- POST **with a `Cookie` header** must carry an `Origin` (or `Referer`) that matches `trustedOrigins`. Otherwise:
  - no or `null` origin → **403 `MISSING_OR_NULL_ORIGIN`**
  - untrusted origin → **403 `INVALID_ORIGIN`**
- POST **without cookies** (first sign-in) is checked only if `Sec-Fetch-*`, `Origin` or `Referer` headers are present.
  A native client that sends none of them passes.
- `callbackURL`, `newUserCallbackURL`, `errorCallbackURL` and `redirectTo` must be relative paths or match
  `trustedOrigins`. Otherwise 403 `INVALID_CALLBACK_URL` (and similar). For non-http(s) schemes, `matchesOriginPattern`
  does a **prefix match**. With `trustedOrigins: ["buddybudget://"]`, any `buddybudget://…` callback would be accepted.
- `/magic-link/verify` validates its `callbackURL` query parameters the same way.

### 1.4 Gates enforced by `proxy.ts` (Next middleware) on every `/api/*` request

| Condition | API response |
|---|---|
| No valid session | `401`, empty body |
| `user.deletionScheduledAt != null` (account deactivated, deletion pending) | `403 {"code":"account_deactivated"}` for every `/api/*` **except** `/api/user/reactivate`, `/api/me/bootstrap` (and the public prefixes) |
| `onboardingCompleted && needsLegalAcceptance(legalAcceptedVersion)` | `403 {"code":"legal_acceptance_required","version":"2026-10-12"}` except `/api/user/legal-acceptance`, `/api/user/export`, `/api/user/account`, `/api/me/bootstrap` |
| Feature not available for `productCountry` (DE) | `403 {"code":"country_feature_unavailable","error":"…"}` |
| Public prefixes (no session needed) | `/api/auth`, `/api/health`, `/api/legal`, `/api/cron` (CRON_SECRET), `/api/metrics` (METRICS_TOKEN), `/api/email` (signed token) |

The gate order lives in `lib/account/gates.ts` (`accountGate`), shared by `proxy.ts` and `GET /api/me/bootstrap`.
Pages keep redirecting (`/account-disattivato`, `/accetta-termini`, `/onboarding`); only `/api/*` gets the JSON bodies.
Before the branch, both gate 403s had an empty body.

Onboarding isn't enforced on the API. Only pages redirect to `/onboarding`. A native client reads the gate to show from
`GET /api/me/bootstrap` (`gate` field, [endpoints/me.md](./endpoints/me.md)) and the current legal version from the
public `GET /api/legal` ([endpoints/legal.md](./endpoints/legal.md)).

### 1.5 "Recent login" requirement for sensitive actions

`lib/account/route-session.ts → recentLoginRequired()`: export, reset, deactivate and delete need a session created
within **`RECENT_LOGIN_MAX_AGE_MINUTES` = 10 minutes**. Otherwise:

```json
403 { "error": "Per sicurezza accedi di nuovo prima di continuare.", "code": "reauth_required" }
```

On the web, `ReauthPanel` sends a new magic link or Google sign-in with `callbackURL` back to `/impostazioni`. The **new
session** is what counts as recent; the old one stays valid. A native client does the same thing: run the sign-in flow
again, replace the stored token, then retry the action. It may revoke the previous session afterwards via
`DELETE /api/user/sessions/{id}`.

### 1.6 better-auth endpoints the web uses

| Endpoint | Used by |
|---|---|
| `POST /api/auth/sign-in/magic-link` `{ email, callbackURL?, newUserCallbackURL?, errorCallbackURL?, name? }` → `{ status: true }` | Login, re-auth |
| `GET /api/auth/magic-link/verify?token=…&callbackURL=…` → 302 to callbackURL plus `Set-Cookie`. **Without `callbackURL` it returns 200 JSON `{ token, user, session }`.** Errors redirect to `errorCallbackURL?error=INVALID_TOKEN` (also `failed_to_create_user`, `new_user_signup_disabled`, `failed_to_create_session`). | Link in the email (`${BETTER_AUTH_URL}/api/auth/magic-link/verify?...`), valid **10 min**, single use |
| `POST /api/auth/sign-in/social` `{ provider: "google", callbackURL }` → `{ url, redirect: true }` (browser OAuth) | Login, re-auth |
| `GET /api/auth/callback/google` | OAuth redirect target |
| `POST /api/auth/link-social` `{ provider: "google", callbackURL }` | Settings → link Google |
| `GET /api/auth/get-session` → `{ session, user } \| null` | `authClient.useSession()` everywhere |
| `POST /api/auth/sign-out` | Sidebar, mobile menu, deactivated and legal pages |

The app's own session management doesn't use better-auth's `list-sessions` / `revoke-session`. It goes through
`/api/user/sessions` (`GET` list, `DELETE` = sign out all other sessions) and `/api/user/sessions/{id}` (`DELETE`).
These read the DB directly. Linked providers come from the settings payload (`listLinkedProviders`). See
[endpoints/user.md](./endpoints/user.md).

`GET /api/auth/get-session` response (fields the client needs):

```json
{
  "session": { "id": "…", "userId": "…", "expiresAt": "2026-10-25T10:00:00.000Z", "createdAt": "2026-10-18T10:00:00.000Z", "updatedAt": "…", "ipAddress": "93.40.12.0", "userAgent": "…", "token": "…" },
  "user": {
    "id": "…", "name": "Mario", "email": "mario@example.com", "emailVerified": true, "image": null,
    "productCountry": "IT", "language": "it", "currency": "EUR", "onboardingCompleted": true,
    "homePage": "/panoramica", "hideAmounts": false, "deletionScheduledAt": null,
    "legalAcceptedAt": "2026-10-12T08:00:00.000Z", "legalAcceptedVersion": "2026-10-12",
    "createdAt": "…", "updatedAt": "…"
  }
}
```

(better-auth returns only the core user fields plus the declared `additionalFields`. Columns such as `movementsSeenAt`
and `aiCategorizationConsentAt` are not included. They are exposed by app routes.)

---

## 2. Can a native client use cookie sessions?

**Technically yes, but not recommended.**

| Concern | Cookie jar (URLSession `HTTPCookieStorage` / OkHttp `CookieJar`) | Bearer token (with `bearer` plugin) |
|---|---|---|
| Getting the session after sign-in | Automatic from `Set-Cookie` | From the `set-auth-token` response header (signed token) or the `token` field of the JSON body |
| Calling `/api/*` | Works unchanged | Works unchanged: the plugin's `before` hook also runs inside `auth.api.getSession({ headers })`, which `proxy.ts` and every route call |
| POST to `/api/auth/*` (sign-out, link-social, …) | **403 `MISSING_OR_NULL_ORIGIN`** unless the app adds `Origin: <APP_URL>` by hand | No `Cookie` header, so no origin check |
| Client-side expiry | `Max-Age` 7 days from issuance, refreshed only via `/api/auth/*` (see §1.2) | No client-side expiry. The server-side sliding window applies (7 days idle). |
| Secure storage | iOS `HTTPCookieStorage` is a plain file in the app container, not the Keychain. OkHttp needs a custom persistent jar. | Token in Keychain (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`) or Android Keystore / EncryptedSharedPreferences |
| Sharing logic between platforms | Cookie-jar behavior differs between the two stacks | Identical: one header |
| Backend change | None | One line: `plugins: [magicLink(...), bearer()]` |

**Decision for the spec:** native clients use **Bearer tokens** and **disable cookie handling**:

- iOS: `URLSessionConfiguration.httpCookieStorage = nil`, `httpShouldSetCookies = false`
- Android: OkHttp with no `CookieJar`

They send `Authorization: Bearer <signed token>` on every request to `/api/*` and `/api/auth/*`. Disabling cookies
matters: a stray `Cookie` header would trigger the origin check on better-auth POSTs.

---

## 3. Sign-in flows for native

### 3.1 Email (recommended: email OTP, required change R2)

Magic links work badly on native:

- The emailed link points at `${BETTER_AUTH_URL}/api/auth/magic-link/verify?token=…&callbackURL=/`. Opening it in a
  browser sets the cookie **in the browser**, not in the app.
- The app could only capture it with Universal Links / App Links on `/api/auth/magic-link/verify`. That would also
  capture links that web users open on a phone with the app installed.
- It breaks when the email is read on another device, which is common: request on the phone, read on the laptop.

**Implemented flow (R2, better-auth `emailOTP` plugin, branch `feat/mobile-api-foundations`).** All requests are JSON,
sent **without cookies** and without `Origin` (better-auth only checks the origin when cookies or `Sec-Fetch-*` /
`Origin` / `Referer` headers are present). Send a native User-Agent (`BuddyBudget-iOS/<ver>`, `BuddyBudget-Android/<ver>`).

1. **Request a code**

   ```http
   POST /api/auth/email-otp/send-verification-otp
   Content-Type: application/json

   { "email": "user@example.com", "type": "sign-in" }
   ```

   → `200 {"success":true}`. Always `success: true`, also for unknown addresses (implicit sign-up) and when the email
   could not be delivered: the response never reveals whether an account exists. The email is in the account's saved
   language (it/en/de), or for a new address in the language of `Accept-Language` (send the app language there). The
   code is in the subject (`"482913 is your BuddyBudget sign-in code"`) and the body, which lets iOS Mail / Android
   offer it as one-tap autofill (`textContentType = .oneTimeCode`, `autofillHints = SMS_OTP` / `AUTOFILL_HINT_ONE_TIME_CODE`).
   Requesting again replaces the previous code (rotate). Rate limit (production only): **3 requests / 60 s** per IP and
   path → `429` with `X-Retry-After`.
2. **The user types the 6-digit code** (valid **10 minutes**, single use, **3 wrong attempts** burn it).
3. **Sign in**

   ```http
   POST /api/auth/sign-in/email-otp
   Content-Type: application/json

   { "email": "user@example.com", "otp": "482913" }
   ```

   → `200`, headers `set-auth-token: <token>.<signature>` (the signed session cookie value, decoded: the signature is
   base64 and can contain `+`, `/` and `=`; store it verbatim) and a `Set-Cookie` the app must ignore; body:

   ```json
   { "token": "H4NMJ1L4R8Q9TZ2gZ3OanMb8O6eGKRPs",
     "user": { "id": "VCj4…", "name": "", "email": "user@example.com", "emailVerified": true, "image": null,
               "productCountry": "IT", "language": "it", "currency": "EUR", "onboardingCompleted": false,
               "homePage": "/panoramica", "hideAmounts": false, "deletionScheduledAt": null,
               "legalAcceptedAt": null, "legalAcceptedVersion": null, "createdAt": "…", "updatedAt": "…" } }
   ```

   Store **either** the `set-auth-token` header value **or** `body.token` (both are accepted by the bearer plugin;
   prefer the header, which is signed) in the Keychain / Keystore. Fixture: [fixtures/auth-email-otp.json](./fixtures/auth-email-otp.json). A new address creates the user here (default
   categories seeded, `onboardingCompleted: false`).

   Errors (better-auth shape `{ "message", "code" }`):

   | Status | `code` | Meaning | Client action |
   |---|---|---|---|
   | 400 | `INVALID_OTP` | Wrong code (or no code requested for this address) | Show "wrong code", keep the field |
   | 400 | `OTP_EXPIRED` | Code older than 10 minutes | Offer "send a new code" |
   | 403 | `TOO_MANY_ATTEMPTS` | 3 wrong attempts: the code is burnt | Request a new code |
   | 429 | — | Rate limited (production only) | Wait `X-Retry-After` seconds |
4. **Use the token** on every request: `Authorization: Bearer <token>`. Then `GET /api/me/bootstrap` and route on
   `gate` (§4). For a new user that is `"onboarding_required"`.

Re-auth for sensitive actions (§1.5) is the same flow: the new session is the recent one.

**Development:** on a dev server (`NODE_ENV != production`) with no working Resend key, the code is written to the
server log as an info line `{"event":"auth.otp.dev_code","devCode":"482913",…}`, so simulators can sign in. Never in
production. For a ready-made session with demo data, the backend has `pnpm dev:mobile-session --email <e> --demo`
(prints a bearer token; refuses to run in production or against a non-local database).

**Fallback without R2 (not recommended):** keep the magic link and handle it with Universal Links / App Links on
`https://<host>/api/auth/magic-link/verify`. The app pulls `token` out of the URL and calls
`GET /api/auth/magic-link/verify?token=<token>` **without `callbackURL`**, which returns
`200 { token, user, session }`. This needs `apple-app-site-association` and `assetlinks.json` served from the app
domain (R5) and has the cross-device and capture problems above.

### 3.2 Google (native SDK + ID token, required change R3)

1. iOS: GoogleSignIn SDK. Android: Credential Manager `GetGoogleIdOption(serverClientId = <web client id>)`.
   Pass a `nonce` if possible.
2. `POST /api/auth/sign-in/social`

   ```json
   { "provider": "google", "idToken": { "token": "<google id token>", "nonce": "<raw nonce, optional>", "accessToken": "<optional>" } }
   ```

   → `200 { redirect: false, token, url: null, user }` plus `set-auth-token`.
3. better-auth checks the token's `aud` against `clientId`. Today that's only the **web** client ID. Android tokens
   requested with `serverClientId = web client id` already pass. iOS tokens carry the iOS client ID as audience. So
   `clientId` must become an array (better-auth supports `string | string[]`, see `getPrimaryClientId`). The first entry
   stays the web client used for the redirect flow.
4. Re-auth (§1.5) and linking Google from Settings: `POST /api/auth/link-social` `{ provider: "google", idToken: { token } }`
   (better-auth 1.6 accepts `idToken` there too).

### 3.3 Sign in with Apple (required for the App Store, R4)

App Store Review Guideline 4.8: if the iOS app offers Google sign-in, it must also offer an equivalent private sign-in
option, in practice Sign in with Apple. Configuration:

- `socialProviders.apple` with `clientId` = Services ID, `clientSecret` = JWT from the .p8 key,
  `appBundleIdentifier` = the iOS bundle ID (needed for native ID-token audience)
- `trustedOrigins` must include `https://appleid.apple.com`

Native flow: `ASAuthorizationAppleIDProvider` → `POST /api/auth/sign-in/social`
`{ provider: "apple", idToken: { token, nonce } }`.

Apple only returns the user's name on the **first** authorization. Send it in `idToken.user` (`{ name: { firstName, lastName } }`).

Apple "Hide my email" relay addresses create a separate user, which won't auto-link to an existing magic-link account
with the real email. This is acceptable but should be stated in the product copy.

Alternative: drop Google from the iOS app. Not recommended.

### 3.4 Sign out

`POST /api/auth/sign-out` with the bearer header → `{ success: true }`. It deletes the DB session. Then wipe the token
and all local caches.

### 3.5 Token lifecycle on the client

- On app launch or foreground: `GET /api/auth/get-session`.
  - `null` or 401 → go to login.
  - Otherwise refresh the cached user: language, currency, country, `hideAmounts`, gates.
  - The call also slides the session expiry.
- Any `/api/*` 401 → clear the token and go to login. Don't retry.
- The session expires after **7 idle days**. There's no refresh token and none is needed: the token stays valid while
  it's used at least once a week.
- Optional (nice to have N3): a longer `expiresIn` for mobile sessions.

---

## 4. Routing after sign-in (replicates `proxy.ts` + page redirects)

Call `GET /api/me/bootstrap` ([endpoints/me.md](./endpoints/me.md)) and route on its `gate` field, which is computed by
the same function as the proxy (`lib/account/gates.ts`):

```
bootstrap.gate
├─ "account_deactivated"        → Deactivated screen (date = account.deletionScheduledAt; POST /api/user/reactivate, sign-out)
├─ "legal_acceptance_required"  → Accept-terms screen (POST /api/user/legal-acceptance with legal.currentVersion; export; delete account)
├─ "onboarding_required"        → Onboarding (POST /api/user/onboarding … see endpoints/user.md; the legal step is inside)
└─ null                         → home = profile.homePage mapped to a native tab
```

Labels, clause names and URLs of the legal documents: public `GET /api/legal` ([endpoints/legal.md](./endpoints/legal.md)).

Country gating: hide every section whose `capabilities.sections.<name>` is `false` in the bootstrap (for DE: pension,
analytics/retirement, goals, the FIRE sidebar module), and still handle `403 country_feature_unavailable`.

---

## 5. Deep links and redirects that involve the browser

| Flow | Today (web) | Native need | Change |
|---|---|---|---|
| Magic link email | `${BETTER_AUTH_URL}/api/auth/magic-link/verify?...` → 302 + cookie | Not needed: native apps use the email code (R2, implemented). | R2 ✅ |
| Google OAuth redirect | `/api/auth/callback/google` | Not used (native ID token) | R3 |
| **GoCardless bank consent** | Web: `POST /api/gocardless/connections` → `{ link, connectionId, client: "web" }`. The browser goes to the bank, then GoCardless redirects to `<APP_URL>/api/gocardless/callback?ref=<connectionId>`, which **needs the session cookie in the browser** and 302s to the web page `/conti/collega/<id>` to pick accounts (finalize). | ✅ **R6**: create with `client: "native"`; the app opens `link` in `ASWebAuthenticationSession` / Custom Tabs; GoCardless returns to the public `/api/gocardless/callback/native`, which 302s to `buddybudget://bank/return?ref=<connectionId>&status=…` (no cookie, no state change); the app calls `POST /api/gocardless/connections/{id}/complete` with its bearer token, then `finalize`. | **R6** ✅ |
| Email links (summary, alerts, renewal `/conti?rinnova=1`, inactivity, unsubscribe `/disiscrizione`) | Web pages | Can keep opening the web. Optionally Universal Links later. | N4 |
| Password reset / email verification | **Don't exist** (no password auth) | — | — |

---

## 6. Backend changes required for mobile

Ordered by priority. "Required" means the native apps can't ship without it.

### Required

| # | Change | File(s) | Why |
|---|---|---|---|
| **R1** ✅ *implemented on `feat/mobile-api-foundations`* | Add the better-auth **`bearer()`** plugin: `import { bearer } from "better-auth/plugins"` and `plugins: [magicLink({...}), bearer()]`. Keep `requireSignature` at its default `false` (the plugin signs raw tokens itself). | `lib/auth/index.ts` | Lets every `/api/*` route and `proxy.ts` accept `Authorization: Bearer`. No route changes. Avoids cookie-jar storage, origin-check 403s and cookie expiry drift (§2). Sign-in responses return the token in the `set-auth-token` header (already exposed via `Access-Control-Expose-Headers`). |
| **R2** ✅ *implemented on `feat/mobile-api-foundations`* (flow in §3.1; codes hashed, 10 min, 3 attempts; dev-only `auth.otp.dev_code` log instead of the `logMagicLink` stdout fallback, nothing logged in production) | Add the better-auth **`emailOTP`** plugin (`sendVerificationOTP({ email, otp, type })` via Resend, same "logs only" fallback as `logMagicLink` for self-hosting). Add an email template in `lib/auth/emails.ts` (localized IT/EN/DE, OTP valid 10 min). | `lib/auth/index.ts`, `lib/auth/emails.ts`, new `lib/auth/otp-log.ts` | Native email sign-in that works across devices without deep links (§3.1). The web can keep the magic link. |
| **R3** | Accept the native Google audiences: `google: { clientId: [GOOGLE_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID].filter(Boolean), clientSecret }`. Add the two optional env vars to `lib/env.ts` and the env examples. | `lib/auth/index.ts`, `lib/env.ts`, `.env.*.example`, infra Secret | `POST /api/auth/sign-in/social` with an iOS ID token fails the audience check today (§3.2). |
| **R4** | Add **Sign in with Apple**: `socialProviders.apple` (`clientId`, `clientSecret` JWT, `appBundleIdentifier`). Add `https://appleid.apple.com` to `trustedOrigins`. Add env vars. Optionally show it on the web login too. | `lib/auth/index.ts`, `lib/env.ts`, login UI (optional) | App Store Guideline 4.8 when Google is offered on iOS. |
| **R6** ✅ *implemented on `feat/mobile-api-foundations`* (commit `f4895875`; contract in [endpoints/gocardless.md](./endpoints/gocardless.md#native-connection-flow-r6)). As built: `client: "web" \| "native"` (`ios`/`android` aliases); native redirect is a separate public **path** `<APP_URL>/api/gocardless/callback/native` (not `?client=app`); it 302s to `buddybudget://bank/return?ref=<id>&status=returned\|cancelled\|failed\|invalid_ref[&error=<GoCardless code>]`; `complete` answers `200 { connectionId, status: "linked", institutionId, institutionName, consentExpiresAt, externalAccounts, existingAutoAccounts }` (so `GET …/accounts` is not needed), or `409 bank_consent_pending` / `422 bank_consent_failed` (+ `requisitionStatus`) / `404 bank_connection_not_found` / `502 bank_unavailable`; cleanup matches origin + callback path; HTTPS fallback page `/banca/ritorno`. Not run against the real GoCardless sandbox (no credentials locally). Original proposal: (a) let `POST /api/gocardless/connections` accept an optional `client: "web" \| "ios" \| "android"` (zod in `lib/validation/gocardless.ts`). For native clients, use redirect URL `<APP_URL>/api/gocardless/callback?client=app` (GoCardless appends `ref`). (b) In the callback, when `client=app`: **don't** require a session and don't change state. Just 302 to `buddybudget://bank/return?ref=<id>` (custom scheme captured by `ASWebAuthenticationSession(callbackURLScheme:)` / Custom Tabs intent filter). (c) Move the "check requisition and mark linked" logic out of the callback into `lib/gocardless/` and expose it as an authenticated `POST /api/gocardless/connections/{id}/complete` → `{ status: "linked" \| "error", reason? }`. The app calls it after the browser returns, then continues with `GET …/connections/{id}/accounts` and `POST …/finalize`, which already exist. Note: `lib/gocardless/cleanup-plan.ts` recognizes "our" requisitions by exact redirect URL, so it must accept the `?client=app` variant (compare origin + path). | `app/api/gocardless/connections/route.ts`, `app/api/gocardless/callback/route.ts`, `lib/gocardless/redirect.ts`, `lib/gocardless/cleanup-plan.ts`, new `app/api/gocardless/connections/[id]/complete/route.ts`, `lib/validation/gocardless.ts` | The current callback needs the browser session cookie and ends on a web page (§5). Bank linking is impossible from the apps without this. |
| **R7** ✅ *implemented on `feat/mobile-api-foundations`* (see [endpoints/legal.md](./endpoints/legal.md)) | Expose what the native gates need. (a) A public **`GET /api/legal`** → `{ version, documents[{id,label,url}], … }`, with `LEGAL_VERSION` currently `"2026-10-12"` in `lib/legal/version.ts` (gaps.md G1). (b) Give the two gate 403s in `proxy.ts` a JSON body: `{ "code": "account_deactivated" }` and `{ "code": "legal_acceptance_required", "version": "<LEGAL_VERSION>" }`. Today both are empty-bodied, so they look the same. | new `app/api/legal/route.ts` (add `/api/legal` to `PUBLIC_PATH_PREFIXES`), `proxy.ts` | The client must know the required legal version to show the accept screen and to send it in onboarding / legal-acceptance (§4). A coded 403 lets a client react to a gate that changes mid-session without refetching the session. |

| **R8** ✅ *implemented on `feat/mobile-api-foundations`* (`lib/http/same-origin.ts`; a bearer request that also sends a `Cookie` is still checked) | **Hand-rolled Origin check in personal imports**: `POST /api/personal-imports`, `POST /api/personal-imports/{id}` and `DELETE /api/personal-imports/{id}` return an empty **403** unless `request.headers.get("origin") === new URL(APP_URL).origin`. Skip the check when the request is authenticated with `Authorization: Bearer` and carries no `Cookie` (no CSRF risk without ambient credentials). Move it into a shared helper, e.g. `lib/http/same-origin.ts`. | `app/api/personal-imports/route.ts:18`, `app/api/personal-imports/[id]/route.ts:41,70` | CSV import from the apps fails otherwise. **Client workaround until it ships:** native clients send `Origin: <APP_URL origin>` on these three calls (allowed by URLSession and OkHttp). With that workaround this item is technically optional, but it should be fixed. |

### Nice to have

| # | Change | File(s) | Why |
|---|---|---|---|
| N1 | Rate-limit storage in **Redis** (`secondaryStorage` backed by `lib/redis`, or `rateLimit.storage: "secondary-storage"`). Consider `advanced.ipAddress.ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"]`. | `lib/auth/index.ts` | Today it's in memory per pod. Mobile users on carrier CGNAT share IPs and can hit sign-in limits (3 / 10 s, OTP 3 / 60 s). Cloudflare Tunnel puts the real IP in `cf-connecting-ip`. |
| N2 | Recognize native User-Agents (`BuddyBudget-iOS/<ver>`, `BuddyBudget-Android/<ver>`) in `describeUserAgent`, so Settings → Sessions shows "iPhone · App" instead of "Unknown". | `lib/account/user-agent.ts` | Session list readability. |
| N3 | Longer idle expiry for app sessions, e.g. 30 days. better-auth has one global `expiresIn`, so this needs either a global bump or a session `create.before` hook that extends `expiresAt` when the UA is a native app. | `lib/auth/index.ts`, `lib/auth/constants.ts` | 7 idle days is short for a mobile finance app that people open weekly. Product decision. |
| N4 | `apple-app-site-association` and `/.well-known/assetlinks.json` on the app host so email links (`/liquidita/conti?rinnova=1`, recap emails) open the app. | `public/.well-known/*`, `next.config.ts` headers | Better re-engagement. Needed anyway if the magic-link fallback (R5) is chosen. |
| N5 | Add `buddybudget://` to `trustedOrigins` (`BETTER_AUTH_TRUSTED_ORIGINS` env). | infra env | Only needed if any better-auth `callbackURL` with the app scheme is ever used (e.g. a future browser-based OAuth fallback). Not needed with R1–R4. |
| N6 | API versioning header / minimum supported app version (`GET /api/app/config` → `minAppVersion`). | new route | Lets the backend force an upgrade when a contract change breaks old app builds. See [README.md](./README.md#versioning). |
| N7 | Push-notification device registration (APNs / FCM) to mirror the email alerts. | new table + route | Not needed for parity with the web (email only today). |

### Fallback only (if R2 is rejected)

| # | Change | Why |
|---|---|---|
| R5 | Universal Links / App Links for `/api/auth/magic-link/verify` (AASA + assetlinks). The app calls verify **without** `callbackURL` to get JSON. | Magic link on native without OTP. Has the cross-device and link-capture drawbacks (§3.1). |

---

## 7. Summary for client implementers

- Base auth path: `<BASE_URL>/api/auth`. Send `Authorization: Bearer <token>` everywhere. Never send cookies.
- Sign in with email OTP, Google ID token or Apple ID token. Read the token from the `set-auth-token` header or from
  `body.token`.
- Call `GET /api/me/bootstrap` on launch and foreground and route on `gate` (§4).
- 401 → login. `403 {code:"account_deactivated"}` / `403 {code:"legal_acceptance_required", version}` → refetch the
  bootstrap and re-route.
  `403 {code:"reauth_required"}` → run sign-in again, then retry. `403 {code:"country_feature_unavailable"}` → hide the
  feature. `429` → respect `X-Retry-After`.
- Image endpoints (`/api/merchant-logos/*`, `/api/instruments/{id}/logo`) also need the session. Configure the image
  loader (Kingfisher / Nuke on iOS, Coil on Android) to add the `Authorization` header for same-host URLs.
- Bank linking: `POST /api/gocardless/connections` with `client: "native"`, keep `connectionId`, open `link` in an auth
  browser session (callback scheme `buddybudget`). Wait for `buddybudget://bank/return?ref=…&status=…`, or for the user
  to close the browser. Then `POST /api/gocardless/connections/{connectionId}/complete` → accounts to select →
  `POST …/finalize` (R6 ✅, [gocardless.md](./endpoints/gocardless.md#native-connection-flow-r6)).
