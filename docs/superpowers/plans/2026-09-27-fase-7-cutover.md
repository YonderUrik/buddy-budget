# Phase 7 — Cutover (Vercel + Neon → k3s VPS)

> **Status (2026-09-27):** Tasks 1-5 complete. Session with real kubectl/Tailscale access (not the cloud sandbox): k8s CronJobs suspended, domain removed from Vercel by the user, Neon dump → CNPG restore verified (identical counts), `APP_URL`/`BETTER_AUTH_URL` updated and pods restarted (`/api/health` 200). Next: **Task 6, DNS switch** — the last step before real traffic moves to the cluster.

> **For the executor:** guided runbook, same format as Phases 1-6. Every `kubectl`/`psql`/DNS command remains a user action from the terminal (via Tailscale) or from a panel (Cloudflare, Vercel, Google Cloud Console) — Claude prepares the exact commands and manifests and verifies the outcomes, it does not run anything with its own credentials. No task is to be executed without a downtime window announced to users and agreed in advance (today: only the user themselves, but the criterion stays the same for the future).

**Goal:** move production traffic from Vercel + Neon (`buddybudget.io`) to the k3s cluster (the same Deployment already verified on `app.buddybudget.io` in Phase 6), with an announced downtime of 15–30 minutes, keeping Vercel/Neon switched off but **not deleted** for 2 weeks as a rollback, then rotating all secrets and final shutdown.

**Production domain today:** `www.buddybudget.io` (the domain actually served, verified by the user in Task 1 — the apex `buddybudget.io` **redirects** to `www`, it does not serve content of its own). Every later reference to "production domain" in this plan means `www.buddybudget.io`; the apex only needs to be kept as an equivalent redirect on the new infrastructure.

**Architecture:** no new k8s component — the Deployment/Service/CronJob/Umami already running since Phase 6 on `app.buddybudget.io` are reused. The cutover is: (1) two `Host()` matches in the same `IngressRoute` — `www.buddybudget.io` pointed to the `buddy-budget` Service, `buddybudget.io` with a redirect `Middleware` towards `https://www.buddybudget.io` (so the current behaviour is not lost); (2) `APP_URL`/`BETTER_AUTH_URL` in the app Secret updated to `https://www.buddybudget.io`; (3) a final Neon → CNPG dump/restore to bring the data to the latest consistent state (the copy made in Phase 6 is by now days old); (4) the DNS records of `www.buddybudget.io` **and** `buddybudget.io` on Cloudflare repointed from the Vercel target to the Cloudflare tunnel (the same proxied CNAME already used for `app.`/`test.`/`status.`).

**Spec:** `docs/superpowers/specs/2026-09-26-migrazione-vps-k3s-design.md`, section "Cutover e rollback (Fase 7)" (line 122) — 15–30 min downtime, 2-week rollback, secret rotation at closing.

## Global Constraints

- **No permanent interruption before verifying that the new side works**: traffic moves only after dump+restore are confirmed (row counts, a couple of check queries), never "by eye".
- **Vercel and Neon are not touched destructively in this phase**: they are switched off/disabled (project paused, domain removed from Vercel), nothing is deleted. Deletion is **Task 8**, explicitly after 2 weeks and only on the user's confirmation.
- **GoCardless requires no external configuration updates**: the redirect URL is built at runtime by `getAppUrl()` (`app/api/gocardless/connections/route.ts`), it is not registered statically in a panel — it changes by itself following `APP_URL`.
- **Google OAuth does**: better-auth is mounted on `/api/auth/[...all]`, so the redirect URI to add in Google Cloud Console is `https://www.buddybudget.io/api/auth/callback/google` (same pattern already used for `app.buddybudget.io` in Phase 6 Task 5 — check there the exact URI already registered as a reference, before adding a new one).
- **Resend (transactional emails)**: no action — sending does not depend on the domain the app is served from, only on the sender domain already verified on Resend (which does not change).
- **Freeze writes during dump+restore**: the freeze must stop _both_ concurrent write sources (Vercel Cron has been disabled since Phase 0; the k8s CronJobs **must be suspended too** for the dump window, otherwise a GoCardless sync/net worth snapshot written to CNPG during the Neon→CNPG dump would be overwritten by the restore).
- **DNS — verified in Task 1, both records**: `buddybudget.io` (apex) = `A` → `<IP-vecchio-hosting>` (old hosting IP); `www.buddybudget.io` = `CNAME` → `c97c5418d705f7ed.vercel-dns-017.com`. **Both DNS-only** (not proxied by Cloudflare), TTL 10 minutes. Since they are not proxied, these records follow real DNS propagation (not the near-instant switch of a proxied record) — but with a low TTL (600s) resolvers should update within a few minutes of the change, consistent with the 15–30 min downtime already estimated in the spec.
- **`buddybudget.io` (apex) redirects to `www.buddybudget.io`** (verified by the user in Task 1, today via Vercel) — the domain actually served is `www`. The redirect must be replicated on the new infrastructure (Task 2/6), not dropped: whoever visits `buddybudget.io` today ends up on `www.buddybudget.io` anyway.

