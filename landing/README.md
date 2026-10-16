# BuddyBudget landing

Static showcase site for `buddybudget.io`. A Next.js project independent from the app (its own `package.json`, lockfile and CI): it produces only static files in `out/`, with no server or database access.

```
pnpm install
pnpm dev          # http://localhost:3100
pnpm lint && pnpm typecheck && pnpm test
pnpm build        # generates out/
```

## Where to change what

- `content/catalog.generated.ts`: **generated copy** of the shared catalog `../lib/features/catalog.ts`, which is the single list of features (landing, the login's "In arrivo" ("Coming soon") panel, sidebar test). Do not edit it by hand: change the catalog, then run `pnpm sync:features` and commit. `pnpm check:features` (in CI) fails if the two copies diverge. Why a copy: the Docker image and Turbopack only see `landing/`.
- `content/site.ts`: titles, FAQ, security, addresses. `content/questions.ts`: the home page questions with case and figure (calculated, never written by hand).
- `content/demo.ts`: fake data shown in the app window (no real data).
- `components/`: sections and animations (GSAP for entrances). With `prefers-reduced-motion: reduce` the page stays static.

## Environment variables (all public, read at build time)

| Variable | Default | Use |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://buddybudget.io` | canonical URL, sitemap, Open Graph |
| `NEXT_PUBLIC_APP_URL` | `https://app.buddybudget.io` | destination of "Accedi" ("Sign in") and "Crea il tuo account" ("Create your account") |
| `NEXT_PUBLIC_SOURCE_URL` | `https://github.com/YonderUrik/buddy-budget` | code repo: the footer shows «Open source · Vedi il codice» ("View the code"); empty = no link |
| `NEXT_PUBLIC_UMAMI_SRC` | `<APP_URL>/stats/script.js` | Umami script (proxied by the app) |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | empty | Umami site id **of the landing**; without it, no tracking |

## Deploy (k3s cluster)

nginx image (`Dockerfile`, config in `nginx.conf`) built by CI and served by the cluster (namespace `app`, manifests in the infra repo `argocd/manifests/landing`). The security headers and the redirects of the app's old paths to `app.buddybudget.io` are in `nginx.conf`; `public/_headers` and `public/_redirects` remain in the Cloudflare Pages format: if they change, they must be mirrored in `nginx.conf`. The `NEXT_PUBLIC_*` variables are Dockerfile `ARG`s (values baked in at build time).

## Umami events

`cta_click` (location, target), `section_view`, `question_selected`, `question_tool_click`, `catalog_area_selected`, `simulator_used`, `hide_amounts_toggled`, `source_link_click`, `theme_toggled`. The closed type is in `lib/analytics.ts`: categorical props only, never personal data.
