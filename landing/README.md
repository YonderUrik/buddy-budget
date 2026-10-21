# BuddyBudget landing

Static showcase site for `buddybudget.io`. A Next.js project independent from the app (its own `package.json`, lockfile and CI): it produces only static files in `out/`, with no server or database access.

```
pnpm install
pnpm dev          # http://localhost:3100
pnpm lint && pnpm typecheck && pnpm test
pnpm build        # generates out/
```

## Where to change what

- `content/home.ts`: every text of the home («Un numero solo», 2026-10-17): opening and sum card, the four places, the five «Cosa ti dice» tabs with their figures, trust facts and limits, «Sotto il cofano», closing. Figures come from the demo screenshots in `public/screens/` (a made-up person): when the screens are recaptured, check them.
- `content/site.ts`: title, description, FAQ, addresses. `content/security.ts`: the facts of `/sicurezza` (every sentence verified). `content/sheet.ts`: supported sources and the per-area technical sheet used by `llms.txt`.
- `content/catalog.generated.ts`: **generated copy** of the shared catalog `../lib/features/catalog.ts`, which is the single list of features (landing, the login's "In arrivo" panel, sidebar test). Do not edit it by hand: change the catalog, then run `pnpm sync:features` and commit. `pnpm check:features` (in CI) fails if the two copies diverge. Why a copy: the Docker image and Turbopack only see `landing/`.
- `content/screens.ts`: the real screenshots (see `docs/landing-screens.md` in the app repo); `screens.test.ts` checks routes and files exist. The images live on the `screenshots` branch: `pnpm screens:pull` downloads them (dev, build, typecheck and test do it when they are missing).
- `components/home/`: the home sections; `components/content-page.tsx`: the frame of calculators, guides and feature pages; `DESIGN.md`: the visual rules. With `prefers-reduced-motion: reduce` the page stays static.

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

`cta_click` (location, target), `section_view`, `showcase_tab_selected`, `screen_selected`, `catalog_area_selected`, `source_link_click`, `self_host_command_copied`, `back_link_click`, `theme_toggled`. The closed type is in `lib/analytics.ts`: categorical props only, never personal data.
