# Bearer session tokens for the native apps (2026-10-20)

**Decision**: better-auth's `bearer()` plugin is on, so `Authorization: Bearer <session token>` authenticates every `getSession` call (API routes and `proxy.ts`); sign-in responses return the token in `set-auth-token`. The native iOS and Android apps (`feat/mobile-apps`) keep it in the Keychain / Keystore instead of a cookie.
**CSRF**: the manual Origin check on personal-import writes moves to `isTrustedWriteOrigin` (`lib/http/same-origin.ts`): cookie requests must still come from `APP_URL`; only bearer requests that send no cookie skip it, since a browser cannot add that header cross-site without a CORS preflight, which these routes don't allow.
**Scope**: the first of the backend changes the apps need; the rest (email code sign-in, launch state, server views) stays on `feat/mobile-api-foundations` for later PRs.