## Review Focus

- **Data split-brain**: if for any reason (a client's DNS cache, a browser with an old tab open) a request still writes to Neon after the dump starts, that write is silently lost on restore — hence the announced downtime and the explicit disabling of the Vercel project (Task 4) instead of just switching DNS.
- **Forgotten Google OAuth redirect**: if Task 3 is not done before Task 6 (switching real traffic), Google login breaks for all real users at the exact moment of the cutover — unlike Phase 6, where the impact was on a test domain.
- **CronJobs not resumed after the restore**: if Task 5 (CronJob suspension) is not reverted in Task 7, GoCardless/net worth snapshots stay silently stopped after the cutover — no visible error, just data that stops updating.
- **`app-secrets.enc.yaml` updated but not resynced**: changing `APP_URL`/`BETTER_AUTH_URL` in the Secret without restarting the pods (`kubectl rollout restart`) leaves the live pods serving with the old values until they are naturally restarted — ArgoCD updates the Secret but does not by itself restart a Deployment whose only change is a Secret referenced via `envFrom` (pods do not recreate the env at runtime).

---

## Order of steps

1. ~~Pre-cutover survey~~ **done and complete**: apex `buddybudget.io` = `A` → `<IP-vecchio-hosting>`, DNS-only, TTL 10 min, redirects to `www.buddybudget.io` (the real domain) = `CNAME` → `c97c5418d705f7ed.vercel-dns-017.com`, also DNS-only, TTL 10 min; fresh R2 backup (`20260927T160200/`); preferred downtime window: a weekend night (exact date to be set).
2. Add `Host(www.buddybudget.io)` + `Host(buddybudget.io)` (redirect) to the existing `IngressRoute` (without moving DNS/secrets yet — harmless, nothing changes while DNS points to Vercel).
3. Register the Google OAuth redirect URI for `www.buddybudget.io`.
4. **Downtime window**: suspend the k8s CronJobs + pause Vercel (or temporarily remove the custom domain, at the user's choice) → Neon dump → restore into CNPG → verification.
5. Update `APP_URL`/`BETTER_AUTH_URL` in the app Secret to `https://www.buddybudget.io` + `kubectl rollout restart`.
6. DNS switch: repoint both `www.buddybudget.io` and `buddybudget.io` from the Vercel target to the Cloudflare tunnel (proxied).
7. Resume the CronJobs + end-to-end verification on the real domain (same checklist as Task 9 of Phase 6) + repoint the UptimeRobot uptime check.
8. Close the rollback window (note the date +14 days, monitor) — **separate task, to be done in 2 weeks**: rotation of all secrets, real shutdown of Vercel/Neon, removal of `@vercel/analytics` and of the unused Umami keys from the Secret.

---

### Task 1: Pre-cutover survey

**Files:** none (verification only).

**Interfaces:**
- Consumes: none.
- Produces: confirmation of the DNS record type and of the downtime window — precondition for estimating Task 6 correctly.

- [x] **Step 1: DNS record type of the apex** — done (2026-09-27): `buddybudget.io` → `A` → `<IP-vecchio-hosting>`, **DNS-only** (not proxied), TTL 10 minutes (600s).

- [x] **Step 2: www redirect** — done (2026-09-27): `buddybudget.io` (apex) redirects to `www.buddybudget.io` on Vercel — **`www` is the domain actually served**, the apex is only a redirect. This changes the scope of the cutover: the domain to really migrate is `www.buddybudget.io` (see updated Tasks 2/3/5/6); the apex only needs to keep redirecting on the new infrastructure.

- [x] **Step 2b: DNS record type of `www`** — done (2026-09-27): `www.buddybudget.io` → `CNAME` → `c97c5418d705f7ed.vercel-dns-017.com`, **DNS-only**, TTL 10 minutes — same profile as the apex (no Cloudflare proxy on either record today). Task 6 therefore becomes, for both: change the **target** of an already existing record (not create a new one) and enable the proxy (orange cloud).

- [x] **Step 3: R2 backup status** — done (2026-09-27): latest object `20260927T160200/`, fresh (same day). No action needed, it remains the safety net if the Task 4 restore goes wrong.

- [x] **Step 4: Downtime window** — stated preference: **a weekend night**. Exact date/time still to be put on the calendar before Task 4 (just agree on it here in the chat when ready to execute).

---

### Task 2: `Host(www.buddybudget.io)` + apex redirect in the IngressRoute

**Files:**
- Modify: `argocd/manifests/app/ingressroute.yaml` (`buddy-budget-infra` repo)

**Interfaces:**
- Consumes: existing `IngressRoute` (Phase 6), `buddy-budget` Service.
- Produces: Traefik ready to answer on `www.buddybudget.io` (the real app) and to redirect `buddybudget.io` (apex) to `www` as soon as DNS points there — no effect until Task 6 moves DNS (the old Vercel target stays authoritative until then).

- [x] **Step 1: Add the routes** — done (2026-09-27), PR #4 in the infra repo.

```yaml
# argocd/manifests/app/ingressroute.yaml — add next to the existing route for app.buddybudget.io
    - match: Host(`www.buddybudget.io`) && (Path(`/stats/script.js`) || Path(`/stats/api/send`))
      kind: Rule
      middlewares:
        - name: umami-strip-stats
      services:
        - name: umami
          port: 3000
    - match: Host(`www.buddybudget.io`)
      kind: Rule
      services:
        - name: buddy-budget
          port: 3000
    # Apex: replicates the apex->www redirect that Vercel does today, instead of serving the app twice.
    - match: Host(`buddybudget.io`)
      kind: Rule
      middlewares:
        - name: apex-redirect-www
      services:
        - name: buddy-budget
          port: 3000
---
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: apex-redirect-www
  namespace: app
spec:
  redirectRegex:
    regex: "^https://buddybudget.io/(.*)"
    replacement: "https://www.buddybudget.io/${1}"
    permanent: true
```

Decide here, with the user, whether to **also keep `app.buddybudget.io`** as a permanent alias (useful as a staging/preview environment always updated by CI) or remove it after the cutover — it blocks nothing, all routes can coexist indefinitely on the same Deployment.

- [x] **Step 2: Merge PR #4 and verify the ArgoCD sync** — done (2026-09-27), PR merged (`44a9e00`). No visible impact until DNS changes (Task 6).

---

### Task 3: Google OAuth redirect URI

**Files:** none (external panel, Google Cloud Console).

**Interfaces:**
- Consumes: none.
- Produces: Google login working on the production domain from the moment of the cutover — blocking precondition for Task 6.

- [x] **Step 1** — done (2026-09-27): redirect URI `https://www.buddybudget.io/api/auth/callback/google` registered by the user.

- [x] **Step 2** — `app.buddybudget.io` URI left active (alias kept, decided in Task 2).

---

### Task 4: Downtime window — write suspension, dump, restore

**Files:** none (terminal commands, executed by the user via Tailscale).

**Interfaces:**
- Consumes: connection to Neon (production) and to CNPG (k3s cluster).
- Produces: CNPG with the latest consistent state of the production data — blocking precondition for Task 6.

- [ ] **Step 1: Suspend the k8s CronJobs**

```bash
kubectl patch cronjob gocardless-sync -n app -p '{"spec":{"suspend":true}}'
kubectl patch cronjob net-worth-snapshot -n app -p '{"spec":{"suspend":true}}'
```

- [ ] **Step 2: Pause Vercel**

Vercel → Project → Settings → choose one of the two (the user's choice, both stop real writes):
- **Pause the project** (Vercel supports pausing at team/project level on the plans that offer it) — the domain answers with a Vercel pause page.
- **Temporarily remove the custom domains** from the project (Settings → Domains → remove both `www.buddybudget.io` and `buddybudget.io`) — the domains stop resolving to Vercel until they are repointed in Task 6 anyway, so in practice Task 6 does exactly this step "forward" (repointing to Traefik instead of putting Vercel back).

Recommended choice: remove the domain from Vercel right here, so Task 6 becomes just "add the record on Cloudflare towards the tunnel" instead of two separate operations.

- [x] **Step 3: Dump from Neon** — done (2026-09-27): ephemeral pod `pg-cutover` (image `postgres:17`, same version as CNPG) in the `app` namespace, dump via `DATABASE_URL_UNPOOLED`. Session with real kubectl/Tailscale access, not the cloud sandbox.

- [x] **Step 4: Restore into CNPG** — done: `pg_restore --clean --if-exists --no-owner` towards `buddybudget-pg-rw.data.svc.cluster.local`. Only 2 ignored errors (grants on Neon-specific roles `neon_superuser`/`cloud_admin`, irrelevant outside Neon).

- [x] **Step 5: Row count check** — done: `accounts` 1, `transactions` 1247, `categories` 35, `auth_user` 1, `bank_connections` 1, `net_worth_snapshots` 730, `categorization_rules` 172 — identical on Neon and CNPG after the restore. Pod `pg-cutover` deleted at the end of the task.

---

### Task 5: Update `APP_URL`/`BETTER_AUTH_URL` and restart

**Files:**
- Modify: `argocd/manifests/app/app-secrets.enc.yaml` (`buddy-budget-infra` repo)

**Interfaces:**
- Consumes: existing `app-env` Secret.
- Produces: pods ready to serve requests on `https://www.buddybudget.io` — precondition for Task 6 (the order matters: if DNS moves before the pods have the new `APP_URL`, GoCardless/email redirects still point to the wrong domain for the window between the two tasks).

- [x] **Step 1: Decrypt, edit, re-encrypt** — done (2026-09-27): private age key extracted from the cluster secret `sops-age` (namespace `argocd`, the same entity already used by KSOPS in-cluster) and saved locally (`~/.config/sops/age/keys.txt`) to be able to use `sops` from this session with real kubectl/Tailscale access. `sops set` on `APP_URL`/`BETTER_AUTH_URL`, PR #7 in the infra repo.

- [x] **Step 2: Merge PR #7, verify the sync** — done: PR merged by the user; ArgoCD had not yet polled the new commit (`status.sync.revision` stuck 2 commits behind) — unblocked with `kubectl annotate application app -n argocd argocd.argoproj.io/refresh=hard --overwrite`, then synced correctly.

- [x] **Step 3: Explicit restart** — done: `kubectl rollout restart deployment/buddy-budget -n app`, rollout completed (`successfully rolled out`).

- [x] **Step 4: Internal verification** — done: port-forward on the Deployment, `GET /api/health` → `200 {"status":"ok",...}` from the new pod.

---

### Task 6: DNS switch

**Files:** none (Cloudflare panel).

**Interfaces:**
- Consumes: result of Task 1 (record type), Task 4 (Vercel already disabled), Task 5 (pods ready).
- Produces: `www.buddybudget.io` (and `buddybudget.io` as a redirect) served by the k3s cluster.

- [x] **Step 1: `www.buddybudget.io` (primary domain)** — done (2026-09-27): target changed to `36bf9415-c966-4403-a6e2-a53530ded387.cfargotunnel.com`, proxy enabled.

- [x] **Step 2: `buddybudget.io` (apex, redirect)** — done: same target, type changed from `A` to `CNAME`, proxy enabled.

- [x] **Step 3: Verification from an external network** — done, with a real bug found and fixed along the way: the first test on `buddybudget.io` returned `200` (the app served directly, not a redirect) — the `apex-redirect-www` Middleware anchored the regex to `^https://`, but Traefik receives the traffic in plain text (TLS terminated by Cloudflare in front of the tunnel), so the scheme seen internally is always `http://` and the regex never matched. Fix: `^https?://` (PR #9 in the infra repo, merged). Verified after the fix: `www.buddybudget.io/api/health` → `200`; `buddybudget.io/` → `301` to `https://www.buddybudget.io/`, then `200` at the end of the chain.

---

### Task 7: Resume CronJobs + end-to-end verification + uptime check

**Files:** none.

**Interfaces:**
- Consumes: everything from Tasks 1-6.
- Produces: cutover complete, green light for the 2-week rollback window.

- [x] **Step 1: Resume the CronJobs** — done (2026-09-27), `gocardless-sync`/`net-worth-snapshot` no longer suspended.

- [x] **Step 2: End-to-end checklist on `https://www.buddybudget.io`** — confirmed by the user.

- [x] **Step 3: Repoint the external uptime check** — done by the user on UptimeRobot.

- [x] **Step 4: Announce the end of the downtime** — cutover complete, `www.buddybudget.io`/`buddybudget.io` served by the k3s cluster.

**Task 7 complete. Cutover complete (Tasks 1-7/8).** Only **Task 8** remains, to be done no earlier than two weeks from now (secret rotation + final Vercel/Neon shutdown + code cleanup), on the user's explicit confirmation.

---

### Task 8: Close the rollback window (to be done 2 weeks after Task 7, in a dedicated session)

**Files:**
- Modify: `argocd/manifests/app/app-secrets.enc.yaml` (secret rotation)
- Modify: `app/layout.tsx` (removal of `@vercel/analytics`)
- Modify: `package.json` (removal of the `@vercel/analytics` dependency)

**Interfaces:**
- Consumes: 2 weeks elapsed with no need for rollback (no problem that required repointing DNS to Vercel).
- Produces: Vercel/Neon really switched off, all secrets rotated, code cleaned of Vercel leftovers.

- [ ] **Step 1: Explicit confirmation from the user**

Do not proceed autonomously just because 14 calendar days have passed — ask for confirmation that there were no problems/rollbacks in the meantime.

- [ ] **Step 2: Rotation of all secrets**

`DATABASE_URL` (new CNPG role password), `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_SECRET` (regenerated in Google Console), `GOCARDLESS_SECRET_KEY` (regenerated in GoCardless), `RESEND_API_KEY` (regenerated in Resend), `CRON_SECRET` — reason: they went through Vercel (project env vars), so they must be considered potentially exposed to anyone who had access to that project.

- [ ] **Step 3: Real shutdown**

Delete the Vercel project and the Neon project (or just deactivate them depending on what the pricing plan allows — physical deletion is at the user's discretion; this phase's "done" criterion is that they no longer receive traffic nor hold the last useful copy of the data).

- [ ] **Step 4: Code cleanup**

Remove `@vercel/analytics` from `app/layout.tsx`/`package.json` (Umami replaces it since Phase 6); remove `NEXT_PUBLIC_UMAMI_SRC`/`NEXT_PUBLIC_UMAMI_WEBSITE_ID` from `app-secrets.enc.yaml` (no longer read, values now literal in the layout — debt already noted in Phase 6); remove `vercel.json` if it no longer serves any purpose (first check that it does not contain anything else).

- [ ] **Step 5: Final log**

Update `CLAUDE.md`: "In corso ora" ("In progress now") closes the VPS migration, moves the project status to "production served by k3s", records the log entry with the date of the final shutdown.
