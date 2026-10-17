# Redirects always use the public address (2026-10-17)

Behind the ingress `request.url` carries the container bind address (`0.0.0.0:3000`). #421 fixed `/demo`; the proxy
(`proxy.ts`) still built its redirects (login, onboarding, legal acceptance, deactivated page, country unavailable)
from `request.url`, so a visitor bounced by the proxy landed on `0.0.0.0:3000/login`. All of them now use `APP_URL`,
falling back to the request URL only when it is unset (tests, local dev). Regression test in `proxy.test.ts`.
