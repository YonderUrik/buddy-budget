#!/bin/sh
# Configurazione guidata nel terminale. --defaults crea un file minimo senza domande.
set -eu
cd "$(dirname "$0")/.."

case "${1:-}" in
  --defaults) ;;
  "")
    if command -v node >/dev/null 2>&1 && node -e 'if (Number(process.versions.node.split(".")[0]) < 24) process.exit(1)' 2>/dev/null; then
      exec node scripts/selfhost/setup.mjs
    fi
    if ! command -v docker >/dev/null 2>&1; then
      echo "Setup requires Docker or Node.js 24 or later." >&2
      exit 1
    fi
    # Nessun socket Docker, servizio web o software da installare sulla macchina host.
    exec docker run --rm -it --init \
      --user "$(id -u):$(id -g)" \
      -v "$(pwd):/workspace" -w /workspace \
      node:24-alpine node scripts/selfhost/setup.mjs
    ;;
  *) echo "Usage: ./scripts/selfhost-init.sh [--defaults]" >&2; exit 1 ;;
esac

if [ -e .env ]; then
  echo ".env already exists. No changes made. Run without --defaults to edit it." >&2
  exit 0
fi

random() { openssl rand -hex 32; }

umask 077
# `|` come separatore: i valori sono esadecimali, senza caratteri speciali.
sed \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(random)|" \
  -e "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(random)|" \
  -e "s|^CRON_SECRET=.*|CRON_SECRET=$(random)|" \
  .env.selfhost.example > .env
chmod 600 .env
echo "Created .env with generated secrets. Check APP_URL, then run: docker compose up -d"
