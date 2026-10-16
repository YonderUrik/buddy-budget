# VPS migration Phase 6 — app in parallel — design

Date: 2026-09-27
Status: design approved in conversation, awaiting review of the written spec.
Reference: `docs/superpowers/specs/2026-09-26-migrazione-vps-k3s-design.md` (Phases section, row 6).

## Goal

Before the real cutover (Phase 7, DNS switch + announced downtime), run BuddyBudget inside the newly built k3s cluster (Phases 1-5), with real data, verifying every screen end to end — something no previous phase could do (so far only the whoami demo and generic components). Vercel + Neon remain the real production throughout this phase: the verification app runs in parallel, it replaces nothing until the user approves moving to Phase 7.

"Done" criterion (from the main spec): full manual verification of all screens with the real DB; the Vercel crons disabled before enabling the k8s CronJobs.

## Decisions made in brainstorming

- **Data**: full dump from Neon (not an anonymized subset) — the environment stays behind the same application auth and the only real user today is the person driving this very migration.
- **Domain**: `app.buddybudget.io` used directly (not a temporary subdomain) — it is already the final name decided for the app (the bare domain `buddybudget.io` is reserved for a future landing page, out of scope here), and nothing else occupies it today.
- **Replicas**: 2 (same as the production target), not 1 — multi-pod behavior is verified from the start too (shared locks on sync/snapshot, rolling update).
- **Image tag update**: a step in the app repo's CI (not ArgoCD Image Updater) — no new component in the cluster, consistent with the "GitOps is the boundary" principle already written in the main spec.
- **Cron**: the Vercel crons (`gocardless-sync`, `net-worth-snapshot`) must be explicitly disabled before enabling the equivalent k8s CronJobs, so as not to exceed the GoCardless rate limit (~4 calls/day/account) with two stacks syncing the same account in parallel.

## Components

### 1. Namespace and app manifests (`buddy-budget-infra` repo)

New namespace `app`:
- `Deployment` — 2 replicas, image `ghcr.io/<org>/buddy-budget:<tag>` (`runner` target of the Phase 0 multi-stage Dockerfile), `env` from a `ConfigMap` (non-sensitive values: `APP_URL=https://app.buddybudget.io`, etc.) + a SOPS-encrypted `Secret` (DB URL, `BETTER_AUTH_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`, GoCardless credentials, `REDIS_URL`) — same `kustomization.yaml`+`generator.yaml` scheme already used for the other secrets (`grafana-secrets`, R2, Cloudflare tunnel).
- `readinessProbe`/`livenessProbe` on `/api/health` and `/api/health/ready` (already existing since Phase 0).
- ClusterIP `Service`.
- Traefik `IngressRoute` for `app.buddybudget.io`, same pattern as `test.buddybudget.io` (Phase 3) — requires adding the hostname to the cloudflared tunnel configuration (already catch-all since Phase 5, so no change there) and a Cloudflare DNS record (user action).
- `NetworkPolicy`: ingress only from `ingress` (Traefik) on the app port; egress to `data` (Postgres/Redis) and to the Internet for GoCardless/Resend/Google OAuth (DNS+HTTPS), no other traffic.
- `ResourceQuota`/`LimitRange` on the namespace, thresholds with margin above the observed usage (~300-600 MB for the 2 replicas, per the RAM budget already written in the main spec).

### 2. Data migration Neon → CNPG

- `pg_dump --format=custom` from Neon (command prepared by Claude, run by the user from a terminal with the Neon connection string — never in chat, the usual constraint for credentials).
- Transfer of the dump file to the VPS (`scp` via Tailscale) and `pg_restore` inside a temporary pod with `psql`/Postgres client pointing at the CNPG `Service` in the `data` namespace.
- Verification: row count per table (`SELECT count(*) FROM ...` on each non-empty table) compared Neon vs CNPG, not just "the restore gave no errors".
- The restore is re-run (drop+recreate) whenever fresher data is needed during the manual verification phase, until moving to Phase 7 (which will do the last, real restore, at cutover).

### 3. k8s CronJobs

