# BuddyBudget

Personal finance management app. Multi-language and multi-currency: language and currency are chosen by the user during onboarding (default Italian/EUR, not hardcoded). Product country and language are independent: Italy (Italian/English), Germany (German/English), and `OTHER` for every other country (any language, only the features that do not depend on local rules). Newcomers land in their country's language (`CF-IPCountry`: English outside Italy and the German-speaking countries) until they pick one. Germany: national inflation integrated; essential features, income and 2026 taxes partially available in EUR. Pension and AVD (German private pension product) are kept but hidden until the product review (central switches in `lib/localization/planning-availability.ts`). The Italian pension/TFR (Italian severance pay) APIs stay blocked in DE; Analitiche runs there like in other countries, without taxes (decision 2026-10-21 in `docs/decisioni/2026-10-19-lingua-e-funzioni-dal-paese.md`). Scope, limits and verification: `docs/decisioni/2026-10-14-pianificazione-finanziaria-germania.md`.

## Rules for Claude

- **English is the repository language** (decision of 2026-10-15, `docs/decisioni/2026-10-15-english-as-repo-language.md`): code comments and JSDoc, commit messages, PR titles and descriptions, issues, decision entries, specs, plans, runbooks and every other piece of documentation are written in English, in this repo and in `buddy-budget-infra`. Only user-facing text stays in Italian (app and landing UI, translation catalogs, legal pages, emails and notifications to users). When you touch a file that still has Italian comments, translate the ones you change. Italian tax terms (zainetto fiscale, regime amministrato, TFR...) keep their original name with a short English explanation. Replies to Daniele in the project chat stay in Italian.
- **Free git operations** (decision of 2026-07-21, revokes the previous rule): Claude may run any git command in this repo, including operations previously reserved to the user (`merge`, `push`, `branch -d`, worktree removal, etc.), without asking for confirmation each time. The general caution guidelines for destructive/hard-to-undo actions still apply (e.g. confirm before `push --force`, `reset --hard`, deleting branches with unmerged work).
- **DB schema only through versioned migrations** (decision of 2026-09-26, Phase 0 of the VPS migration): `db:push` no longer exists. Every schema change (`lib/db/schema/`) requires `pnpm db:generate` + a committed migration + `pnpm db:migrate` on the development DB, then (as long as we are on Neon) on the production DB **before** the merge that uses it.
- **Ask follow-up questions only when the request is ambiguous or has a significant impact** (architectural choices, unspecified behavior, several plausible interpretations). For clear or limited-scope requests, proceed directly without asking for confirmation: the goal is not to slow work down with unnecessary questions.
- **Every feature, bug, technical debt, task or manual check must be tracked on Slack** (decision of 2026-09-27): in the Slack List "BuddyBudget — Backlog" (https://buddybudget.slack.com/lists/T0C5LCECH6U/F0C4THFDKD0, private channel `#bb-backlog`, id `C0C4THFBUBU`). This applies both to new items (idea, bug found, debt surfaced in a review, deferred scope) and to status changes (Da fare → In corso → Fatto, Sospeso, Scartato — To do → In progress → Done, On hold, Discarded) — at the end of the work the corresponding row must be updated. Until the Slack connector allows adding rows to the list (today `add_list_record` fails with `bot_not_found`), Claude posts the item or update as a message in `#bb-backlog` (title, type, status, priority, area, why, link) and tells the user, who copies it into the list. It does not replace the decision log below: the list says *what* there is to do and where it stands, the log says *why* it was decided.
- **Every new or changed feature updates the landing** (decision of 2026-10-01): `lib/features/catalog.ts` is the single list of features (landing on buddybudget.io, sidebar test). When a feature is released, changes or is planned, update that file and run `pnpm sync:features` in `landing/` (CI fails if the generated copy diverges); if the story changes (tour steps in `landing/content/site.ts`, comparison rows) update that too. A feature is not "complete" until the landing reflects it, and the PR says so (even just "no impact on the landing").
- **Landing screens are screenshots of the real app** (decision of 2026-10-01): they are generated with `pnpm demo:seed` + `pnpm capture:screens` (guide `docs/landing-screens.md`) and live on the `screenshots` branch, one commit replaced by the daily `landing-screens.yml` run, never on `main` (decision of 2026-10-21: the history was 500 MB of old screenshots). `pnpm screens:pull` in `landing/` downloads them; a visual change is picked up by the daily run after the merge; a PR that adds a screen publishes its capture with `pnpm screens:push`. The `screens.test.ts` test only checks that routes and files exist.
- **URL routes in English** (decision of 2026-10-19): every new page or route in the app and the landing gets an English path (e.g. `/changelog`, not `/novita`); existing Italian routes stay as they are.
- **PR titles in Conventional Commits** (decision of 2026-10-03): `feat: …` (new feature, bumps the minor), `fix: …`/`perf: …` (patch), `refactor:`/`docs:`/`chore:`/`ci:`/`test:`/`build:` (no release); `!` after the type for breaking changes. The title becomes the squash commit and release-please derives version and CHANGELOG from it (`docs/rilasci.md`). A check (`Titolo PR`) verifies it.
- **Living architecture docs** (decision of 2026-10-17, `docs/decisioni/2026-10-17-living-architecture-docs.md`): `docs/architecture/` describes how the code works today, one page per area (overview, principles, data model, each calculation with a worked example, limits, tests). A PR that changes behaviour described there updates the page in the same PR; a new area or calculation gets its section. Specs and plans in `docs/superpowers/` are history and are not updated afterwards. The index of all documentation is `docs/README.md`; the public direction is `ROADMAP.md`.
- **Keep this file up to date.** Whenever a project decision is made, a technical choice is changed, or a significant phase of work is completed, add a short entry (3-8 lines) as a **new file** in [`docs/decisioni/`](docs/decisioni/) (`AAAA-MM-GG-titolo.md`, i.e. `YYYY-MM-DD-title.md`, one per PR: no more entries at the top of a shared file, which avoids conflicts between parallel PRs) and update "Project status" below if the overall status changes. The details of a piece of work go in its spec/plan in `docs/superpowers/`, not here. The goal is that a new chat can read this file and immediately have the context, without having to ask the user to repeat explanations already given.
- **Always keep explicit track of three things, in "Project status" and/or in the linked spec/plan documents**: (1) what is being done now, (2) what was consciously decided to skip/defer and why, (3) what is planned for the future and when to come back to it. Do not let a cut scope or a paused plan get lost in the conversation: if a plan is suspended (e.g. to change priorities), update its status in the file itself instead of leaving it silently incomplete.

## Architecture principles

### Reusability

Every module, component or function written for this application must be designed to be reusable:
- **Explicit props instead of hardcoded dependencies**: a component must not make assumptions about the context in which it is used. Data that can vary (navigation items, labels, hrefs, callbacks) is passed as a prop with sensible default values.
- **No circular dependencies between layers** (see the "Layered organisation" section below).
- **Barrel file** for every feature folder (`index.ts`): whoever imports from outside always uses the barrel, never the internal files directly. This allows internal refactoring without breaking consumers.
- **Exported types**: every interface/type used in the props of a public component must be exported, so callers can type their data without duplicating definitions.

### Maintainability

- **Minimum mandatory JSDoc** on every public component and function: one `/**` line describing what it does, the non-obvious use cases and the significant props. Do not comment what the code already says by itself.
- **State / UI separation**: state logic (Context, hooks, calculations) lives in files separate from JSX components. UI components receive ready-made data via props.
- **No hardcoded values in components** other than prop defaults: colors → theme tokens, visible text → props or named constants, numeric thresholds → named constants (`const SIDEBAR_MOBILE_BREAKPOINT = 768`).
- **One component, one responsibility**: if a file exceeds ~150 lines of JSX or does more than one distinct thing, it must be split.
- **No business logic in route files** (`app/*/page.tsx`): pages orchestrate components, they do not implement calculations.

### Layered organisation

Components are organised in 3 layers with one-way dependencies (higher layers depend on lower ones, never the other way round):

```
┌─────────────────────────────────────────────┐
│  app/ (Next.js routes and pages)            │  layer 3 — orchestration
│    └─ uses: layout + domain + ui            │
├─────────────────────────────────────────────┤
│  components/domain/ (financial domain)      │  layer 2 — business UI
│    └─ uses: ui                              │
│  components/layout/ (page structure)        │  layer 2 — structure
│    └─ uses: ui, own context                 │
├─────────────────────────────────────────────┤
│  components/ui/ (shadcn primitives)         │  layer 1 — primitives
│    └─ no internal project dependencies      │
└─────────────────────────────────────────────┘
```

- `components/ui/` — shadcn/ui primitives. Do not edit by hand except for adapting them to the tokens.
- `components/layout/` — page structure (shell, sidebar, topbar). Must not know about the financial domain.
- `components/domain/` — components with domain logic (StatCard, charts, financial forms). Composed from `ui/` primitives.
- `app/` — App Router routes. Pages import from all three layers and orchestrate them.

### Long-running operations: background jobs with visible progress (standard)

Standard decided on 2026-09-22 (first case: GoCardless import/sync). Any operation that can take more than a few seconds (imports, syncs, mass recalculations, user-triggered backfills) is **not** run inside the HTTP request, blocking the user with a spinner. Use this scheme:

1. **The route creates a job and responds immediately** with `{ jobId }` (validation/ownership/eligibility stay synchronous, before the job: a predictable error must arrive as an HTTP response, not as a failed job).
2. **The work runs in Next.js `after()`** (`next/server`), with an explicit `export const maxDuration` on the route. It works both on Vercel serverless (keeps the function alive up to `maxDuration`) and on a persistent Node server — no dependency on Vercel-only infrastructure (Workflow/Queues) as long as the future VPS deployment remains a hypothesis.
3. **Job state on Redis** (ephemeral, 24h TTL, per-user key), not in a Postgres table: no migrations, automatic cleanup. The state contains the phase and **real counters** (e.g. `processed`/`total`), never a time-based estimated progress.
4. **Heartbeat**: every update writes `updatedAt`; a `running` job with a heartbeat older than a threshold is treated as interrupted (the function can die on timeout). For this reason the work must be **idempotent and resumable**.
5. **The work proceeds in blocks** (e.g. batch inserts of 50 rows), both for performance (no query per item) and to have granular progress ("Inserite 120 su 500" — "Inserted 120 of 500").
6. **The client polls the state** (TanStack Query, `refetchInterval` active only while running jobs exist) from a **global indicator mounted in the layout**, so progress stays visible when changing page; when the job ends it shows a summary.
7. The domain function that does the work accepts an optional `onProgress` callback, so it stays reusable without a job (cron, scripts, tests).

Exceptions only for explicit reasons, to be noted in the decision log.

### Observability: logs, metrics, events (standard)

Standard decided on 2026-09-27 (Observability Phase A, spec `docs/superpowers/specs/2026-09-27-osservabilita-app-fase-a-design.md`). All server code reports what happens through `lib/observability`, never with `console.*` (blocked by the ESLint `no-console` rule; exception: CLI scripts in `lib/db/`).

1. **Logs**: use `logger` (outside requests) or `requestLogger()` (inside a route, inherits `requestId`/`route`/`user`). One JSON line per event, with `event` in the `domain.object.outcome` format (e.g. `gocardless.sync.failed`). Only fields of the closed `LogFields` type are passed: if a new field is needed it must be added there, reasoning about whether it carries personal data.
2. **Never in logs or in metric labels**: emails, names, IBANs, amounts, transaction descriptions/notes, merchant names, tokens/secrets, cookies, request bodies, plaintext `userId`. The user appears only as `user` = `hashUserId(id)`, and never as a label. Error messages go through `redactText` (emails, IBANs, UUIDs, bearer, Drizzle `params:`), but that is a safety net and not the main mechanism.
3. **Every new API route** is exported as `export const GET = withRoute("<resource>.<action>", handleGet)`, with a **static** name (never the path with ids: it ends up in metric labels). In authenticated routes call `bindRequestUser(session.user.id)` right after the session check. Probes and scrapes use `{ quietOnSuccess: true }`.
4. **Metrics**: `buddybudget_` prefix, unit in the name (`_seconds`, `_total`), labels only from closed enums (`record*` functions in `lib/observability/metrics.ts`, not raw prom-client objects). Everything that must hold across several pods or survive a restart (last success of a cron, running jobs) lives on Redis (`OpsStore`) and is read at scrape time.
5. **Cron**: every cron calls `recordCronRun(name, outcome, duration, { store })`, which also writes the heartbeat used by the "cron did not run" alerts.
6. **Product events**: `track()` from `lib/analytics` (Umami) after the successful outcome of an action, with only categorical props or counts. Event names are a closed type (`ProductEvents`).
7. `GET /api/metrics` responds only with `Authorization: Bearer <METRICS_TOKEN>`; without `METRICS_TOKEN` it responds 404 (so it stays off on Vercel).

#### Every feature is observable (definition of done)

Rule decided on 2026-10-01: a feature is not "complete" until in production you can **see what happens** and **understand how it is going**. Before closing it (and opening the PR) answer these questions, and the PR reports them in one line each:

1. **Logs**: every outcome that matters (success of an important action, every handled error, every fallback) has a `domain.object.outcome` event via `requestLogger()`/`logger`, filterable in Loki with a query. New routes use `withRoute`.
2. **Umami**: every user action the feature introduces or changes has an event in `ProductEvents` and a `track()` after the successful outcome (also edit and delete, not only create), with only categorical props or counts. It serves to understand whether the feature is used, not only whether it works.
3. **Metrics and alerts**: if the feature has background work, a cron or an external dependency (API, data source, email), it has a metric with `record*` and `recordCronRun`, and if it can fail without the user noticing it has an alert in the infra repo (rule in `argocd/apps/grafana.yaml` + runbook in `docs/runbooks/`).
4. **Dashboard and guide**: if it adds metrics, a panel in the right dashboard (infra repo) and a line in `docs/osservabilita.md`.
5. **After deploy**: in the PR, "How to verify in production": which Loki query, which metric and which Umami event to look at, and what values to expect.

A purely visual or calculation change with no new observable outcomes may declare "no new signal" in the PR, but it must be declared, not omitted.

### Performance and animations (standard)

Standard decided on 2026-10-11 after the performance review (`docs/decisioni/2026-10-11-prestazioni-caricamento.md`). Every interface change keeps an eye on weight, loading and motion; the PR states in one line what changed, or "no impact on performance".

1. **JS weight**: `index.ts` barrels that export charts (Recharts) or other heavy code are not imported from the sidebar, layout or other areas to use a small helper: use a light barrel (example: `components/domain/investments/light.ts`) or move the helper to its own file. A heavy or rarely seen component (dialog, secondary tab) is loaded with `next/dynamic`.
2. **Loading without jumps**: every screen has a loading state (`loading.tsx` or placeholder) with a height close to that of the content, and blocks that appear after the data reserve their space: the goal is CLS below 0.1. No block that appears suddenly, pushing the rest.
3. **Data**: request only what is needed (date windows and `compact` as for the net worth history), the same information is not requested twice with different ranges, and queries for rarely changing data have a `staleTime`. Before adding one to a query, check that mutations invalidate it.
4. **Rendering**: no heavy calculation in render (`useMemo`, `useDeferredValue` for sliders, a Worker if needed); charts have no entry animation (`isAnimationActive={false}`), animate only what communicates a change.
5. **Animations**: short duration (under 300 ms for transitions, under 600 ms for numbers), never on first appearance of data or on long lists; use `components/motion/` and `lib/motion/springs`, respect `prefers-reduced-motion` (`MotionConfig reducedMotion="user"`), no light effects. Animated numbers only for key figures that change because of a user choice or new data.
6. **How to verify**: production build with demo data (`pnpm demo:seed`), Chromium with slow network and throttled CPU; look at JS loaded, time to first data call and CLS before and after, and the numbers go in the PR.

## Stack

- Next.js (App Router) + TypeScript
- pnpm as package manager
- Tailwind CSS v4 + shadcn/ui (`base-nova` style, components on `@base-ui/react`, `lucide-react` icons)
- `next-themes` for the light/dark theme

Application layer (decided in `docs/superpowers/specs/2026-07-03-tech-stack-architecture-design.md`, implemented):

- **Database**: self-hosted Postgres (in-cluster container) + **Drizzle ORM**
- **Authentication**: better-auth (magic link + Google OAuth), transactional emails via Resend
- **API**: Next.js Route Handlers, consumed client-side with **TanStack Query**
- **State management**: React Context for local UI state, TanStack Query for server state; Zustand only if a concrete need emerges
- **Cache**: Redis (job state, cron heartbeats, market-data caches and derived calculations); better-auth's rate limiter is in-memory per pod, not on Redis
- **Charts**: Recharts via the shadcn/ui `Chart` component
- **Observability**: VictoriaMetrics + Loki + Alloy + Grafana, Umami for product events (see the standard above and `docs/osservabilita.md` in the infra repo)
- **Deployment**: single-VPS k3s cluster (Hostinger, Düsseldorf), Ansible provisioning, ArgoCD + SOPS/KSOPS, ingress via Cloudflare Tunnel + Traefik, admin only via Tailscale. **Since 2026-09-27 production is on k3s** (since 2026-10-01 the move to `buddybudget.io` = static landing in `landing/` on Cloudflare Pages, `app.buddybudget.io` = app is in progress: see `docs/decision-log.md`); Vercel and Neon are switched off (secret rotation and final shutdown: Task 8 of Phase 7, see Status). The code stays portable to serverless too (no long-lived in-memory processes, cron as `/api/cron/*` endpoints). Infra repo: `YonderUrik/buddy-budget-infra`.
- **CI/CD**: GitHub Actions (lint, tsc, test) → image on GHCR → release-please keeps open a release PR computed from PR titles; when it is merged it creates the tag and GitHub Release and CI updates the `X.Y.Z` tag in the infra repo → ArgoCD does the rollout. Migrations are applied by an ArgoCD `PreSync` Job before the rollout.

## Commands

```
pnpm dev      # development server
pnpm build    # production build
pnpm lint     # ESLint
pnpm test              # vitest (uses DATABASE_URL: development DB, or an empty migrated DB)
pnpm db:generate        # generates a migration from the TypeScript schema (after every change to lib/db/schema)
pnpm db:migrate         # applies pending migrations (DATABASE_URL from env or .env.local)
pnpm db:mark-baseline   # one-off: records the baseline on an existing, already aligned DB
docker build -t buddy-budget:local .   # app image (migrator target: --target migrator)
```

## Structure

```
app/                         App Router routes
  (auth)/                    login, onboarding (without AppShell)
  (app)/                     screens with AppShell: panoramica, liquidita (movimenti/analisi/conti/categorie/regole),
                             categorizza, investimenti (6 tabs + securities), debiti, impostazioni, style-guide
  api/                       route handlers (all with withRoute), cron in api/cron/*
  globals.css                design tokens (CSS variables) and Tailwind theme
components/
  ui/                        shadcn primitives (layer 1)
  layout/                    shell, sidebar, topbar (layer 2 — structure; barrel index.ts)
  domain/<feature>/          domain components per feature (layer 2), each with a barrel
lib/
  db/schema/ + migrations/   Drizzle schema and versioned migrations
  calc/                      pure, tested calculation engines (spending, cashflow, returns, taxes, amortisation, debts...)
  observability/ analytics/  logs, metrics, product events
  <feature>/                 domain logic per area (gocardless, categorization, investments, market-data, net-worth, debts, account...)
landing/                     static marketing site (buddybudget.io), a separate Next.js project with its own package.json, CI and nginx image in the k3s cluster (not Cloudflare Pages); content in landing/content/
docs/
  README.md                  index of all documentation, by audience
  architecture/              living docs: how each area works today (update with behaviour changes)
  product-vision.md          product vision (summary)
  functional-spec.md         what the original mockup did (history)
  decisioni/                 one decision per file (since 2026-10-04); decision-log.md is the earlier archive
  design-reference/          original mockup
  superpowers/specs|plans/   specs and plans for each feature
```

## Design tokens

All colors, fonts and radii are defined as CSS variables in `app/globals.css` (`:root` for the light theme, `.dark` for the dark one), extracted from the mockup in `docs/design-reference/mock-up.html`. The variables are exposed to Tailwind through the `@theme inline` block, so they are available as utility classes (`bg-background`, `text-foreground`, `bg-primary`, `text-pos`, `bg-neg-soft`, `rounded-xl`, etc.).

**Rule**: never use hardcoded hex colors or radius values in components. Always use the theme tokens (Tailwind classes or `var(--token-name)`). If a new token is needed, add it in `globals.css` (for both `:root` and `.dark`) instead of introducing a one-off value.

Finance-specific tokens (in addition to the standard shadcn ones):
- `--pos` / `--pos-soft`: positive amounts, income
- `--neg` / `--neg-soft`: negative amounts, expenses
- `--text-2` / `--text-3`: secondary/tertiary text levels

Fonts: two typefaces only. `font-display` (Sofia Sans Extra Condensed) for page and section titles; Hanken Grotesk for everything else (`font-sans`, and `font-heading`, kept as an alias for highlighted figures, which sets `tabular-nums`). No monospace outside literal code (`<pre>`/`<code>`, system mono stack): figures that must align use the sans with `tabular-nums`.

## Component conventions

- shadcn components are added with `pnpm dlx shadcn@latest add <name>` and live in `components/ui/`; do not edit them by hand except to adapt them to the theme tokens.
- **On mobile, popovers, dialogs and confirmations are bottom sheets** (default of `PopoverContent`/`DialogContent`/`AlertDialogContent`, drag down to close): callers do not need `max-sm:` classes. Long forms: `FormDialogContent` (full screen). Inline panels under a row: `InlineOrSheet`, which opens them in a sheet on the phone.
- **Section headings** use `SECTION_TITLE` (condensed face) with no icon beside them; list rows and blocks inside a page are separated by space, not by thin rules (`divide-y`/`border-b`), except in real tables, dialogs and sticky action bars (decision `docs/decisioni/2026-10-17-taste-skill-nell-app.md`).
- **Sections with several views** (Liquidità, Investimenti, Pensione — Cash, Investments, Pension): header with `SectionHeading` (on the phone the title opens the sheet of views) and `SectionTabs` (segmented from `lg`).
- **Page layout**: every page uses `PAGE_FRAME` (`components/domain/shared/page-layout.ts`); narrow screens add `PAGE_READABLE`, never their own centred `max-w-*`. Two-column areas use `PAGE_SPLIT` or `@…/main` container variants (the room left by the sidebar), never viewport `lg:`/`xl:`; hero charts bleed only on the phone (`PAGE_BLEED`).
- **Desktop sidebar as islands**: menu, each summary module and the account are separate cards (`SIDEBAR_ISLAND_CLASS` in `lib/sidebar/island.ts`); a new sidebar module takes the slot's `cards` flag and draws its own card. Hover on vertical lists of links that should feel connected uses `HoverHighlight` (`components/motion`), not a per-item `hover:bg-*`.
- **Adding things**: one app-wide «Aggiungi» (bottom bar and sidebar). Something new users can add gets an entry in `lib/quick-add/actions.ts` (tier, form or page) and, if it is a form, a slot in `components/domain/quick-add/quick-add-forms.tsx`; sections do not draw their own add button in the header (empty states keep one).
- **Back**: the app-wide «‹» button (`TopBarBack`/`PageBackBar`, mounted in the layout) handles going back on every page. A new second-level page adds its name and parent in `lib/navigation/back-history.ts`; it does not draw its own back link. `BackLink` remains only for in-page states (e.g. a step back inside one page). Never hand-made arrows or «Torna a…» ("Back to…") links.
- Domain-specific composite components (e.g. `StatCard`) live in `components/` and must be built by composing the primitives in `components/ui/`.
- User-visible strings go through `lib/localization` (`translate`, catalogs for `it`/`en`/`de`); some older screens still have hardcoded Italian strings, which are extracted into translation keys when touched.

### "Coming soon" screens and feature catalog: what to update when one is implemented

The list, area, descriptions and status (`live` / `new` / `soon`) of all features live in **a single place**: `lib/features/catalog.ts`. The landing reads it and keeps a generated copy (`landing/content/catalog.generated.ts`, updated with `pnpm sync:features` in `landing/`; CI checks they are aligned). The `lib/features/catalog.test.ts` test fails if the sidebar and the catalog diverge.

When implementing a planned screen (today: Pianifica, Analitiche — Plan, Analytics):

1. `components/layout/sidebar.tsx` → `NAV_ITEMS`: **remove `comingSoon: true`** and check that `href` matches the real route.
2. `lib/features/catalog.ts`: move the entry from `soon` to `new` or `live` (and update the description if needed); then `pnpm sync:features` in `landing/`.
3. A **new feature** (not planned) is added to the catalog as `new` (then `live`) and the sync is run: the landing shows it by itself, but check that the text holds up on the page.

A new screen or feature is not "complete" until the catalog is updated, together with "Project status" below.

## Project status

**Same page column everywhere (2026-10-25)**: after the sidebar islands, hero charts ran into the menu card and the window edge, two-column splits kicked in at a 1024 px window with only 724 px of page, and sections used four widths. Now one `PAGE_FRAME`, the 3/5 + 2/5 split from container queries on `<main>` (two columns from a 56rem content area), charts bleeding only on the phone. Phone unchanged, no migration. Entry in `docs/decisioni/2026-10-25-pagine-uniformi.md`, living doc §4.1 of `docs/architecture/overview.md`. Branch `claude/project-thread-0jmrsy`.
**One «Aggiungi» for the whole app (2026-10-24)**: a yellow round + beside the phone's bottom bar (Debiti moves to «Altro») and a grey «Aggiungi» pill under the sidebar logo open «Cosa vuoi aggiungere?»: the frequent things first and bigger (movement, investment operation, transactions from a file, broker statement), the others under «Ogni tanto» (account, subscription, loan, pension fund, goal), tiles on the phone and a list next to the button on desktop (phone B + desktop A chosen by Daniele, hierarchy his ask). Forms open over the current page; section header add buttons removed, empty states unchanged; `?aggiungi=` links; Umami `quick_add_opened`/`quick_add_chosen`. No migration. Entry in `docs/decisioni/2026-10-24-pulsante-aggiungi.md`, living doc §4.18 of `docs/architecture/overview.md`. Branch `claude/project-thread-2yt4ia`. Deferred: tiers that learn from each user.
**Desktop sidebar as islands (2026-10-24)**: style only, same content: the desktop sidebar is a column of cards (menu, one per summary module, a one-row account card with e-mail and version moved into the avatar menu), yellow active pill and a grey hover pill that stretches from item to item (`HoverHighlight`). Variant B2 chosen by Daniele among a floating card, islands and a navy card. Phone drawer unchanged. Entry in `docs/decisioni/2026-10-24-sidebar-a-isole.md`. Branch `claude/project-thread-sksn2v`.
**Budget of the month (2026-10-22)**: new Liquidità → Budget tab (`/liquidita/budget`, `GET /api/budgets/month`): what can still be spent this month, money per day, where each category is heading, budgets proposed from the user's months (`POST /api/budgets/accept-proposals`), rollover per category (on by itself for Saltuarie) and one-month amounts; alerts, the monthly summary, Panoramica and Analisi (one month) read the same month; a «Primi passi» step (not for users who had finished them), a landing tab with real screenshots, an Aiuto answer and the ZIP export follow it; onboarding unchanged on purpose. Migration 0049 (number to recheck at merge: Stripe #466 also uses 0049). No envelopes, no «copy last month». Entry in `docs/decisioni/2026-10-22-budget-del-mese.md`, living doc §4.11 of `docs/architecture/categorisation.md`. Branch `claude/project-thread-c9cuty`. Deferred: Analisi periods longer than a month on month amounts.
**Language and features from the country (2026-10-19)**: the visitor's country (`CF-IPCountry`) picks the starting language of landing, sign-in, onboarding, sign-in email and demo (English outside Italy and the German-speaking countries; a hand-picked language wins); new product country `OTHER` where only Pensione («Presto» in the menu) and the investment taxes tab are closed; income, Analitiche, goals and FIRE run before tax, also for Germany (`NavLock`, `/country-unavailable`, Umami `country_feature_requested`); landing hides pension/tax blocks by country (`bb-country` cookie from nginx, never for crawlers). No migration. Entry in `docs/decisioni/2026-10-19-lingua-e-funzioni-dal-paese.md`, living doc §4.8 of `docs/architecture/overview.md`. Branch `claude/project-thread-2pfcjb`. Deferred: remembering which country `OTHER` is, a German landing.
**Native sign-in and launch state (2026-10-21)**: after the bearer sessions of #470, the native apps get public `GET /api/legal`, coded proxy 403s (`account_deactivated`, `legal_acceptance_required`), `GET /api/me/bootstrap` (profile, gate, country capabilities; gates shared with the proxy in `lib/account/gates.ts`, self-hosted installs skip the legal gate) and sign-in with a 6-digit emailed code (better-auth `emailOTP`, sent through `sendEmail()`, dev-only `auth.otp.dev_code` log). Entry in `docs/decisioni/2026-10-18-api-mobile-fondamenta.md`. Branch `feat/native-sign-in`. The remaining mobile backend (server views, paged transactions, error codes, metadata and native bank linking) is isolated on `codex/mobile-backend`; native iOS/Android apps and their build settings are delivered separately. See `docs/decisioni/2026-10-21-mobile-backend-only.md`.
**Bank connection «In arrivo» (2026-10-19)**: new GoCardless connections are closed on the hosted version (`BANK_CONNECTIONS_OPEN`, unset = closed when hosted, open when self-hosted); existing connections keep working and can still be renewed. «Nuovo conto» shows the bank choice last with «In arrivo» and «Tienimi aggiornato» (`bank_connection_interest`, migration 0048, number to recheck at merge; gauge `gocardless_capacity{measure="interested"}`, Umami `bank_connect_interest_registered`); landing, /sicurezza, catalog (`soon`) and empty states no longer promise the connection. Privacy updated, `LEGAL_VERSION` 2026-10-21. Entry in `docs/decisioni/2026-10-19-collegamento-banca-in-arrivo.md`, living doc §4.1 of `docs/architecture/bank-sync-and-imports.md`. Branch `claude/project-thread-mg2hem`. Deferred: the one-off announcement email to the people waiting, when a provider is in place.
**Zero data retention on AI (2026-10-19)**: every OpenRouter request sends `OPENROUTER_PRIVACY` (`lib/llm/openrouter.ts`, guarded by a test) and the hosted account enforces ZDR for all models; Privacy (new `#zero-data-retention` section), Terms, Settings, onboarding and /sicurezza say so, with the limits (OpenRouter usage metadata, our 30-day logs). `LEGAL_VERSION` 2026-10-20 (everyone re-accepts). Entry in `docs/decisioni/2026-10-19-zero-data-retention-ai.md`. Branch `claude/project-thread-8tsscu`.
**Imports already present (2026-10-19)**: the same CSV/Excel file uploaded again is refused before any analysis, and a file with some movements already imported adds only the new ones with «12 su 40 movimenti importati: gli altri c'erano già.» (or «Niente di nuovo da importare»); duplicates are now found across all the user's sources (choosing «Nuova banca o broker» again used to import every row twice). No migration. Entry in `docs/decisioni/2026-10-19-import-gia-presenti.md`, living doc §4.8–4.9 of `docs/architecture/bank-sync-and-imports.md`. Branch `claude/project-thread-hskqu4`. Unchanged: partly overlapping broker statements stay refused.
**«Dall'ultima visita» (2026-10-19)**: a returning user opening the app gets one toast with what happened while away (new movements, price alerts, subscription price rises) and what waits (movements without a category, subscriptions to confirm, imports to check), with one action; once per visit, a visit ends after 30 minutes without the layout heartbeat (migration 0046). A first version as a block in Panoramica was dropped. Entry in `docs/decisioni/2026-10-19-dall-ultima-visita.md`, living doc §4.17 of `docs/architecture/overview.md`. Branch `claude/welcome-back-summary-dgmyt8`. Deferred: net worth change since the last visit, push notification in the native app.
**Bank categories in imported files (2026-10-19)**: when a personal CSV/Excel import has the bank's own category column, transactions take the matching category without asking (`categorySource = banca`, «Banca» in «Messe dall'app», rules win, corrections teach later imports, no AI in the mapping); migration 0045. «Messe dall'app» is now a 30-day history with nothing to confirm (no counter, no «Va tutto bene») and the automatic threshold is 70% instead of 90%. Entry in `docs/decisioni/2026-10-19-categorie-della-banca-negli-import.md`, living doc §4.6 of `docs/architecture/categorisation.md`. Branch `claude/import-bank-categories-ky70b1`. Privacy and Terms updated, `LEGAL_VERSION` 2026-10-19 (everyone re-accepts). Deferred: categories from GoCardless, professional review of the legal texts.
**Transaction detail (2026-10-19)**: tapping a transaction in Movimenti, Categorizza or a subscription opens its detail (bottom sheet on the phone, window on desktop) with origin, who chose the category, bank text, note and the same merchant over the last year, plus «Chiedi all'AI» for a second opinion on the category; `GET /api/transactions/[id]`, `POST /api/transactions/[id]/ai-suggestion`. Entry in `docs/decisioni/2026-10-19-dettaglio-del-movimento.md`, living doc §4.13 of `docs/architecture/categorisation.md`. Branch `claude/movement-detail-pdsyig`. Deferred: a URL per transaction, Debiti's picker.
**Cash history follows imports (2026-10-19)**: the Panoramica and Liquidità charts follow imported files, connected banks and edited or deleted transactions on every past day they touch (cash rows store their ledger part, migration 0043 — number to recheck at merge), and say «Sto aggiungendo i nuovi movimenti…» / «Aggiorno il grafico…» while an import or sync is on its way in. Entry in `docs/decisioni/2026-10-19-storico-liquidita-segue-i-movimenti.md`, living doc §4.1 and §4.13 of `docs/architecture/net-worth.md`. Branch `claude/project-thread-hvlmqg`. Deferred: past of manual accounts, broker statement cash accounts as ledger accounts.
**«Primi passi» react to imports (2026-10-19)**: the movements step ticks for any real transaction (CSV imports used to be missed), the steps are re-read every 15 s while incomplete, and every step but the account can be skipped with «Non mi serve» (`auth_user.start_skipped`, migration 0044, number to recheck at merge) so the checklist can close. Entry in `docs/decisioni/2026-10-19-primi-passi-reattivi.md`. Branch `claude/primi-passi-reattivi`.
**Guidance after onboarding (2026-10-18)**: onboarding asks «Cosa vuoi tenere sotto controllo?» (`auth_user.start_focus`, migration 0042, number to recheck at merge: 0041 belongs to #404) and the «Primi passi» follow it; Panoramica shows one next step in a filled block (sample data beside it), every step done anywhere in the app gives a «done, next» toast, Liquidità tabs without accounts explain themselves, and the noise for a new user is gone (0 € line, old «Novità», goals invite, FIRE hint). Entry in `docs/decisioni/2026-10-18-guida-dopo-l-onboarding.md`, living doc §4.12 of `docs/architecture/overview.md`. Branch `claude/post-onboarding-guidance-xlop9m`. Deferred: deep links to the add forms in Debiti/Investimenti, steps after the checklist.
**Self-hosting sign-in and setup (2026-10-18)**: self-hosted installs sign in with email and password (no mail server needed), only the first account signs up unless `ALLOW_SIGNUPS=true`, password reset and new accounts from the CLI (`pnpm auth:reset-password`, `pnpm auth:create-user`), emails through Resend or any SMTP (`sendEmail()`), no Terms/Umami/project reports on self-hosted, notifications cron and AI CSV worker (profile `ai`) in the compose. Hosted version unchanged. Entry in `docs/decisioni/2026-10-18-self-hosting-password-login.md`, guide `docs/self-hosting.md`. Branch `claude/self-hosting-review-z600ip`. Deferred: OIDC/passkeys, arm64 images by default.
**taste-skill in the app screens (2026-10-18)**: section headings without icons in the condensed face, the same everywhere (Impostazioni and Aiuto included, without icon tiles), no thin rules between rows, pill buttons and controls, no icons in section tabs; sidebar and screen openings unchanged (a navy opening field and condensed sidebar titles were tried and dropped). Entry in `docs/decisioni/2026-10-17-taste-skill-nell-app.md`. PR #427, branch `claude/project-thread-jhb3my`.
**taste-skill across the product (2026-10-17)**: `impeccable` replaced by taste-skill (`.claude/skills/taste-skill/`, MIT). Landing rebuilt on its «Type and nothing else» direction: colour fields instead of rules and boxes, the four places as a live list visitors can type over, the net before selling as two giant figures on yellow, trust as a table, sticky bar that takes the chapter colours; two faces only (Space Grotesk and Geist Mono dropped), no mono labels, no device or browser frames, pill buttons. Sign-in and app follow the house rules (no gradients, no resting shadows, no tiny capitals, filled cards). Entry in `docs/decisioni/2026-10-17-taste-skill.md`. Branch `claude/project-thread-yzxjw4` (on top of the launch PR). Deferred: section dividers inside app panels, a video loop on the landing.
**Screenshots in every language (2026-10-17)**: landing screenshots captured in Italian, English and German (demo texts per language, German with German rules; Pension and Analytics fall back to English) and shown in the visitor's browser language (`?lang=` to force); the daily bot captures all three. The app now proposes the browser language when no choice is saved (signed out, onboarding). Entry in `docs/decisioni/2026-10-17-screenshot-in-ogni-lingua.md`, guide `docs/landing-screens.md`. Branch `claude/project-thread-34w044`. Same PR: hardcoded `it-IT` formats replaced by the user's locale, the remaining Italian words in values and sentences translated, emails sent in the recipient's language, API error messages translated centrally by `withRoute`. Deferred: landing texts in English/German; AI prompts and support reports stay Italian (owner only).
**Public demo and launch blockers (2026-10-17)**: `/demo?country=IT|DE&lang=it|en|de` opens one of four shared read-only sample accounts (Italy it/en, Germany en/de, chosen again from the demo's footer) without signing up (writes refused in the proxy and in a better-auth hook, strip with «Crea il tuo account», «Prova la demo» on the login page), rebuilt every night by `/api/cron/public-demo`, off unless `PUBLIC_DEMO_ENABLED=true`; every release now publishes the `latest` images. Entry in `docs/decisioni/2026-10-17-demo-pubblica.md`. Branch `claude/project-thread-bxot8d` (and in the infra repo), built on PR #409. Deferred: per-visitor sandboxes, arm64 images by default.
**Period selector (2026-10-17)**: one `PeriodSelector` for every period choice, presets on one line with 44 px targets on the phone, «Personalizzato» as a calendar icon opening a sheet with a real day calendar (month grid in Analitiche). Entry in `docs/decisioni/2026-10-17-selettore-del-periodo.md`. Branch `claude/project-thread-r3gnnf`. Deferred: two months side by side on desktop, typed dates.
**Landing «Un numero solo» (2026-10-17)**: home rebuilt around one promise, «Tutti i tuoi soldi, in un numero solo» (direction A chosen by Daniele among three): opening with the real Panoramica and a sum card (bank + investments + pension fund − loans = net worth, one animated moment), «Da quattro posti, un numero» (four ledger rows with flags and broker logos), «Cosa ti dice, ogni giorno» (five swipeable tabs with real screens and their figures), «Legge soltanto. Non sposta soldi.» with the navy «Sotto il cofano» panel for tinkerers, questions as tap-to-open rows, navy closing. Two registers (plain headline, technical line right after), phone-first navigation (full-screen menu, fixed bottom button, swipe track), content pages ending with the same closing, sign-in preview with the same sum. Removed: the pinned story, gallery, «Funziona con», rules and calculators as home sections. Entry in `docs/decisioni/2026-10-17-landing-un-numero-solo.md`, rules in `landing/DESIGN.md`. PR #403 merged. Then, after Hermes Agent: navy opening, tall condensed titles (Sofia Sans Extra Condensed) with numbered labels, big Panoramica right after the opening, self-hosting commands to copy, wordmark in the footer; brand yellow for the main buttons, navy heads on content and legal pages, filler lines removed; the same titles and yellow button on the sign-in pages and in the app (page titles in the display face, yellow on the active nav item and the page's main action) (`docs/decisioni/2026-10-17-landing-navy-dopo-hermes.md`, PR #405 merged); then section titles in the display face across the app and the landing's content and legal pages, and simulator answers as one big figure (`SimulationResult`, `docs/decisioni/2026-10-17-titoli-e-risultati-nei-simulatori.md`). Deferred: Safari/iPhone check, Lighthouse, OG image to check on the social networks.
**Real back button (2026-10-17)**: one «‹ Back» for the whole app, in the phone top bar (in place of the brand) and above the page on desktop. It goes back to the screen the user came from, also between sections (sessionStorage history, `lib/navigation`), or to the logical parent of a second-level page. Per-page back links were removed. The landing's internal and legal pages show «‹ Calcolatori/Funzioni/Home». Entry in `docs/decisioni/2026-10-17-back-link-in-first-view.md`. PR #395. Deferred: the phone back gesture closing sheets, scroll restore.
**«Rientra in BuddyBudget» (2026-10-17)**: after signing out or an expired session, `/login` opens on the remembered account (masked email, one button for the last method, «Non sei tu?» to forget it); email in localStorage and last method in a better-auth cookie, nothing new on the server. Entry in `docs/decisioni/2026-10-17-rientra-in-buddybudget.md`. Draft PR on branch `claude/project-thread-zyljue`. Deferred: emailed code for the installed app, passkeys.
**Language chooser (2026-10-17)**: flag and language in a list with a preview of dates and amounts (variant C chosen by Daniele), in the sign-in footer, onboarding and Impostazioni; country and language as two settings rows. Entry in `docs/decisioni/2026-10-17-selettore-lingua.md`. Draft PR on branch `claude/project-thread-s6peo6`. Deferred: chooser on the landing.
**English as the repository language (2026-10-15)**: all documentation (README, SECURITY, CONTRIBUTING, this file, `docs/` with decisions, specs, plans and the self-hosting guide), the PR/issue templates and the comments in CI, Docker and env examples translated to English; the rule for the future is in "Rules for Claude". File names unchanged. Entry in `docs/decisioni/2026-10-15-english-as-repo-language.md`. Draft PR on branch `claude/project-thread-axdwcm` (and in the infra repo). Deferred: comments already in the source code (translated when a file is touched), renaming Italian folders/files, the existing CHANGELOG.
**Savings goals (2026-10-15)**: «Obiettivi» ("Goals") view in Analitiche (Analytics) (`/analitiche/obiettivi`, no sidebar entry) with goals funded by portions of accounts and investments (net of estimated tax), the month's savings split by priority, arrival date and shift of the FIRE target; 5-step form, detail with «Aggiorna i soldi da parte» ("Update the money set aside"), opt-in email reminder and a line in the summary, Novità (What's new) and a section in Panoramica (Overview), catalog and landing. Migration 0038 (number to recheck at merge). Entry in `docs/decisioni/2026-10-15-obiettivi-di-risparmio.md`. Draft PR on branch `claude/project-thread-slsnx2` (and in the infra repo for the panel). Deferred: pension and debts as sources or goals, "after" effects, chart of the path, drag to reorder, automatic history.
**CSV import: rows to check (2026-10-15)**: the screen of an analysis with unrecognised rows says how many out of how many, groups errors by reason with row and original text, and allows importing the recognised rows while skipping the others, re-analysing with the AI without re-uploading, or uploading a corrected file; list, island and email aligned. Entry in `docs/decisioni/2026-10-15-import-csv-righe-da-controllare.md`. Draft PR on branch `claude/import-csv-errori-chiari-xe6ph8`. Deferred: fixing rows in the preview, reasons naming the offending column, downloadable summary of skipped rows.
**Landing «Sei domande» ("Six questions") (2026-10-14)**: home rebuilt from scratch as a scrolling story (six questions on the left, a fixed app window on the right with live panels and real screenshots, phone pinned on mobile), logos at the top, security with PSD2 explained, open source code on the home page, static nav, `/strumenti` hub with the new savings goal calculator, six FAQs; app login in the same style (`AuthFrame`, preview of the Panoramica). Entry in `docs/decisioni/2026-10-14-landing-sei-domande.md`. PR #371 merged (online with the next release); «Funziona con» ("Works with") redone as cards with uniform logos and icons (`docs/decisioni/2026-10-15-landing-funziona-con-schede.md`, PR #378 merged). Then (evening of 2026-10-15): CSS iPhone frame (`PhoneFrame`/`PhoneShot`, phone captures at 390×751 for every screen, `PHONE_ONLY=1`), story window without zoom (screenshots never cropped), «Com'è fatta, schermata per schermata» ("How it looks, screen by screen") section with the whole gallery, home/FAQ/rules/calculator texts in plain words (`docs/decisioni/2026-10-15-landing-telefono-vero-e-testi-semplici.md`, draft PR #383 on branch `claude/landing-redesign-from-zero-9qfbrj`). Deferred: Open Graph image, Safari/iPhone, per-question pages, login preview on the phone.
**Analytics from real data (2026-10-12)**: data period chosen above the sliders (last 12 months by default, 24 or a chosen number of months) for savings, spending and return, saved in the assumptions; «Dai tuoi dati» ("From your data") / «Inserito a mano» ("Entered by hand") labels with a way back to the data; yearly average from the first month with transactions. Entry in `docs/decisioni/2026-10-12-analitiche-periodo-dei-dati.md`. Draft PR on branch `claude/project-thread-5uvzok`. Deferred: different period for each figure, money-weighted.
**Categories that are safe on their own (2026-10-12)**: rules always applied (also in CSV imports) and, with «Lascia che l'app scelga quando è quasi certa» ("Let the app choose when it is almost certain") (on by default, off for those who already had AI consent), suggestions at 90% or more applied without asking; Categorizza (Categorise) with «Da decidere» ("To decide") and «Messe dall'app» ("Set by the app") (one-tap correction), origin on every suggestion and in Movimenti (Transactions) (confidence as a percentage only in the tooltip), merchant logos via Logo.dev from the server (dictionary, website written in the transaction, name search only for names seen in at least 3 users with `LOGODEV_SECRET_KEY`), transaction dates on the cards, category sheet search that resets; flow fixed (rules that apply immediately, sync counts after the automatic pass, a single «Da decidere», a line in the email summary) and «Ricategorizza» ("Recategorise") (in the «⋯» menu, with preview and undo for 7 days); texts simplified for non-experts; migrations 0034 and 0035. Entry in `docs/decisioni/2026-10-12-categorizzazione-soglia-90.md`. Draft PR #351 (and infra #46 for the panels). Deferred: adjustable threshold, list of frequent merchants for the dictionary, Ricategorizza as a job for huge accounts.
**Field encryption (2026-10-12)**: transaction descriptions and notes, debt and investment notes and tokens encrypted in the database with `DATA_ENCRYPTION_KEY` (optional, plaintext rows always readable, `pnpm db:encrypt-fields` for the old ones); entry in `docs/decisioni/2026-10-12-cifratura-campi.md`. Same PR as the Security page (and a PR in the infra repo). To do by hand: create the key and launch the job (runbook `cifratura-dati.md`). Deferred: VPS disk, key rotation.
**Security page (2026-10-12)**: `/sicurezza` on the landing with the data path (interactive diagram), what is stored and what is not, declared limits and official sources; links from menu, home, login and «Collega banca» ("Connect bank"); consent to the AI assistant in onboarding now off by default. Entry in `docs/decisioni/2026-10-12-pagina-sicurezza.md`. Draft PR on branch `claude/project-thread-i4km61`. Deferred: SSH key-only, access of the `bb_dev` role to production data, `security.txt`.
**Bank connection limit (2026-10-11)**: one bank per person, 40 new banks in total (GoCardless free plan of 50, renewals use the reserve), 3 consents per person in 31 days, slots counted under lock and also from already deleted consents (migration 0032); disconnecting the last account immediately revokes the consent on GoCardless; «In arrivo» ("Coming soon") in the «Nuovo conto» ("New account") dialog with manual account and import. Entry in `docs/decisioni/2026-10-11-limite-collegamenti-bancari.md`. PR on branch `claude/project-thread-m5z001` (and in the infra repo). Deferred: waiting list, visible remaining slots.
**Default categories and onboarding (2026-10-11)**: defaults from 33 down to 24 plus the fallback and 5 optional, with a description per category (migration 0031, also passed to the assistant), and a «Categorie» ("Categories") step in onboarding with a «Personalizza» ("Customise") sheet; entry in `docs/decisioni/2026-10-11-categorie-di-default-e-onboarding.md`. Draft PR on branch `claude/project-thread-7e3984`. Deferred: icon and color in the step, suggestions based on the bank.
**Notifications in onboarding and summary with investments (2026-10-11)**: «Quali email vuoi ricevere?» ("Which emails do you want to receive?") step in onboarding (same preferences as Impostazioni (Settings), everything off by default) and summary email with Liquidità and Investimenti in a few lines (gain for the period, dividends, contributions; no advice); entry in `docs/decisioni/2026-10-11-notifiche-onboarding-e-recap.md`. Draft PR on branch `claude/project-thread-fyuw69` (and in the infra repo for the panel). Deferred: net worth and debts in the summary, sections to choose.
**Quick report (2026-10-11)**: «Scrivici» ("Write to us") button in the sidebar and at the top on the phone, «Segnala questo problema» ("Report this problem") under import, sync and add errors (attaches the error), Aiuto (Help) page with the form at the top; support address now `support@buddybudget.io`. Entry in `docs/decisioni/2026-10-11-segnalazione-rapida.md`. PR #323. Deferred: attached screenshot, replies in the app.
**Security detail page and fundamental indicators (2026-10-11)**: page of the security (stock, ETF…) redesigned (single page): numbers in brief, chart with your purchases, risk, and for stocks multiples, per-share values, accounts, margins, ROE and debts calculated from Yahoo financial statements with the historical range and the calculation under each number; for ETFs composition, sectors, basket and cost of the TER. Entry in `docs/decisioni/2026-10-11-scheda-titolo-e-indicatori.md`. Draft PR on branch `claude/project-thread-rcuszy` (and in the infra repo for the panel). Deferred: SEC for US companies, paid sources, quarterly reports, ETF regions.
**Bottom sheets on mobile (2026-10-11)**: on the phone popovers, dialogs and confirmations open as a bottom sheet (drag down to close), including Dividi (Split) and Modifica (Edit) for transactions; desktop unchanged, long forms full screen; entry in `docs/decisioni/2026-10-11-fogli-dal-basso-su-mobile.md`. PR on branch `claude/project-thread-m82qpp`. Deferred: dropdown menus and selects.
**Inactive accounts (2026-10-11)**: daily `inactive-accounts` cron that warns by email after 83 days without sign-in and deletes at 90 those who have not come back; starts in dry-run (`INACTIVITY_CLEANUP_MODE=execute` by hand after the dry-run), migration 0029, Privacy/Terms updated with `LEGAL_VERSION` 2026-10-12 (new acceptance and review by a professional to do); entry in `docs/decisioni/2026-10-11-account-inattivi.md`. Draft PR on branch `claude/project-thread-ek292d` (and in the infra repo). Deferred: cron in the compose, old unverified emails, orphan data, exception for subscriptions.
**Self-hosting (2026-10-10)**: `docker-compose.yml` (app, Postgres, Redis, migrate, cron) and guide `docs/self-hosting.md`; Google, Resend and GoCardless now optional; multi-arch images on ghcr.io behind the `SELFHOST_IMAGES` repo variable; entry in `docs/decisioni/2026-10-10-self-hosting-docker.md`. PR on branch `claude/project-thread-a8nxln`. Deferred: cosign signing, Docker Hub mirror (the AI CSV worker joined the compose on 2026-10-18).
**First steps (2026-10-10)**: «Primi passi» ("First steps") checklist in Panoramica that fills itself from real data, resettable «Esplora con dati d'esempio» ("Explore with sample data") (`is_demo` accounts, never mixed: real data is blocked while the demo is active) and empty states with an action in Movimenti, Conti (Accounts), Investimenti and Debiti (Debts); entry in `docs/decisioni/2026-10-10-primi-passi-e-dati-d-esempio.md`, migration 0026. Draft PR on branch `claude/project-thread-ec9i5w`. Deferred: reopening the checklist from the UI, demo with investments, guard on custom imports.

**Summary and alert emails (2026-10-10)**: periodic summary (monthly by default, or weekly), budget alerts (80% and 100%) and alerts on upcoming instalments, all opt-in from Impostazioni → Notifiche (Settings → Notifications), with one-click unsubscribe (signed token, one-click `List-Unsubscribe`) in every non-service email; cron `/api/cron/notifications` in dry-run until `NOTIFICATIONS_MODE=execute` is set; entry in `docs/decisioni/2026-10-10-email-riepilogo-e-avvisi.md`. Draft PR on branch `claude/project-thread-eto0ft` (migration 0025, to recheck at merge). Deferred: alerts on investments and net worth, time of choice, testing on real clients.

**Subscriptions (2026-10-10)**: «Abbonamenti» ("Subscriptions") tab in Liquidità (`/liquidita/abbonamenti`): recurring charges detected from transactions (frequency, amount, day), to confirm or discard, with total per month and per year, next charge, price increases and subscriptions no longer charged; manual addition; saved choices (migration 0027). Entry in `docs/decisioni/2026-10-10-abbonamenti.md`. Draft PR on branch `claude/project-thread-5fqfo3`. Deferred: link with Debiti instalments, due dates in the sidebar, email/push alerts, Grafana panel.

**Animated effects (2026-10-10)**: rolling numbers, text changing letter by letter (also in buttons), greeting that emerges, tabs with a sliding indicator, dialog that grows from the button, dark island for syncs; no light effects. Components in `components/motion/`; entry in `docs/decisioni/2026-10-10-effetti-animati.md`. Draft PR on branch `claude/project-thread-0syccd`. Deferred: animations on cards/charts and toasts.

**Landing «Il foglio» ("The spreadsheet") (2026-10-11)**: home as a spreadsheet that turns into the app (direction C chosen by Daniele), broker logos, style aligned with the app (PR #311, merged). Second pass: a single tabbed «giro dell'app» ("app tour") with full screens (never cropped), flags of the banks' countries and icons, catalog trimmed to 34 entries and removed from the home page (it stays at `/funzioni`), section index removed, «E tutti gli altri» ("And all the others") card among the brokers, internal pages in the same style; entry in `docs/decisioni/2026-10-11-landing-giro-dell-app.md`. Draft PR on branch `claude/project-thread-1pbv5w`. Deferred: redo the screenshots with framings designed for the landing, Open Graph image.
**Login «Il foglio» (2026-10-11)**: the sign-in pages are a spreadsheet (formula bar, email as cell B6) with, on the right, a sheet of sample accounts that tidies itself row by row («Cosa c'è dentro», «Novità» and «In arrivo» tabs — "What's inside", "What's new", "Coming soon" — removed), title «Entra in BuddyBudget» ("Sign in to BuddyBudget"); entries in `docs/decisioni/2026-10-11-login-il-foglio.md` and `docs/decisioni/2026-10-11-landing-e-accesso-ritocchi.md`. PR #322 merged, touch-ups in PR #331. Deferred: own formula for onboarding and Terms, test on Safari/iPhone.

**New landing (2026-10-09)**: home restructured after the competitor analysis (facts at the top, three steps, Italian rules with sources, four groups, who it is for, comparison) and `/llms.txt` + AI crawlers allowed; entry in `docs/decisioni/2026-10-09-landing-nuova-struttura.md`. Draft PR on branch `claude/project-thread-kflwwq`. Deferred: per-question pages, `/sicurezza`, comparisons, glossary, Lighthouse.

**Sidebar (2026-10-09)**: «Prossime scadenze» ("Upcoming due dates") and «Obiettivo FIRE» ("FIRE goal") modules next to the summary, bottom bar on mobile and an Impostazioni → «Barra laterale» ("Sidebar") section to turn everything on/off (per device, localStorage); entry in `docs/decisioni/2026-10-09-sidebar-moduli-e-barra-mobile.md`. Draft PR on branch `claude/project-thread-mwh38f`. Deferred: reorderable modules, preferences on the account.

**Analitiche (2026-10-09)**: from proposal C chosen by Daniele, «e se…» ("what if…") sliders (savings, spending, return, withdrawal) with the target year and four answer cards in the Panoramica style; entry in `docs/decisioni/2026-10-09-analitiche-cursori.md`. Draft PR on branch `claude/project-thread-qx2vob`. Deferred: restyling of the «Per esperti» ("For experts") details, Risk as its own answer.

**Liquidità (2026-10-08)**: Conti and Movimenti unified in `/liquidita` (Movimenti · Analisi · Conti · Categorie e regole — Transactions · Analysis · Accounts · Categories and rules) with the Panoramica style as the standard, Dividi with shortcuts and category changeable from the icon; entry in `docs/decisioni/2026-10-08-liquidita.md`. Draft PR on branch `claude/project-thread-6pd4uu`. Deferred: redesign of Categorie and Regole (today they reuse the existing board and manager) and of the edit forms.

**Cost and tax impact (2026-10-06)**: two independent toggles next to the chart and a detail card in the Portfolio; taxes from the same calculation as the Tasse (Taxes) tab, with regime, rates and offsets; the «Reinvesti costi» ("Reinvest costs") and «Reinvesti imposte» ("Reinvest taxes") toggles, initially off, add to the real value the savings reinvested from the charge date at the observed daily return, updating total and chart. Scope: charges recorded on transactions and taxes on sales estimated by the Tasse tab; standalone account charges, TER and bollo (stamp duty) excluded. PR #169; branch `codex/portfolio-cost-impact`.

**Import management (2026-10-06)**: Rendiconti (Statements) tab removed; Gestisci importazioni (Manage imports) now in Operazioni (Transactions), accessible even without transactions. Old links redirected. No change to imported data.

**Broker view (2026-10-05)**: temporary per-broker filters shared across the Investimenti tabs and overlaid TWR comparison in Performance. No deletion or modification of overall net worth. Details in `docs/decisioni/2026-10-05-filtri-broker-e-confronto.md`; included in the import management PR.

**Recovery of duplicate imports (2026-10-04)**: button for a full reset of the investment history with preview and typed confirmation, including old imports without an origin. Branch `codex/reset-investment-imports`; no reset performed in production. Details in `docs/ibkr-import.md`.

**Broker cash in Investimenti (2026-10-05)**: «Includi liquidità» ("Include cash") toggle in the Portfolio card for securities + cash total, expandable detail of balances and statement date, per-broker filters also on accounts without securities. No double counting in net worth; charts and returns remain those of the securities. PR #148 under review.

**IBKR and DEGIRO import: local fix under review (2026-10-04)** on branch `codex/ibkr-local-validation`; PR authorised by the user, being opened. Persisted statements with reconciled cash, broker snapshots and non-cash adjustments; details and limits in `docs/ibkr-import.md` and `docs/degiro-import.md`. DEGIRO Account.csv is imported into the same portfolio with separate origin and cash; replacement and deletion stay isolated per broker. YTD updates atomically replace fully covered periods; import management with deletion of confirmed dependencies. Out of scope: fiscal reconstruction of lots and partial overlaps; they require, respectively, the lot detail and an export covering the periods involved.

Updated on 2026-10-01. The historical detail of each piece of work is in [`docs/decision-log.md`](docs/decision-log.md) and in the corresponding spec/plan in `docs/superpowers/`.

### Done (all on `main`, in production on k3s)

- **Base**: authentication (better-auth, magic link + Google), onboarding, Conti (manual + Open Banking GoCardless with manual sync and cron), Panoramica with net worth by asset class, spreadsheet-style login, brand identity and installable PWA, "hide amounts" button, Impostazioni page (profile, sessions, ZIP export, reset, deactivation with 30 days, deletion), version label in the sidebar, sidebar with financial summary.
- **Movimenti** (`/liquidita`: Movimenti · Analisi · Conti · Categorie e regole): transactions, income/expenses, "Dividi", notes, budget per category, spending groups (Dovute/Volute/Te futuro/Saltuarie — Needs/Wants/Future you/Occasional), rule-based automatic categorisation and the `/categorizza` page, import and sync as background jobs with progress.
- **Investimenti** (Phases 1-4 and 6 + CSV import): free price sources with automatic fallback, transactions, returns and benchmarks, risk and diversification, Italian taxation, Proventi (Income), Titoli (Securities) with watchlist and price alerts. `market-prices` cron 3 times a day.
- **Debiti**: Phase 1 (engine and loans, PR #36), Phase 2 (early repayments, PR #38). Phases 3 and 4 implemented in PR #43 (see "In progress").
- **Infrastructure**: Vercel+Neon → k3s VPS migration completed (Phases 0-7, cutover on 2026-09-27). Observability Phases A and B completed (JSON logs, metrics, 4 dashboards, 12 alerts with runbooks, Slack `#bb-allarmi`/`#bb-avvisi`/`#bb-deploy`).

### In progress

- **Analitiche** (`/analitiche`, since 2026-10-04 a page with 4 questions and "Per esperti" details, visible to everyone): implemented on branch `claude/project-thread-idnurb`, PR under review. Migration 0016 (number to recheck at merge). Deferred: long historical datasets (backtest, bootstrap, sequence stress), factors, optimal selling order, currency exposure, glidepath, automatic TER from Yahoo, Grafana panels. See `docs/decision-log.md` 2026-10-03 and `docs/superpowers/specs/2026-10-03-analitiche-design.md`.
- **Pensione** (`/pensione`, 5 tabs): implemented on branch `claude/project-thread-43tais`, without a PR. Funds and snapshots (net contributions + market value), return, withdrawal today, TFR comparison, projection, "Previdenza" (Pension) class in net worth, export/reset, catalog/landing/login updated. Before the merge: migration 0013_pensione in production (number to recheck at merge). Deferred: rates by year of joining for contributions (today a single joining date), editable inflation, more funds in the projection, import from the provider's PDF/CSV, separate employer and voluntary contributions, editing snapshots from the UI (today you re-save the same date). Import of snapshots from CSV/Excel: see `docs/decision-log.md` 2026-10-03 (PR under review; no migration). Tax rules to be validated. Spec `docs/superpowers/specs/2026-10-02-pensione-design.md`.

- **GoCardless connections**: expiry warnings (banner + email, `/conti?rinnova=1`) and `gocardless-maintenance` cron that cleans up the list on GoCardless. Draft PR; the cron starts in **dry-run** and must be switched to `execute` by hand (`GOCARDLESS_CLEANUP_MODE` in the Secret) after a few days of dry-run. See `docs/decision-log.md` 2026-10-01.
- **Debiti redesigned (2026-10-05)**: "Priorità e azioni" ("Priorities and actions") overview and Simulator integrated into loans (entry in `docs/decisioni/2026-10-05-debiti-priorita-e-azioni.md`); draft PR.
- **Debiti**: Phases 3-4 (Lombard credit) replaced by the redesign above; Lombard credit was removed from the app on 2026-10-06 (see `docs/decisioni/2026-10-05-debiti-priorita-e-azioni.md`). Spec `docs/superpowers/specs/2026-09-30-debiti-design.md`.

### Planned

- **Landing** (`landing/`): static site served by nginx in the cluster (namespace `app`, image `buddy-budget-landing`, infra manifest `argocd/manifests/landing`). Umami site "BuddyBudget Landing" created (id in the Dockerfile). **To do, in this order**: (1) move the app to `app.buddybudget.io` (`APP_URL`/`BETTER_AUTH_URL` in the Secret, Google OAuth redirect URI); (2) apex switch: remove `apex-redirect-www` and point `Host(buddybudget.io)` to the `landing` Service; (3) Open Graph image, validate story and comparison texts. See `docs/decision-log.md` 2026-10-01.

- **Observability Phase C**: read-only access for agents via MCP (never on the production VPS).
- **Phase 7, Task 8 (VPS migration)**: not before 2 weeks after the cutover (i.e. after 2026-10-11) and with the user's explicit confirmation: rotation of all secrets (they went through Vercel), final shutdown of Vercel/Neon, removal of unused Umami keys from the env (`@vercel/analytics` was already removed with GDPR PR 3). Plan: `docs/superpowers/plans/2026-09-27-fase-7-cutover.md`.
- **Screens not implemented**: Pianifica (see "Coming soon screens").
- **i18n**: the app runs in Italian, English and German through `lib/localization`; remaining hardcoded Italian strings are extracted when their screen is touched.
- **Backlog**: tracked on Slack in `#bb-backlog` (see Rules). Ideas and minor debts are there too.

### Consciously deferred

- **Investimenti**: multiple portfolios per user, foreign withholding taxes and tax return sections, PWA push notification for alerts, import preset for an Italian broker (a sample export is needed), import undo, screener (excluded), history correction around a split, ETF regions from issuers' files, rebalancing with sales, Sortino/VaR.
- **Debiti**: automatic Euribor update, foreign currencies, mixed rate/cap, informal debts, push on due dates, principal/interest share in Cash flow, editing a debt's data from the UI, ordering of debts.
- **Impostazioni**: email change, unlinking Google, email notifications, import of the export.
- **Sidebar**: popover on hover over the collapsed chip, "Prossimi eventi" ("Upcoming events") section, reorderable sections, possible grouped sidebar (alternative B).
- **Infra**: alert on failed Postgres backup (needs CNPG metrics), always-on Claude Code (never on the production VPS), Paperclip, staging, multi-node, ChatOps on Slack, `buddybudget.io` subdomain for tools behind Tailscale (needs cert-manager with DNS-01), SSH `PasswordAuthentication` still active (to be closed with a second device).
- **Cash flow/Movimenti**: showing the past in the debt balance chart, undo for bulk categorisation, keyboard shortcuts in `/categorizza`.

### To verify by hand (user's responsibility)

- **Categories**: `pnpm db:reset-categories --dry-run` then for real (if not already done); check the 4 groups in `/movimenti/categorie`, drag & drop, dialogs, mobile and dark theme (the redesign has not been tried in a browser).
- **Investimenti**: probe of the sources (`pnpm tsx scripts/probe-price-sources.ts` from local and from the VPS), real Yahoo (search, key figures, dividend history, ETF sectors), Eurostat (`inflation_index`), ECB €STR (`interest_rates`), `COINGECKO_API_KEY` to be added as a SOPS secret in the infra repo, a real price alert (Resend email), tax estimates against the Fineco statement, rate and maturity of BTPs, a real benchmark (e.g. VWCE).
- **Debiti**: rate and APR (TAEG) calculated against a real contract, history from origination against a snapshot, penalties and instalments of a real early repayment, transactions linked from the picker with real GoCardless data.
- **Impostazioni**: deactivation/deletion emails and GoCardless revocation in production, "Collega Google" ("Connect Google"). The `account-deletion` CronJob in the infra repo must be merged only with the image containing the route in production (check whether already done).
- **Login «Il foglio»**: Safari/iPhone (tabs fixed at the bottom, keyboard open on the email field) and Firefox.
- **Prices**: in the logs (`market.prices.updated`) the 3 runs a day must happen without new 429s; CNPG backup no longer hourly (`kubectl get backups -n data`) and R2 space decreasing.
- **Redirects** from the old addresses (`/spese`, `/transazioni`, `/cash-flow`, `/categorie`) and the "Aggiungi" ("Add") dialog in Movimenti.

### Known technical debt

- A manual account added later appears as a jump in the cash history (manual accounts have no past; bank and file-import accounts are rebuilt from their transactions).
- Similarity matching in the "Categorizza automaticamente" ("Categorise automatically") wizard does not discard generic words (e.g. "pagamento pos"); every suggestion is still confirmed by hand.
- In the PATCH of a transaction that changes direction via `categoryId` without sending `excludedAmount`, the value saved for the old direction can cause the update to be rejected (fail-safe, no corruption).
- `resolveDbSsl` can throw on multi-host Postgres URLs; the `migrator` stage of the Dockerfile does not force TLS; the GoCardless cron has no time budget within `maxDuration`.
- The "hide amounts" mask covers what goes through `lib/format` (amounts, rolling numbers, quantities and prices of operations, hand-drawn charts; guarded by ESLint in `app/` and `components/`); emails, form fields and `lib/` helpers that build their own strings are outside the guard (`docs/architecture/overview.md` §4.13).
- better-auth writes its own internal errors to the console, outside our `logger`: to be reassessed by looking at the logs in Loki.

### Operational notes (lessons not to repeat)

- `git fetch origin main` before trusting a comparison with `origin/main`; worktrees start from there and may be behind.
- `pnpm db:migrate` must be run in the directory of the branch that introduced the migration, never from the main repo with another branch. Renaming folders in `app/` while `pnpm dev` is running sends Turbopack into a loop: stop it and delete `.next`.
- Several sessions can write to `main` at the same time: `git status` right before every commit, `git stash list` before every `stash pop`.
- A subagent may work outside the indicated worktree: always check the real diff, not its report. With `isolation: "worktree"` the path in the prompt is ignored.
- Verify with real data and in the browser, not only with `tsc` and tests: many bugs (selects showing the id, `pathLength` with dashes, XIRR overflow) only showed up live. A "source that responds" from the cloud sandbox says nothing about production: the sandbox cannot reach Yahoo, ECB, Eurostat or the real GoCardless.
- Yahoo responds 429 to Node's TLS fingerprint: market sources go through `browserTlsFetch`. In network tests always use URLs never requested before (CDN-cached responses give false 200s).
- The CNPG `ScheduledBackup` uses a 6-field cron (seconds first); k8s CronJobs use 5. The Grafana chart passes the alerting values to `tpl`: the `{{ }}` of Grafana templates must be escaped.
- Every new service exposed via Tailscale Ingress in a namespace with default-deny needs its own NetworkPolicy for the `tailscale` namespace, in the same commit as the Ingress. After fixing a manifest error, ArgoCD may show the old one until you do a Hard Refresh.

## Decision log

The log is in [`docs/decisioni/`](docs/decisioni/) (one file per decision, since 2026-10-04) and in the archive [`docs/decision-log.md`](docs/decision-log.md) (up to 2026-10-03). Decisions still binding, in summary:

- **2026-10-03** — Automatic 0.x.y versions with release-please: **PR titles are in Conventional Commits** (`feat:`/`fix:`/`chore:`…, including Claude's), the version comes from there. The deploy starts only when the release PR is merged. See `docs/rilasci.md`.
- **2026-10-01** — GoCardless connections: expiry warnings (7 days before, email + banner) and daily cleanup of the GoCardless list with grace periods (3/7/30 days), dry-run by default, never on users with scheduled deletion.
- **2026-10-01** — Every feature must be observable (logs, Umami event, metrics/alerts if needed, "How to verify in production" line in the PR): see "Observability" above.
- **2026-10-01** — Market prices and net worth snapshots at 3 runs a day (06:30/17:30/22:30 UTC and 06:50/17:50/23:50 UTC). They are end-of-day closes, not intraday.
- **2026-09-30** — Unified sections: Transazioni, Cash flow and Categorie are `/movimenti`. Categories with a column board per spending group.
- **2026-09-30** — Debiti: schedule calculated from initial conditions + event log (like Investimenti positions); instalments marked by hand, never automatic.
- **2026-09-29** — Investimenti: positions always calculated from transactions (weighted average cost), never stored; PACs (piani di accumulo, recurring investment plans) were removed on 2026-10-04. The historical net worth of investments recalculates itself when data changes.
- **2026-09-28** — Market sources: `browserTlsFetch` for all of them (Node TLS fingerprint blocked by Yahoo).
- **2026-09-27** — Observability: cron and job state on Redis, never in pod memory; separate Slack channels by severity.
- **2026-09-27** — Brand: fixed navy sidebar in both themes; the green/red of income/expenses are not part of the brand.
- **2026-09-26** — DB schema only via versioned migrations; infrastructure on a VPS with k3s, GitOps, SOPS, Postgres with CloudNativePG and backups on R2.
- **2026-09-23** — Spending groups instead of fixed/variable (Dovute, Volute, Te futuro, Saltuarie); "Avanzo" ("Surplus") is what remains after the groups.
- **2026-09-20** — Rule-based merchant categorisation, never auto-applied except by an explicit rule; the fallback category is recognised by the `isFallback` flag, not by its name.
- **2026-07-21** — Free git operations for Claude (caution on destructive actions still applies).
- **2026-07-03** — Multi-language and multi-currency by design; 3-layer architecture; no Server Actions, Route Handlers with TanStack Query.

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
rtk uv run <cmd>        # Compact uv project command output
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
