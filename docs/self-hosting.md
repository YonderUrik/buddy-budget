# Self-hosting with Docker

BuddyBudget runs with one command on any machine with Docker (Linux, macOS, Windows with WSL2). The compose file starts the app, Postgres, Redis and a scheduler for the periodic jobs. You need no email server and no external account to start: sign-in is with email and password.

> **Images**: every release publishes public images on ghcr.io for amd64, with the version tag and `latest`. arm64 images (Raspberry Pi, Apple silicon servers) are published only when the maintainers enable them (see the end of this page); until then, on arm64, build from source.

## Up and running

You need Docker with the Compose v2 plugin and `openssl`.

```bash
git clone https://github.com/YonderUrik/buddy-budget.git
cd buddy-budget
./scripts/selfhost-init.sh      # creates .env with random secrets
docker compose up -d
```

Open <http://localhost:3000>. The migrations run on their own (`migrate` service) and the app is ready in about a minute (`docker compose ps` shows `healthy`).

The first page is «Crea il primo account» ("Create the first account"): name, email, password (at least 10 characters). That account is yours. After it, nobody else can sign up unless you allow it (below). Onboarding then asks for country, language and currency.

Behind a domain, pass its address to the init script: `./scripts/selfhost-init.sh https://budget.example.com` (see «HTTPS and domain»).

## Accounts

One install can hold several people. Each account has its own data (accounts, transactions, investments, settings) and nobody sees anyone else's. An account shared by several people (a household) does not exist yet.

| You want to | Do this |
|---|---|
| Add one person without opening signups (recommended) | `docker compose run --rm migrate pnpm auth:create-user name@example.com Name`. It prints a password: give it to them, they sign in and change it in Impostazioni → Account → Password |
| Let people sign up by themselves | `ALLOW_SIGNUPS=true` in `.env`, then `docker compose up -d`. The sign-in page then offers «Crea un account» to anyone who can reach the app: when everyone is in, empty the line and run `docker compose up -d` again |
| Reset a forgotten password (no email service) | `docker compose run --rm migrate pnpm auth:reset-password name@example.com` (prints a new password and signs the account out everywhere) |
| Change your password | Impostazioni → Account → Password (at least 10 characters) |
| Delete an account | The person does it from Impostazioni → Zona pericolosa |

With an email service configured, «Password dimenticata?» on the sign-in page emails a reset link instead, and the emailed sign-in link is offered next to the password. `AUTH_PASSWORD=false` turns password sign-in off (emailed link only, needs email).

## What works without external services

Everything that is about your data: accounts and transactions, categories and rules, budgets, CSV import from IBKR, DEGIRO, Trade Republic and Fineco, investments with prices from free sources, debts, pension, goals and analytics. The `cron` service updates prices and net worth snapshots at 06:30, 17:30 and 22:30 UTC.

| Integration | Variables in `.env` | Without it |
|---|---|---|
| Email (any SMTP server, or Resend) | `SMTP_URL` + `EMAIL_FROM`, or `RESEND_API_KEY` + `EMAIL_FROM` | No emails: no reset or sign-in links, no price alerts, summaries or reminders. Everything else works |
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | The Google button is not shown |
| AI (OpenRouter) | `OPENROUTER_API_KEY`, and `COMPOSE_PROFILES=ai` for the CSV import worker | No category suggestions, no import of other banks' CSVs (the broker exports above still import) |
| Banks (GoCardless) | `GOCARDLESS_SECRET_ID`, `GOCARDLESS_SECRET_KEY` (new connections open by default; `BANK_CONNECTIONS_OPEN=false` allows only renewals) | No linked bank accounts: manual accounts and CSV import |
| In-app reports | `SUPPORT_EMAIL_TO` (needs email) | «Scrivici» answers that reports are off on this install |

Every OpenRouter request asks for zero data retention endpoints only (`provider.zdr`), so a model with no such endpoint fails instead of falling back to one that keeps data. You can also turn ZDR on for all models in your OpenRouter account (Settings → Privacy); the two combine, either one is enough.

GoCardless stopped accepting new Bank Account Data sign-ups in July 2025: bank sync works only if you already have keys.

**SMTP examples** (special characters in the password must be URL-encoded, `@` → `%40`):

```
SMTP_URL=smtps://you%40gmail.com:app-password@smtp.gmail.com:465
SMTP_URL=smtp://user:password@smtp.example.com:587
EMAIL_FROM=BuddyBudget <budget@example.com>
```

After changing `.env`, run `docker compose up -d`: the boot line `app.instance.configured` in `docker compose logs app` shows what is on, e.g. `self-hosted password=on link=email google=off email=smtp signups=first-account`.

