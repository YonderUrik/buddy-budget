#!/bin/sh
# Remove this Compose installation; keep data unless deletion is explicitly requested.
set -eu
cd "$(dirname "$0")/.."

purge=false
confirmed=false
for option in "$@"; do
  case "$option" in
    --purge) purge=true ;;
    --yes) confirmed=true ;;
    --help|-h)
      echo "Usage: ./scripts/selfhost-uninstall.sh [--purge [--yes]]"
      echo "Default: remove containers and network; keep your database and .env for reinstalling."
      echo "--purge: also permanently delete the database and .env (asks for confirmation)."
      echo "--yes: skip the --purge confirmation for unattended cleanup."
      exit 0 ;;
    *) echo "Unknown option: $option. Use --help for usage." >&2; exit 1 ;;
  esac
done
if [ "$confirmed" = true ] && [ "$purge" != true ]; then
  echo "Use --yes only together with --purge." >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Start Docker and run this command again." >&2
  exit 1
fi
if [ -L .env ]; then
  echo "The configuration .env is a symbolic link. Replace it with a regular file before cleanup." >&2
  exit 1
fi

echo "BuddyBudget — uninstall"
if [ "$purge" = true ]; then
  echo "This will permanently delete this installation's containers, network, database and .env."
  echo "All accounts, imported transactions and saved API keys in this installation will be removed."
  echo "Back up the database and .env first if you want to recover them later (see docs/self-hosting.md)."
  if [ "$confirmed" != true ]; then
    printf 'Type DELETE to erase this installation, or press Enter to cancel: '
    answer=''
    read -r answer || true
    if [ "$answer" != DELETE ]; then
      echo "Cancelled. Nothing was changed."
      exit 0
    fi
  fi
else
  echo "Removing containers and network. Keeping your database and .env for reinstalling."
fi

set -- -f docker-compose.yml --profile ai down --remove-orphans
if [ "$purge" = true ]; then
  set -- "$@" --volumes
fi
# Down needs Compose interpolation even when .env was lost. These placeholders
# are used only to resolve the removal command; no service is created or updated.
if ! POSTGRES_PASSWORD=uninstall-only BETTER_AUTH_SECRET=uninstall-only CRON_SECRET=uninstall-only docker compose "$@"; then
  echo "Cleanup failed. Your .env was kept. Check Docker's error above, then retry." >&2
  exit 1
fi
if [ "$purge" = true ]; then
  rm -f .env
  echo "BuddyBudget was removed, including its database and .env."
  echo "To start fresh: ./scripts/selfhost-init.sh --start (or --build for this checkout)."
else
  echo "BuddyBudget was removed. Your database and .env are still saved."
  echo "To reinstall with the same data: ./scripts/selfhost-start.sh (or add --build)."
  echo "To also erase the saved data: ./scripts/selfhost-uninstall.sh --purge"
fi
echo "Source files, downloaded images, build cache and .env.local are kept. Other Docker projects are untouched."
