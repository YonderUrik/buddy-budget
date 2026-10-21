#!/bin/sh
# Start the configured installation, then show its actual URL and sign-in instructions.
set -eu
cd "$(dirname "$0")/.."

build_from_source=false
case "${1:-}" in
  "") ;;
  --build) build_from_source=true ;;
  *) echo "Usage: ./scripts/selfhost-start.sh [--build]" >&2; exit 1 ;;
esac

if [ ! -f .env ]; then
  echo "No configuration found. Run ./scripts/selfhost-init.sh first." >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install and start Docker, then run this command again." >&2
  exit 1
fi

set -- -f docker-compose.yml
if [ "$build_from_source" = true ]; then
  set -- "$@" -f docker-compose.build.yml
  echo "Building BuddyBudget from this checkout. The first build may take several minutes."
  if ! docker compose "$@" build; then
    echo "Build failed. BuddyBudget was not started. Review the error above and retry." >&2
    exit 1
  fi
fi

# Compose does not stop an existing worker when its profile is disabled.
# Stop only after a successful build so a build failure leaves it running.
echo "Applying your service configuration…"
if ! docker compose "$@" --profile ai stop csv-worker; then
  echo "Could not apply the configuration. Make sure Docker is running and try again." >&2
  exit 1
fi

echo "Starting BuddyBudget and waiting for the app and database to be ready…"
if ! docker compose "$@" up -d --remove-orphans --wait --wait-timeout 180; then
  echo "BuddyBudget is not ready. Check the service status and logs:" >&2
  echo "  docker compose ps" >&2
  echo "  docker compose logs --tail=50 app migrate postgres" >&2
  echo "Fix the error, then rerun this start command. Your saved configuration is still in .env." >&2
  exit 1
fi

# Read the running app's public configuration; never print any credential.
docker compose "$@" exec -T app node -e '
const url = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const email = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
const local = process.env.SELFHOST_AUTH_MODE === "local";
const lines = ["", "BuddyBudget is ready.", "", "1. Open this address in your browser:", "   " + url, "", local ? "2. Your personal account opens automatically. No sign-in is needed." : "2. Sign in:"];
if (local) {
  lines.push("   BuddyBudget is restricted to this computer.");
} else if (email) {
  lines.push("   Enter your email address and request a sign-in link.", "   Open the email and click the link to continue.");
} else {
  lines.push("   Enter your email address on the login page and request a sign-in link.", "   Email delivery is off. In this terminal, run:", "     docker compose logs --since=5m app", "   Copy the latest sign-in link from the logs into your browser.");
}
if (!local && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) lines.push("   You can also choose Continue with Google.");
lines.push("", "3. Complete your profile in the app.", "   You can enable AI suggestions and email notifications in Settings.", "", "You can close this terminal. BuddyBudget will keep running in Docker.", "To change your API keys later: ./scripts/selfhost-init.sh", "To uninstall: ./scripts/selfhost-uninstall.sh (keeps your data)");
process.stdout.write(lines.join("\n") + "\n");
'