Not part of a self-hosted install: the Free and Pro plans of the hosted service (every section is open, `BILLING_MODE` and the Stripe keys are ignored), the read-only public demo, deleting accounts unused for 90 days, product analytics, and the Terms of the hosted service (whoever runs the install is responsible for it).

## HTTPS and domain

The compose file publishes the app only on `127.0.0.1`. To use it from other devices, put it behind a reverse proxy with HTTPS and set `APP_URL=https://budget.example.com` in `.env`, then `docker compose up -d`. Sign-in works only from the address in `APP_URL`. Example with [Caddy](https://caddyserver.com) (automatic certificate), `Caddyfile`:

```
budget.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Traefik, nginx or a tunnel (Cloudflare Tunnel, Tailscale) work just as well, forwarding to `127.0.0.1:3000` with the `X-Forwarded-*` headers.

On a home network without a domain: `APP_BIND=0.0.0.0` and `APP_URL=http://<the machine's IP>:3000`, and always open the app at that address.

## Updating

```bash
git pull                 # new compose file and scripts, if any
docker compose pull
docker compose up -d
```

The migrations run before the app. To pin a version, set `BUDDYBUDGET_VERSION=0.79.0` in `.env` ([releases](https://github.com/YonderUrik/buddy-budget/releases)). Take a backup before updating.

## Backup and restore

All data is in the Postgres volume `postgres-data`.

```bash
# backup (compressed, restorable on any Postgres 17)
docker compose exec -T postgres pg_dump -U buddybudget -Fc buddybudget > buddybudget-$(date +%F).dump

# restore onto an empty instance (after `docker compose up -d postgres`)
docker compose exec -T postgres pg_restore -U buddybudget -d buddybudget --clean --if-exists < buddybudget-2026-10-10.dump
```

Schedule the backup with the system `cron` and copy the files off the machine. Keep `.env` too: losing `BETTER_AUTH_SECRET` only signs everyone out. If you set `DATA_ENCRYPTION_KEY` (descriptions and notes encrypted in the database, optional), keep it apart from the backups: without it they cannot be read. Data saved before setting it is encrypted with `docker compose run --rm migrate pnpm db:encrypt-fields --execute`. In the app, Impostazioni → Esporta i dati downloads a readable ZIP of your data.

## External Postgres

Remove the `postgres` service and its `depends_on`, and put your database URL in `DATABASE_URL` (in `x-app-env` and in the `migrate` service). With TLS use `?sslmode=require`; without `sslmode` the app requires TLS.

## Building from source

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

The build downloads the fonts from Google, so it needs internet access.

## Common problems

- **`POSTGRES_PASSWORD is missing`**: there is no `.env`; run `./scripts/selfhost-init.sh`.
- **`app` stays `unhealthy`**: `docker compose logs app`. A line listing invalid variables names them (for example `APP_URL` without `http://`, or `SMTP_URL` not starting with `smtp://`/`smtps://`).
- **Sign-in fails with "invalid origin" or loops back to the login**: the address in the browser is not `APP_URL` (different host, port, or `http` instead of `https`).
- **Locked out with no email service**: `docker compose run --rm migrate pnpm auth:reset-password you@example.com`.
- **«Su questa installazione non si possono creare nuovi account»**: signups are closed after the first account; see «Accounts».
- **No emails arrive**: `docker compose logs app | grep email` shows the error type (`smtp_EAUTH` = wrong user or password, `smtp_ECONNECTION` = wrong host or port).
- **Prices not updating**: `docker compose logs cron`; the jobs run at the UTC times above.

## For those who publish the images (maintainers)

The images are on GitHub Container Registry (`ghcr.io/yonderurik/buddy-budget`, `buddy-budget-migrate`, `buddy-budget-csv-worker`): free, no pull limits for public packages, same permissions as the repo. Why: `docs/decisioni/2026-10-10-self-hosting-docker.md`.

Every release publishes amd64 images with the version tag and `latest`. To also publish arm64:

1. Repo → Settings → Secrets and variables → Actions → **Variables** → `SELFHOST_IMAGES` = `true`. From the next release the images are multi-architecture (arm64 built with QEMU, slower CI), with SBOM.
2. Keep the packages public (profile → Packages → package → Package settings → *Change visibility* → **Public**); a new package starts private.
3. Check: `docker pull ghcr.io/yonderurik/buddy-budget:latest` while logged out, and `docker buildx imagetools inspect` for both architectures.

Deleting the variable goes back to amd64 only.
