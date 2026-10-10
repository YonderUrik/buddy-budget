#!/bin/sh
# Prepara il file .env per il self-hosting: copia l'esempio e genera i segreti obbligatori. Non sovrascrive un .env esistente.
set -eu
cd "$(dirname "$0")/.."

if [ -e .env ]; then
  echo ".env esiste già: non lo tocco." >&2
  exit 0
fi

random() { openssl rand -hex 32; }

# `|` come separatore: i valori sono esadecimali, senza caratteri speciali.
sed \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(random)|" \
  -e "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(random)|" \
  -e "s|^CRON_SECRET=.*|CRON_SECRET=$(random)|" \
  .env.selfhost.example > .env
chmod 600 .env
echo "Creato .env con segreti casuali. Controlla APP_URL, poi: docker compose up -d"
