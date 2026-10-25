# Staging server

BuddyBudget runs on the staging server with dedicated Docker networks, database,
volumes and secrets. Its database, Redis and app have no host ports.

Address: **https://staging.buddybudget.io**, reachable **only from the Tailscale
network** (tailnet `tail52c123.ts.net`). Decided by Daniele on 2026-10-25.

## How the tailnet-only access works

- **DNS**: `staging.buddybudget.io` is a public `A` record in the Cloudflare zone,
  *DNS only* (grey cloud), pointing to the staging host's Tailscale address
  (`100.85.66.41`). Anyone can resolve the name, but `100.64.0.0/10` addresses are
  not routable on the internet: only devices signed in to the tailnet can connect.
  A plain `A` record (not a `CNAME` to `.ts.net`) also resolves reliably on Windows.
- **Gateway**: the nginx gateway publishes HTTPS only on
  `${TAILSCALE_IP}:443` (`compose.yml`). Nothing listens on the LAN or on a public
  interface, and there is no Cloudflare tunnel.
- **Certificate**: `buddybudget.io` sends HSTS with `includeSubDomains`, so staging
  needs a real certificate. The `certs` service (certbot, `certs.sh`) gets it from
  Let's Encrypt with the Cloudflare DNS-01 challenge, checks renewal twice a day,
  and nginx reloads every 6 hours to pick it up. It needs `CLOUDFLARE_DNS_API_TOKEN`:
  a Cloudflare API token from the "Edit zone DNS" template, limited to the
  `buddybudget.io` zone.
- **Tailnet policy**: the people who use staging need access to the
  `buddybudget-staging` device on port 443 in the Tailscale access controls.

### Switching an existing installation

Completed on 2026-10-25: the permanent hostname serves valid HTTPS on the
Tailscale address. Application readiness and the login-code
request were verified from the administrator's Mac. The old public tunnel and
temporary DNS route were deleted, and a post-cutover database backup succeeded.
The DNS API token is stored only in the protected host environment and certificate
service; it is not committed. Automatic application updates remain disabled.

1. In Cloudflare, create `A staging.buddybudget.io → 100.85.66.41`, proxy off.
2. Create the Cloudflare token above.
3. On the host, in `~/buddy-budget-staging/.env`: set
   `APP_URL=https://staging.buddybudget.io`, add `STAGING_DOMAIN=staging.buddybudget.io`,
   `TAILSCALE_IP=100.85.66.41`, `ACME_EMAIL=<owner email>` and
   `CLOUDFLARE_DNS_API_TOKEN=<token>`, and remove `COMPOSE_PROFILES=public`.
4. Roll out (the updater does it once this configuration is on `main`); the old
   `tunnel` container is removed by `--remove-orphans`. Then delete the old tunnel
   and its `budget-staging.mariovallone.com` route in Cloudflare.
5. Check from a device on the tailnet that the page opens with a valid certificate,
   and from a device off the tailnet (e.g. a phone on mobile data with Tailscale off)
   that the connection fails.

Compose derives `BETTER_AUTH_URL` from `APP_URL`, so sign-in links and codes use the
same origin. If Google sign-in is enabled, register
`https://staging.buddybudget.io/api/auth/callback/google` as its staging callback.

Initial live verification on 2026-10-25: upgraded from `0.82.0` to `0.88.0`,
verified captured-email sign-in and sample accounts, and restored a backup into
a separate test database with matching user and transaction counts. Daily backups
and user lingering are enabled. The automatic update timer is installed but stays
disabled until the workflow is merged and unattended updates are enabled.

## Access and test data

**Email and AI enabled on 2026-10-25:** staging runs the production `0.88.1`
release with real Resend delivery and the CSV worker. The owner explicitly approved
reusing production's Resend credential/sender and the two OpenRouter credentials.
The login-code flow was accepted by Resend's delivery simulator; AI categorization
and CSV parser generation/execution passed synthetic tests. Mailpit is removed.

Tailscale controls network access. There is no extra HTTP Basic Auth username or
password; users sign in through the app's normal email-code flow. Access instructions
are on the host in `/home/mario/buddy-budget-staging/access.txt`. Search indexing is
disabled through `X-Robots-Tag`.

The app uses hosted behavior (`SELF_HOSTED=false`, email sign-in, open signup
within the tailnet). The updated configuration sends login codes, links and
notification emails through Resend to the actual recipient. Mailpit and its
`/mail/` route are removed. `/demo?lang=en` opens the read-only sample accounts
after the initial demo reset. Normal accounts can use the app's sample-data onboarding.

Before deploying this configuration, provision these required fields in the host
`.env` (never in Git or command output):

- `RESEND_API_KEY` and `RESEND_FROM`: the Resend credential and verified sender.
- `OPENROUTER_API_KEY`: the app's AI categorization credential.
- `CSV_WORKER_OPENROUTER_API_KEY`: the CSV worker's credential, matching production's
  separate app and worker configuration.

The app and worker use `deepseek/deepseek-v4.1-flash` for CSV analysis; AI
categorization retains the application's Jev default, as in production. The worker
is always enabled and shares the staging database and CSV encryption key with the
app. No `ai` Compose profile is required. Reused provider credentials share their
account billing, quotas and access scope; database, auth and encryption secrets
remain independent. The updater removes the obsolete Mailpit container on rollout.

### Handling provider credentials

