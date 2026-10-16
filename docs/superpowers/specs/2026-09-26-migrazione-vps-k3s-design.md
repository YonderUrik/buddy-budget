# Migration from Vercel + Neon to a VPS with k3s — design

Date: 2026-09-26
Status: design approved in conversation, awaiting review of the written spec.
Replaces/updates: the "Deployment", "CI/CD" and "Observability" sections of `2026-07-03-tech-stack-architecture-design.md` (the underlying choices remain, here they become concrete).

## Goal

Move BuddyBudget's whole infrastructure from Vercel + Neon to a self-managed VPS, for three explicit reasons given by the user:

1. **Costs**: Vercel is not sustainable in the long run.
2. **Performance**: persistent Node process, no cold starts, DB and Redis on the same machine as the app.
3. **Learning**: the user wants to learn to run a whole "real production" infrastructure (k3s, GitOps, observability), so industry-standard tools are preferred over shortcuts (Coolify/Dokploy discarded for this reason).

Process constraint: **the user is guided step by step**. Each phase becomes a plan in guided-runbook format: Claude prepares files and commands and explains the why of each step; the user performs the actions on accounts/dashboards/terminal and pastes the output; Claude verifies before moving on. Purchases, key creation and DNS changes are always done by the user.

## Risk profile

Today the app is used by the user (profile "A"), but the architecture must be ready for real external users with real banking data ("B") without having to redo it. Consequences:

- continuous backups outside the VPS provider with point-in-time recovery, and a **tested** restore;
- no public ports on the VPS, administrative access only via VPN;
- fully declarative and rebuildable infrastructure;
- single node accepted today as a conscious single point of failure (see "Deferred").

## Resources

Hostinger VPS: 2 vCPU, 8 GB RAM, 100 GB NVMe, ~€8/month. To check at purchase: renewal price (the €8 one is typically promotional with upfront payment), datacenter in the EU (GDPR), Ubuntu LTS image.

Estimated steady-state RAM budget ~4 GB (margin ~50%):

| Component | Indicative RAM |
|---|---|
| k3s (control plane) + Traefik | ~600 MB |
| Next.js, 2 replicas | 300–600 MB |
| CloudNativePG (operator + 1 instance) | 600 MB–1 GB |
| Redis | ~100 MB |
| ArgoCD | 500 MB–1 GB |
| VictoriaMetrics + Loki + Alloy + Grafana | ~700 MB–1 GB |
| cloudflared, Umami | ~250 MB |

Rules: every pod has explicit `requests`/`limits`; **no builds on the VPS** (images are built in GitHub Actions); the 2 cores are the expected bottleneck, to be monitored.

## Architecture

```
Internet ──▶ Cloudflare (DNS, WAF, TLS, DDoS)
                 │  outbound tunnel, no public ports
┌────────────────▼──────────── Hostinger VPS (k3s single-node) ─────────┐
│ ns ingress:   cloudflared ──▶ Traefik                                  │
│ ns app:       buddy-budget (Deployment, 2 replicas, Next standalone)    │
│               CronJob: gocardless-sync (every 12h), net-worth-snapshot (23:50)│
│               ArgoCD PreSync Job: drizzle-migrate                        │
│ ns data:      CloudNativePG (Postgres, 1 instance) ── WAL + base ──▶ R2 │
│               Redis (AOF, PVC)                                          │
│ ns argocd:    ArgoCD ◀── pull ── GitHub repo buddy-budget-infra         │
│ ns observ.:   VictoriaMetrics · Loki · Alloy · Grafana ──▶ Telegram alerts│
│ ns analytics: Umami (separate DB on the same CNPG cluster)              │
└────────────────▲───────────────────────────────────────────────────────┘
                 │ Tailscale (SSH, kubectl, Grafana, ArgoCD — admin only)
             administrator

GitHub Actions (app repo): lint · tsc · vitest (service Postgres) · image build
   → GHCR → image tag update in the infra repo → ArgoCD sync
External services: Resend (email), GoCardless, external uptime check (UptimeRobot/Healthchecks.io)
```

### Decisions per component

