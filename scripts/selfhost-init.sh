#!/bin/sh
# Prepares the .env file for self-hosting: copies the example and generates the required secrets.
# Never overwrites an existing .env.
#
#   ./scripts/selfhost-init.sh                              # the app at http://localhost:3000
#   ./scripts/selfhost-init.sh https://budget.example.com   # behind your HTTPS reverse proxy
set -eu
cd "$(dirname "$0")/.."

if [ -e .env ]; then
  echo ".env already exists: leaving it as it is." >&2
  exit 0
fi

command -v openssl >/dev/null 2>&1 || { echo "openssl is needed to generate the secrets." >&2; exit 1; }

app_url="${1:-http://localhost:3000}"
case "$app_url" in
  http://*|https://*) ;;
  *) echo "The address must start with http:// or https:// (got: $app_url)." >&2; exit 1 ;;
esac
app_url="${app_url%/}"

hex() { openssl rand -hex 32; }

# `|` as the sed separator: hex, base64 and URL values never contain it.
sed \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(hex)|" \
  -e "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(hex)|" \
  -e "s|^CRON_SECRET=.*|CRON_SECRET=$(hex)|" \
  -e "s|^PERSONAL_CSV_ENCRYPTION_KEY=.*|PERSONAL_CSV_ENCRYPTION_KEY=$(openssl rand -base64 32)|" \
  -e "s|^APP_URL=.*|APP_URL=$app_url|" \
  .env.selfhost.example > .env
chmod 600 .env

cat <<MSG
Created .env with random secrets (keep a copy of it with your backups).

Next:
  docker compose up -d
  open $app_url and create the first account

The first account is yours; nobody else can sign up unless you set ALLOW_SIGNUPS=true in .env.
MSG