The approved copy selected only the Resend API key/sender and the app and worker
OpenRouter keys. Selected fields were streamed through two encrypted SSH sessions
using an operating-system pipe on the administrator's Mac. The relay never printed
the payload or wrote it to a Mac file. It did not copy a production environment
file, database credentials, authentication secrets or encryption keys.

The receiver validated the allowlist and atomically updated the staging `.env`
with mode `0600` inside a `0700` directory. It checked that all unrelated environment
lines were preserved. Container configuration was verified using in-memory
comparisons with only boolean results printed. No secret values or fingerprints
were published in Git, chat or command output. Provider credentials are available
to the authorized staging host administrator and the app/worker processes, as
required for their operation.

Google OAuth is initially disabled until separate staging credentials and a callback
are configured. Bank credentials are absent, bank jobs are omitted, and new bank
connections are closed. Production database records, database credentials, auth
secrets and encryption keys must never be copied here.

## Deployment

### Private administrative access with Tailscale

The staging server joined the existing BuddyBudget tailnet
`tail52c123.ts.net` on 2026-10-25. Tailscale is enabled at startup. Connectivity
and key-based SSH from the Mac have been verified against the existing LAN SSH
host key.

- Device: `buddybudget-staging`
- DNS name: `buddybudget-staging.tail52c123.ts.net`
- Tailscale IPv4: `100.85.66.41`

Set `STAGING_SSH_KEY` to the path of the private key authorized for the staging
server, then connect:

```sh
ssh -i "$STAGING_SSH_KEY" mario@buddybudget-staging.tail52c123.ts.net
```

For a rebuild, the prepared installer needs the host user's administrator password
and interactive browser authentication with the same sign-in account as the Mac:

```sh
sudo bash /home/mario/buddy-budget-staging/install-tailscale.sh
```

Source: [`install-tailscale.sh`](../deploy/staging/install-tailscale.sh). It installs
the distribution package, enables the daemon at boot and joins as `buddybudget-staging`.
It preserves host DNS and subnet routing and uses the existing key-based OpenSSH
service. It verifies the expected tailnet after authentication.

After joining, verify `tailscale ping buddybudget-staging` from the Mac and SSH
using the existing deployment key. Tailnet access policy or device approval may
need adjustment by its administrator if the device joins but connections are
denied. Retain LAN SSH until private access has been tested.

See [Tailscale's Linux installation guide](https://tailscale.com/docs/install/linux).

### Deploy a branch for testing

After this workflow is merged to the default branch, open GitHub **Actions →
Deploy branch to staging → Run workflow**. Leave the workflow itself on `main`,
enter the repository branch to test in **branch**, and start the run.

The workflow resolves the branch to one exact commit, runs lint, type checks and
both database-backed test shards, and builds app, migrator and CSV worker images
with separate `staging-<commit>` tags. It publishes a `staging-request` only when
all checks and builds pass. It does not publish production, `main` or `latest` tags.

The server's `buddybudget-staging-manual.timer` checks these explicit requests
every two minutes. It backs up the database and deploys the selected images using the
current reviewed server configuration, preserving hostname, network controls and
secrets even when the selected branch predates the staging setup. Only a healthy
rollout updates `current.json`; failed rollouts retry on the next poll. A newer
request replaces an older request. There is one shared staging site, not one per branch.

The Actions summary confirms that the request is ready, not that the server has
finished deploying. Connect to Tailscale, open `https://staging.buddybudget.io/api/health`
and check its commit against the summary; readiness is at `/api/health/ready`.
If a rollout fails, inspect `journalctl --user -u buddybudget-staging-manual.service`.
Requests wait while the server is offline. No GitHub token, SSH key or Tailscale
credential needs to be added to the server or workflow.

Keep `buddybudget-staging-update.timer` disabled while testing branches, so an
automatic `main` rollout does not replace the branch under test. Daily backups stay
enabled. Install the reviewed updater and manual service/timer, reload user systemd,
and enable `buddybudget-staging-manual.timer` to receive these requests.

### Application updates

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

Initial installation: join the tailnet first (`install-tailscale.sh`), run `init.py`
with `https://staging.buddybudget.io` (it reads the Tailscale address and writes
`STAGING_DOMAIN` and `TAILSCALE_IP`), add the provider credentials, the Cloudflare
DNS token and `ACME_EMAIL` to `.env`, create the DNS record it prints, then run
`update.py --bootstrap <reviewed configuration directory> --version X.Y.Z`.
`init.py` generates every secret and refuses to replace
an existing `.env`. Install the user units and enable the backup and manual-request
timers. Enable the automatic main-update timer only when wanted. Enable user
lingering so they run without a logged-in session.

## Scheduled work, backups and recovery

The stack schedules prices, net worth snapshots, account deletion, notifications
(delivered through Resend) and nightly sample-account resets. Daily backups run at 03:30
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
it, then replace staging's database during a maintenance window. Restore only to
the staging database. A failed rollout does not automatically
reverse schema changes; inspect the updater journal before retrying.

Resource limits bound staging's app, database, Redis and supporting services.
The updater refuses new pulls if less than 5 GiB of disk remains; inspect disk
usage and remove only reviewed unused staging images when needed. Builds remain
in GitHub Actions. Compose staging validates application behavior
and migrations, but does not validate production's k3s/ArgoCD manifests. The home
host's availability depends on its power and Internet connection.

Run updater checks with `python3 -m unittest discover -s deploy/staging -p 'test_*.py'`.

References: [Resend test delivery](https://resend.com/docs/dashboard/emails/send-test-emails),
[Docker Compose services](https://docs.docker.com/reference/compose-file/services/).
