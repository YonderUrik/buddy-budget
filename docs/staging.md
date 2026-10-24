# Staging on the FindMyEstate host

BuddyBudget staging runs alongside FindMyEstate on the Omarchy home laptop
(i9-13900H, 16 GB RAM). The stacks have separate Docker networks, databases,
volumes, secrets and Cloudflare tunnels. Staging publishes only a password-protected
gateway on `127.0.0.1:3080`; its database, Redis, app and test inbox have no host ports.

Address: **https://budget-staging.mariovallone.com**. The server's existing
Cloudflare origin certificate is scoped to `mariovallone.com`; moving staging to
`staging.buddybudget.io` requires configuring that domain separately.

## Access and test data

The edge username is `staging`. The randomly generated password is recorded only
on the host in `/home/mario/buddy-budget-staging/access.txt`; retrieve it over SSH.
All pages, APIs and the inbox require this password. Search indexing is disabled
through `X-Robots-Tag`.

The app uses hosted behavior (`SELF_HOSTED=false`, email sign-in, open signup
behind the edge password). Sign in with a test address, then open `/mail/` to read
the captured sign-in message. SMTP goes only to Mailpit: no real email provider
is configured. The inbox is shared with everyone who has staging access; use
fictional data only. `/demo?lang=en` opens the read-only sample accounts after the
initial demo reset. Normal accounts can use the app's sample-data onboarding.

Google OAuth is initially disabled until separate staging credentials and a callback
are configured. Bank credentials are absent, bank jobs are omitted, and new bank
connections are closed. AI imports need a staging `OPENROUTER_API_KEY` and
`COMPOSE_PROFILES=public,ai` in the host `.env`; deterministic broker imports work
without it. Production secrets and financial records must never be copied here.

## Deployment

Source: [`deploy/staging/`](../deploy/staging/). Runtime root:
`/home/mario/buddy-budget-staging`. No builds run on this host.

1. Every push to `main` builds app, migrator and worker images tagged with the
   full commit SHA. Releases additionally publish their version and `latest` tags.
2. After the app checks pass (or are legitimately skipped) and all three images
   are published, CI completes a `staging-candidate` environment job. This is a
   record of a tested candidate, **not** confirmation of a live staging rollout.
3. A user systemd timer checks GitHub's public deployments API every five minutes.
   It selects a successful `main` candidate, fetches the staging configuration at
   the same SHA and pulls the immutable `sha-<40-character commit>` image tags.
4. It backs up the existing staging database, applies the Compose rollout and
   waits for readiness. Only a successful rollout advances `current.json`.
   A lock prevents overlapping deployments and backups. Late CI runs cannot
   replace a newer deployed commit with an ancestor.

The updater needs no GitHub token, SSH listener reachable from GitHub, Docker
socket mounted into a CI job, or self-hosted Actions runner. Pull requests never
deploy. Production retains its release-PR workflow in `buddy-budget-infra`;
staging does not promote images to production automatically.

The updater itself and systemd units are installed from reviewed source and are
not replaced automatically by polling. To update them, copy the reviewed files
to the root and `~/.config/systemd/user/`, then reload systemd.

Useful host commands:

```sh
cat ~/buddy-budget-staging/current.json
systemctl --user list-timers 'buddybudget-staging-*'
journalctl --user -u buddybudget-staging-update.service -n 60
python3 ~/buddy-budget-staging/update.py
```

Initial installation: create a separate Cloudflare tunnel with its credentials
in `secrets/cloudflare/credentials.json`, run `init.py` with the public origin,
then run `update.py --bootstrap <reviewed configuration directory> --version X.Y.Z`.
`init.py` generates every secret and the tunnel config, and refuses to replace
an existing `.env`. Install the four user units and enable the timers. Enable user
lingering so they run without a logged-in session.

## Scheduled work, backups and recovery

The stack schedules prices, net worth snapshots, account deletion, notifications
(captured locally) and nightly sample-account resets. Daily backups run at 03:30
UTC and before every update, retaining the latest seven successful compressed
SQL dumps in `backups/`. Secrets and dumps are readable only by the host user.
These are local recovery copies of disposable test data, not an offsite backup
of production.

```sh
python3 ~/buddy-budget-staging/update.py --backup-only
systemctl --user stop buddybudget-staging-update.timer
```

For an application rollback, inspect `current.json` and the retained `releases/`,
then run `update.py --bootstrap <previous configuration directory> --version <previous tag>`.
This changes the application images only: a database migration may require restoring
the matching pre-update dump. Restore into a **new staging database first**, verify
it, then replace staging's database during a maintenance window. Never restore to
FindMyEstate or BuddyBudget production. A failed rollout does not automatically
reverse schema changes; inspect the updater journal before retrying.

Resource limits bound staging's app, database, Redis and supporting services.
Builds remain in GitHub Actions. Compose staging validates application behavior
and migrations, but does not validate production's k3s/ArgoCD manifests. The home
host's availability depends on its power and Internet connection.

Run updater checks with `python3 -m unittest discover -s deploy/staging -p 'test_*.py'`.

References: [Mailpit runtime options](https://mailpit.axllent.org/docs/configuration/runtime-options/),
[Docker Compose services](https://docs.docker.com/reference/compose-file/services/).
