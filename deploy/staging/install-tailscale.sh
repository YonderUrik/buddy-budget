#!/bin/bash
# Run on the staging server with sudo. Browser authentication stays interactive.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script with sudo on the staging server." >&2
  exit 1
fi
if ! command -v pacman >/dev/null 2>&1; then
  echo "This installer is for the Arch-based staging server only." >&2
  exit 1
fi

# Use the distribution's signed package; do not upgrade the host or refresh only
# its package database (Arch does not support partial system upgrades).
pacman -S --needed --noconfirm tailscale
systemctl enable --now tailscaled

cat <<'MESSAGE'
Open the authentication link below using the same Tailscale login as the Mac.
Select the BuddyBudget network: tail52c123.ts.net.
MESSAGE

# Keep the host's DNS and subnet routing unchanged. Normal key-based OpenSSH
# remains the SSH service; Tailscale SSH and exit-node advertisement stay off.
tailscale up \
  --hostname=buddybudget-staging \
  --operator=mario \
  --accept-dns=false \
  --accept-routes=false

tailscale status --json | python3 -c '
import json, sys
status = json.load(sys.stdin)
tailnet = status.get("CurrentTailnet", {}).get("MagicDNSSuffix")
if status.get("BackendState") != "Running" or tailnet != "tail52c123.ts.net":
    raise SystemExit("The server has not joined the expected BuddyBudget tailnet; stop and review the login.")
device = status["Self"]
print("Connected to BuddyBudget:", device.get("DNSName"))
print("Tailscale addresses:", ", ".join(device.get("TailscaleIPs", [])))
'
