#!/bin/sh
# Configure only, or configure and start with --start / --build.
set -eu
cd "$(dirname "$0")/.."

setup_mode=configure
case "${1:-}" in
  "") ;;
  --start) setup_mode=images ;;
  --build) setup_mode=build ;;
  --defaults) setup_mode=defaults ;;
  *) echo "Usage: ./scripts/selfhost-init.sh [--start|--build|--defaults]" >&2; exit 1 ;;
esac

if [ "$setup_mode" = defaults ]; then
  if [ -e .env ]; then
    echo ".env already exists. No changes made. Run without --defaults to edit it." >&2
    exit 0
  fi
  random() { openssl rand -hex 32; }
  umask 077
  postgres_password=$(random)
  auth_secret=$(random)
  cron_secret=$(random)
  sed \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$postgres_password|" \
    -e "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$auth_secret|" \
    -e "s|^CRON_SECRET=.*|CRON_SECRET=$cron_secret|" \
    .env.selfhost.example > .env
  chmod 600 .env
  echo "Configuration saved to .env. BuddyBudget has not been started."
  echo "Next: check APP_URL in .env, then run ./scripts/selfhost-start.sh"
  exit 0
fi

if command -v node >/dev/null 2>&1 && node -e 'if (Number(process.versions.node.split(".")[0]) < 24) process.exit(1)' 2>/dev/null; then
  node scripts/selfhost/setup.mjs "--launch=$setup_mode"
else
  if ! command -v docker >/dev/null 2>&1; then
    echo "Setup requires Docker or Node.js 24 or later." >&2
    exit 1
  fi
  # The wizard container cannot control Docker. Startup runs on the host afterward.
  docker run --rm -it --init \
    --user "$(id -u):$(id -g)" \
    -v "$(pwd):/workspace" -w /workspace \
    node:24-alpine node scripts/selfhost/setup.mjs "--launch=$setup_mode"
fi

case "$setup_mode" in
  build) exec ./scripts/selfhost-start.sh --build ;;
  images) exec ./scripts/selfhost-start.sh ;;
esac
