# BuddyBudget technical architecture

**Date**: 2026-07-03
**Status**: approved

## Context

The project is currently in the design system + layout shell phase (see `CLAUDE.md`). The 9 functional screens (Panoramica, Conti, Spese, Cash flow, Investimenti, Pensione, Debiti, Pianifica, Analitiche — see `docs/product-vision.md` and `docs/functional-spec.md`) require a complete application layer: data persistence, multi-user authentication, API, and a deployment environment. This document sets the technology and architecture choices for building that layer, so that implementation starts from explicit decisions instead of implicit defaults.

It does not cover the domain data model (accounts, transactions, categories, budgets, goals) nor the implementation sequence of the screens: that is the subject of a later plan/spec.

## Starting constraints

- **Self-hosted on a VPS**, not managed platforms like Vercel.
- **Multi-user** app with real authentication (not single-user/family).
- **Manual data entry** MVP: no banking (Open Banking) or live market integration — already marked out of scope in `CLAUDE.md`.
- Whoever implements starts with **little Kubernetes experience**: the choices favour a minimal setup over advanced k8s configurations.

## Overall architecture

A single **k3s** cluster on a VPS, a single `production` namespace (no staging for now). All components run in containers in the same cluster, except email sending:

```
┌─────────────────────────────────────────────────────────┐
│ VPS — k3s cluster (namespace: production)               │
│                                                         │
│  ┌──────────────┐   ┌──────────┐   ┌─────────┐           │
│  │ Next.js app   │──▶│ Postgres │   │  Redis  │           │
│  │ (Deployment)  │   │ (PVC)    │   │ (PVC)   │           │
│  │ - UI          │   └──────────┘   └─────────┘           │
│  │ - Route       │                                        │
│  │   Handlers    │   ┌─────────────────────────────┐      │
│  │   (API)       │   │ Prometheus + Loki + Grafana  │     │
│  └──────┬────────┘   └─────────────────────────────┘      │
│         │ Ingress (Traefik, bundled with k3s)             │
└─────────┼─────────────────────────────────────────────────┘
          │
          ▼
      Users                           Resend (magic link email,
                                       the only external service)
```

A single application Deployment (frontend + API in the same Next.js process) to reduce the initial operational surface. Extracting a separate backend remains a future option if an independent consumer emerges (e.g. a mobile app), not a choice made ahead of time.

## Database and ORM

- **Postgres**, containerised in the cluster with a persistent volume (PVC) for the data.
- **Drizzle ORM**: SQL-transparent queries, no query-engine binary to include in the Docker image (unlike Prisma), migrations managed with `drizzle-kit`.
- Migrations run as a **Kubernetes Job** (or init container) executed before the rollout of the new Deployment, so the schema is always in sync with the incoming application image.

**Rejected alternative**: Prisma — more "guided" DX (Prisma Studio, declarative migration engine) but a heavier image and less transparency on the actual SQL generated, less suitable when you manage the whole infra stack yourself.

## Authentication

- **better-auth**, with two login providers:
  - **Magic link** via email (no password to manage/hash/reset).
  - **Google OAuth**.
- Transactional email (magic link) sent via **Resend** — the only non-self-hosted component of the whole stack, a deliberate choice to avoid the deliverability problems (SPF/DKIM/DMARC, IP reputation) of a self-hosted SMTP.
- Sessions managed by better-auth on **Postgres** (not on Redis), to keep the state surface down to a single store.

**Rejected alternative**: Auth.js/NextAuth v5 — equally capable (magic link + OAuth + Drizzle adapter), wider community and proven maturity, but less modern DX and typing than better-auth; born for the Pages Router, with historical conventions that still weigh on its architecture.

## API and frontend data layer

- API as **Next.js Route Handlers** (`app/api/...`), in the same service/Deployment as the frontend.
- **TanStack Query** on the client for fetching, caching and invalidating the data coming from the Route Handlers (accounts, transactions, investments, etc.).

This is a conscious deviation from the more idiomatic App Router "Server Components + Server Actions" pattern, chosen because it is more familiar to whoever implements and because it keeps the road open to future consumers (e.g. mobile) that would talk to the same REST APIs.

## State management

- No global state library (Redux/Zustand) introduced pre-emptively.
- Simple local/cross-component UI state → **React Context** (a pattern already in use for `sidebar-context.tsx`).
- Server state (data from APIs) → **TanStack Query**.
- **Zustand** considered only if a what-if simulator (Pianifica/Debiti/Pensione) requires client state shared across components that cannot be nested in a simple Context — introduced when needed, not pre-emptively (YAGNI).

## Cache (Redis)

Redis containerised in the cluster, with two roles scoped from day 1:
1. **Rate limiting** on the authentication endpoints (magic link request), to prevent abuse/email spam.
2. **Cache of expensive derived computations** on the server (e.g. projections in Analitiche/Pensione/Debiti), with explicit invalidation when the source data changes.

Not used for sessions (already on Postgres via better-auth) nor for other purposes until a concrete need emerges.

## Charts

**Recharts**, through the official shadcn/ui `Chart` component. It automatically inherits the theme tokens defined in `app/globals.css` (`--pos`, `--neg`, dark/light variants) with no extra custom styling, and covers all the chart types required by the screens: lines (net worth trend), areas (cash flow), donut (portfolio composition), radar (subscriptions radar in Analitiche).

**Rejected alternatives**: Tremor (too opinionated/dashboard-ready, less composable with the `base-nova` style already chosen for the design system), visx (too low-level, implementation cost not justified given the scope).

## Observability

Full stack from the start, as explicitly requested:
- **Prometheus** — metrics.
- **Loki** — log aggregation; the app writes structured JSON logs to stdout, collected by Loki.
- **Grafana** — dashboards on both sources.

Deployed in the cluster through the standard community charts/manifests (e.g. `kube-prometheus-stack`, the official Loki stack) instead of custom configurations from scratch.

## CI/CD

**GitHub Actions**, a single pipeline for now (production only, no staging):
1. Build of the app's Docker image.
2. Push to **GHCR** (GitHub Container Registry — free, already integrated with the repo, no third-party account to configure).
3. Deploy on the k3s cluster: update of the Deployment with the new image, on every merge to `main`.

The Drizzle migrations (see the Database section) run as a step of the same pipeline, before the application Deployment is updated.

## Out of scope for this phase (decided explicitly, not forgotten)

- **Staging environment**: production only for now; staging namespace/pipeline to be added when the release pace justifies it.
- **Zustand or another global state library**: introduced only if a concrete use case requires it.
- **Backend separate from the frontend**: considered only if an independent consumer emerges (e.g. a mobile app).
- **Banking integration (Open Banking) and live market prices**: already out of scope for the product in this phase (see `CLAUDE.md`), so no sync/periodic job requirement tied to external financial data sources for now.

## Testing

Not addressed in depth in this document: the test strategy (unit/integration/E2E) will be defined together with the implementation plan of the individual features, not as part of the infrastructure architecture.