Two `CronJob`s in the `app` namespace:
- `gocardless-sync` — scheduled every 12h (same time as Vercel Cron), minimal `curl` (or `alpine/curl`) container that calls `GET http://buddy-budget.app.svc.cluster.local/api/cron/gocardless-sync` with the header `Authorization: Bearer $CRON_SECRET` (from env/secret), `restartPolicy: OnFailure`.
- `net-worth-snapshot` — scheduled at 23:50, same pattern.
- No change to the existing `/api/cron/*` routes (already idempotent since Phase 0).
- Explicit precondition, to be done **before** applying these manifests: disable/remove the `crons` entries in `vercel.json` (or the env that disables them) and check on Vercel that they no longer run.

### 4. Umami

- A second `Deployment` (official image `ghcr.io/umami-software/umami:postgresql-latest` or a pinned version, to be checked when writing the plan) in the `app` namespace, with a dedicated database (`umami`, separate user, **not** shared with the app's) on the same CNPG cluster — consistent with what is already written in the main spec ("separate DB on the same CNPG cluster").
- ClusterIP `Service` + `IngressRoute` for a dedicated subdomain (e.g. `analytics.buddybudget.io`, to be confirmed in the plan) only for admin access to the Umami dashboard — it must not be publicly reachable the same way as the app; evaluate in the plan whether to route it behind Tailscale like ArgoCD/Grafana instead of via public cloudflared.
- Umami tracking script added to the Next.js layout (`app/layout.tsx`), URL/site-id from a public environment variable (`NEXT_PUBLIC_UMAMI_*`), no data collection until the script is configured (the library's default behavior — no-op if the envs are missing).

### 5. CI step: automatic image tag update

In the app repo's GitHub Actions workflow (the one already existing since Phase 0 that builds and pushes to GHCR), a new job after the image push:
1. Checkout of `buddy-budget-infra` with a **new write deploy key** (the existing one for ArgoCD is read-only, a second key dedicated to this purpose must be added, with permissions limited to this repo — user action via `gh repo deploy-key add`).
2. Update of the image tag in the `Deployment` manifest of the `app` namespace (`yq`/`kustomize edit set image` or a targeted `sed`, to be chosen in the plan based on what the infra repo already uses).
3. Commit + push to `main` of the infra repo, message with the image sha.
4. ArgoCD (already polling/webhook since Phase 3) syncs by itself, no manual action.

## Expected operational sequence (details in the runbook plan)

1. Disable the Vercel crons.
2. Create the `app` namespace manifests (Deployment/Service/IngressRoute/NetworkPolicy/ResourceQuota) — without the CronJobs yet.
3. Dump/restore Neon → CNPG data, row count check.
4. Deploy the app via ArgoCD, check readiness/liveness, DNS `app.buddybudget.io` working from outside.
5. Apply the k8s CronJobs, check a first manual run (`kubectl create job --from=cronjob/...`) before waiting for the schedule.
6. Deploy Umami, check tracking on a real page.
7. Add the CI tag-update step, verify with a test commit that the build→tag→sync cycle works end to end.
8. Manual verification by the user of all screens (Conti, Transazioni, Cash flow, Categorie, Panoramica — Accounts, Transactions, Cash flow, Categories, Overview) against the app in k8s.

## Risks and constraints

- **Double GoCardless sync**: mitigated by step 1 of the sequence (Vercel crons disabled first), never invert the order.
- **Repeated restores during verification**: each restore overwrites the state of the test DB — if the user changes data in the test app and then redoes a restore from Neon, those changes are lost. Accepted behavior (the test app is not the source of truth until Phase 7 does the definitive restore).
- **Write deploy key**: a new secret with write permissions on a repo that ArgoCD reads — it must stay scoped to the infra repo only (not an account-wide token), the same least-privilege principle already applied to the other secrets.
- **Exposed Umami**: if routed via public cloudflared instead of Tailscale, the admin dashboard (not only the tracking script, which is public by nature) would be reachable from the Internet with only its own login, unlike ArgoCD/Grafana — to be decided explicitly in the plan, not left to an implicit default.

## Out of scope (deferred)

- Real cutover (Phase 7): remains a separate phase with its own runbook.
- Removal of the whoami demo on `test.buddybudget.io`: not needed for this phase (different names, no conflict), to be evaluated once the cutover is complete.
- High availability/multi-node: unchanged from the main spec.