| Area | Choice | Discarded alternatives and why |
|---|---|---|
| Provider | Hostinger VPS | — (user's choice; the design is provider-independent) |
| Host provisioning | **Ansible** (playbook in the infra repo, run from WSL) | Manual configuration: not rebuildable, risk of forgetting security steps |
| Orchestration | **k3s** single-node | Docker Compose/Coolify: simpler but against the learning goal and future multi-node growth |
| Ingress | **Cloudflare Tunnel** (`cloudflared` in the cluster) → Traefik | Ports 80/443 open with or without the Cloudflare proxy: larger exposed surface |
| Admin access | **Tailscale** (SSH, k8s API, Grafana, ArgoCD) | Public exposure with authentication: unacceptable with banking data |
| GitOps | **ArgoCD**, separate repo `buddy-budget-infra` | Flux (lighter, no UI); push deploy from Actions (no reconciliation/drift detection) |
| Secrets | **SOPS + age** in the infra repo, decrypted by ArgoCD via KSOPS | Sealed Secrets: key tied to the cluster, disaster recovery more awkward |
| Postgres | **CloudNativePG**, continuous backups (WAL archiving + base backup) on **Cloudflare R2**, PITR | StatefulSet + nightly `pg_dump` (up to 24h of loss, no PITR); stay on Neon (against the goal, latency) |
| Redis | Single instance, AOF on PVC, **no backup** | — it holds only ephemeral data by design (rate limit, cache, job state) |
| DB migrations | Versioned Drizzle migrations, run by a k8s Job as an ArgoCD `PreSync` hook | `db:push` in production: not versioned, already the cause of repeated incidents |
| Scheduled jobs | **k8s CronJobs** calling internal `/api/cron/*` endpoints protected by a secret | `node-cron` in `instrumentation.ts`: double execution with several replicas, not observable, doesn't work on serverless |
| Observability | **VictoriaMetrics + Loki (single-binary) + Grafana Alloy + Grafana** | kube-prometheus-stack: ~3× the RAM for the same result on 8 GB |
| Alerting | Grafana alerting → **Slack** (native webhook) + external uptime check | Telegram: discarded on 2026-09-27, the user wants to stay on Slack (already used, and a possible base for notifications from other tools in the future). Internal monitoring only: if the VPS goes down, the alarm goes down too |
| Web analytics | Self-hosted **Umami** (alternatively Cloudflare Web Analytics) instead of `@vercel/analytics` | — |
| Email | Resend, unchanged | — |
| Environments | Only `production`; PRs are verified in CI | Staging: deferred (RAM and complexity) |

### Cross-cutting principles

- **Everything declarative and rebuildable.** Ansible (host) + infra repo (cluster) + R2 (data) + age key (secrets) are enough to bring the service back to life on a new VPS with no undocumented manual steps. The age key is the only "root" secret: kept offline (password manager + paper copy), never in the repo.
- **Least privilege.** Default-deny NetworkPolicy per namespace with explicit exceptions (app → Postgres/Redis, cloudflared → Traefik → app, Alloy → everything for collection); non-root containers with read-only filesystem where possible; non-superuser application DB user; GHCR and R2 tokens with minimal permissions.
- **Portability.** The application code doesn't know about Kubernetes: cron endpoints are normal HTTP routes, config comes from environment variables. The app remains deployable on Vercel or elsewhere.
- **GitOps is the boundary.** No manual changes to the cluster with `kubectl apply` outside the infra repo, except temporary, noted debugging.

## Application changes (Phase 0)

These are made **before** the migration, while the app still runs on Vercel, and they have value even if the migration slips.

1. **Real Drizzle migrations**: baseline generated from the current schema, `drizzle-kit migrate` instead of `db:push`. Closes the known debt (tables/columns applied with direct `CREATE TABLE`/`ALTER TABLE`, constraint `transactions_account_external_id_unique` blocking `db:push`).
2. **Container image**: `output: "standalone"` in `next.config.ts`, multi-stage `Dockerfile` with a non-root user, no secrets in the image.
3. **Health check**: `/api/health` for liveness (process alive) and readiness (ping to Postgres and Redis), excluded from the auth matcher in `proxy.ts`.
4. **Cron as endpoints**: `node-cron` and the two `start*Scheduler`s removed from `instrumentation.ts`; new routes `/api/cron/gocardless-sync` and `/api/cron/net-worth-snapshot` protected by a shared secret (`CRON_SECRET`, `Authorization: Bearer` header), idempotent. In the meantime **Vercel Cron** calls them, so automatic sync and the net worth snapshot start working in production right away (today they don't run). Long work follows the "Operazioni lunghe" ("Long operations") standard (`after()` + state on Redis).
5. **Env validation at startup**: a single Zod schema for the environment variables, explicit error if one is missing.
6. **GitHub Actions CI**: lint, `tsc --noEmit`, vitest with Postgres and Redis as service containers, image build and push to GHCR on merge to `main`. The automatic tag update in the infra repo is added in Phase 6.

## Phases

Each phase has its own plan (guided runbook) and its own "done" criterion.

| # | Phase | Content | Done when |
|---|---|---|---|
| 0 | App ready | Changes listed above, on Vercel | Green CI, GHCR image runnable locally with Docker, Vercel crons working in production |
| 1 | Accounts and foundations | Domain with DNS on Cloudflare, Tailscale account, R2 bucket + keys, age key, VPS purchase, `buddy-budget-infra` repo | All accounts exist, credentials in the password manager |
| 2 | Host | Ansible playbook: non-root user, SSH key-only and only via Tailscale, deny-all inbound firewall, `unattended-upgrades`, k3s | An external scan finds no open ports; `kubectl` works via Tailscale |
| 3 | Platform | ArgoCD + KSOPS, cloudflared + Traefik, default-deny NetworkPolicy, ResourceQuota/LimitRange | A test app responds on a subdomain via the tunnel, managed by ArgoCD |
| 4 | Data | CNPG + backups on R2, Redis | **Restore tested** on a throwaway Postgres cluster from an R2 backup, with PITR to a chosen point in time |
| 5 | Observability | VictoriaMetrics, Loki, Alloy, Grafana, Slack alerts, external uptime check | A test alert (e.g. crashing pod) arrives on Slack; the external check reports the simulated shutdown |
| 6 | App in parallel | Deploy on a test subdomain with a copy of the Neon data, CronJobs, Umami, automatic tag update | Full manual check of all screens with the real DB; the Vercel crons are **disabled** before enabling the CronJobs (GoCardless rate limit ~4 calls/day per account) |
| 7 | Cutover | Announced 15–30 min freeze → `pg_dump` from Neon → restore into CNPG → DNS switch → verification | Production app served from the VPS; after 2 weeks without rollback: shutdown of Vercel/Neon and secret rotation |

### Cutover and rollback (Phase 7)

- Announced downtime of 15–30 minutes; zero-downtime logical replication discarded as disproportionate to the current load.
- Rollback: Vercel and Neon remain intact and can be reactivated (DNS back) for 2 weeks. During this window a rollback loses the data written on the VPS after the cutover: accepted, short window and small user base.
- Closing: rotation of **all** secrets used on Vercel (DB, better-auth, GoCardless, Google OAuth, Resend), deletion of the local file `vercelnenon.txt` (Neon credentials in plaintext, gitignored and never committed), removal of `@vercel/analytics`.

## Knowingly deferred

- **Always-on Claude Code for continuous development**: deferred. Constraint already decided: **never on the production VPS** (supply-chain/prompt-injection risk with access to banking data, and CPU contention). Options when it's picked up again: Claude Code on the web (cloud sessions) or a second "dev box" VPS without production credentials, working only via PRs.
- **Paperclip (orchestrating several agents as a "company")**: deferred until after the cutover (Phase 7), same constraints as the previous point — it runs on the future dev box, never on the production VPS; agents work only via PRs with mandatory CI and human merge; model spending limited by Paperclip budgets. Prerequisite: CI + GitOps from Phases 0-6 working.
- **Staging**: deferred for RAM and complexity; PRs are verified in CI.
- **Multi-node / high availability**: deferred. The groundwork is already in the design (Ansible to add nodes, CNPG scaling to replicas in the same manifest).
- **Zero-downtime cutover** (logical replication): discarded for now.
- **ChatOps/additional Slack integrations** (decided 2026-09-27, after choosing Slack as the Phase 5 alert channel): evaluate in a dedicated session, after Phase 5, integrating other tools (CI, ArgoCD sync, deploy) as Slack notifications where sensible — visibility only, no commands/operational management from chat (explicitly discarded as out of scope because of the additional attack surface with banking data at stake).

## Known risks

- **Single node**: VPS failure = service down until rebuilt. Mitigation: declarative rebuild + R2 backups + tested restore; expected RTO in the order of an hour.
- **CPU (2 cores)**: peaks of concurrent GoCardless syncs together with observability. Mitigation: limits, CPU metrics with alerts, possible vertical upgrade of the VPS.
- **Dependency on Cloudflare** as the single edge: accepted.
- **Custody of the age key**: if lost, the encrypted secrets in the repo can no longer be read (they can be regenerated by rotating them, but it's work). Two offline copies mandatory.
