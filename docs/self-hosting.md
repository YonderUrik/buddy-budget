# Self-hosting with Docker

BuddyBudget runs with a single command on any machine with Docker (Linux, macOS, Windows with WSL2; amd64 or arm64, even a Raspberry Pi 4/5). The compose file starts the app, Postgres, Redis and a scheduler that runs the periodic jobs.

> **Image status**: every release publishes public images on ghcr.io for amd64, with the version tag and `latest`. arm64 images (Raspberry Pi, Apple silicon servers) are published only when the maintainers enable them (section «For those who publish the images» at the bottom); until then, on arm64 build from source (section «Building from source»; internet access is needed to download the fonts).

## Up and running in 5 minutes

You need Docker with the Compose v2 plugin and `openssl`.

```bash
git clone https://github.com/YonderUrik/buddy-budget.git
cd buddy-budget
./scripts/selfhost-init.sh      # creates .env with random secrets
docker compose up -d
```

Open <http://localhost:3000>. On first start the migrations run on their own (`migrate` service) and the app becomes reachable in about a minute: `docker compose ps` shows `healthy`.

### First sign-in without email

Sign-in is via an emailed link (or Google). If you have not configured Resend, the link appears in the logs: enter your email on the login page, then

```bash
docker compose logs app | grep "Link di accesso"
```

and open the printed URL (it is valid for a few minutes). The account is created on first sign-in; onboarding with language and currency follows.

## What works without external services

| Integration | Variables | If you leave it empty |
|---|---|---|
| Email (Resend) | `RESEND_API_KEY`, `RESEND_FROM` | The sign-in link goes to the logs. No price alerts, account emails, bank expiry alerts or in-app reports are sent. |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | The «Continua con Google» ("Continue with Google") button appears but responds with an error: use the email link. |
| Banks (GoCardless) | `GOCARDLESS_SECRET_ID`, `GOCARDLESS_SECRET_KEY` | No linked accounts; manual accounts, CSV import, investments, debts and pension remain. |

GoCardless stopped accepting new Bank Account Data sign-ups in July 2025 ([Actual Budget's note](https://actualbudget.org/docs/advanced/bank-sync/gocardless/)): bank sync on your own install works only if you already have GoCardless keys. Without them, import your bank's CSV export.

Everything else (transactions, categories and rules, budgets, investments with prices from the free sources, debts, analytics) works without keys. The `cron` service updates prices and net worth snapshots at the same times as production (06:30/17:30/22:30 UTC).

Not included in the compose file: the worker for the AI import of personal CSVs (`buddy-budget-csv-worker`, requires an OpenRouter key). The other CSV imports do not need it.

## HTTPS and domain

The compose file publishes the app only on `127.0.0.1` (change `APP_BIND` to expose it on the local network). To use it from outside, put it behind a reverse proxy with HTTPS and set `APP_URL=https://budget.esempio.it` in `.env` (then `docker compose up -d`): the value is used for magic links, cookies and callbacks. Example with [Caddy](https://caddyserver.com) (automatic Let's Encrypt certificate), `Caddyfile`:

```
budget.esempio.it {
    reverse_proxy 127.0.0.1:3000
}
```

Traefik, nginx or a tunnel (Cloudflare Tunnel, Tailscale) work just as well: just forward to `127.0.0.1:3000` with the `X-Forwarded-*` headers.

## Updating

```bash
docker compose pull
docker compose up -d
```

The migrations run before the app. To pin a version, set `BUDDYBUDGET_VERSION=0.44.2` in `.env` (versions are listed in the [releases](https://github.com/YonderUrik/buddy-budget/releases)); with `latest` you follow the latest release. Take a backup before a major update.

## Backup and restore

All data is in the Postgres volume `postgres-data`.

```bash
# backup (compressed file, restorable on any Postgres 17)
docker compose exec -T postgres pg_dump -U buddybudget -Fc buddybudget > buddybudget-$(date +%F).dump

# restore onto an empty instance (after `docker compose up -d postgres`)
docker compose exec -T postgres pg_restore -U buddybudget -d buddybudget --clean --if-exists < buddybudget-2026-10-10.dump
```

Schedule the backup with the system `cron` and copy the files off the machine. Keep `.env` too: losing `BETTER_AUTH_SECRET` signs everyone out but loses no data. If you set `DATA_ENCRYPTION_KEY` (descriptions and notes encrypted in the database, optional), keep it separately: without that key a backup cannot be read. Data saved before setting it is encrypted with `docker compose run --rm migrate pnpm db:encrypt-fields --execute`. From the app, Impostazioni ("Settings") → Esporta i dati ("Export data") downloads a readable ZIP with your data.

## External Postgres

Remove the `postgres` service and its dependencies, and put your database URL in `DATABASE_URL` (in the `app` and `migrate` services). With TLS use `?sslmode=require`: without `sslmode`, in production the app requires TLS.

## Building from source

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

## Common problems

- **`required variable … is missing`**: `.env` is missing; run `./scripts/selfhost-init.sh`.
- **`app` stays `unhealthy`**: `docker compose logs app`. If it lists invalid variables, check `APP_URL` (with `http://` or `https://`).
- **The sign-in link leads to the wrong address**: `APP_URL` does not match the browser URL.
- **Prices not updating**: `docker compose logs cron` and `docker compose exec cron ps`; the jobs run at the UTC times listed above.

## For those who publish the images (maintainers)

The images are on **GitHub Container Registry** (`ghcr.io/yonderurik/buddy-budget` and `buddy-budget-migrate`), not Docker Hub: free and without pull limits for public packages, same login and permissions as the repo, already used by the production deploy. The reason for the choice is in the decision `docs/decisioni/2026-10-10-self-hosting-docker.md`.

Every release publishes the images for amd64 with the version tag and `latest`, and the packages are public. To also publish arm64, it must be enabled once:

1. Repo → Settings → Secrets and variables → Actions → **Variables** → create `SELFHOST_IMAGES` = `true`. From the next release the images are multi-architecture (amd64 + arm64, arm64 build with QEMU: CI takes longer), with SBOM.
2. Packages stay public (profile/organization → Packages → each package → Package settings → *Change visibility* → **Public**); a new package starts private, so check it after adding one. Without this, other people's `docker compose pull` asks for a login.
3. Test: `docker pull ghcr.io/yonderurik/buddy-budget:latest` from a logged-out account and `docker buildx imagetools inspect` to see both architectures.

To go back to amd64 only, just delete the variable.
