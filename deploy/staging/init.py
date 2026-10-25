#!/usr/bin/env python3
"""Generate isolated staging secrets on the host. Never copy a production .env."""
import argparse
import base64
import os
from pathlib import Path
import secrets
import subprocess
from urllib.parse import urlparse

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("url", help="HTTPS staging origin, e.g. https://staging.buddybudget.io")
parser.add_argument("--root", type=Path, default=Path.home() / "buddy-budget-staging")
args = parser.parse_args()
url = args.url.rstrip("/")
parsed = urlparse(url)
if parsed.scheme != "https" or not parsed.hostname or parsed.path or parsed.query or parsed.fragment or parsed.username:
    parser.error("Provide an HTTPS origin without a path, query or credentials")
os.umask(0o077)
root = args.root.resolve()
root.mkdir(mode=0o700, parents=True, exist_ok=True)
root.chmod(0o700)
(root / "secrets").mkdir(mode=0o700, parents=True, exist_ok=True)
if (root / ".env").exists():
    raise SystemExit("Staging .env already exists; leaving all secrets unchanged.")
# The gateway publishes HTTPS only on this address (see compose.yml).
tailscale_ip = subprocess.run(["tailscale", "ip", "-4"], capture_output=True, text=True, check=True).stdout.split()[0]
password = secrets.token_urlsafe(24)
hashed = subprocess.run(["openssl", "passwd", "-apr1", "-stdin"], input=password + "\n", capture_output=True, text=True, check=True).stdout.strip()
(root / "secrets" / "htpasswd").write_text(f"staging:{hashed}\n")
(root / "secrets" / "htpasswd").chmod(0o644)  # nginx's worker must read the mounted hash
(root / "access.txt").write_text(f"BuddyBudget staging\nURL: {url}\nUsername: staging\nPassword: {password}\n\nSign in with your email address; login messages arrive in your mailbox.\n")
env = {
    "APP_URL": url,
    "STAGING_ROOT": str(root),
    "POSTGRES_PASSWORD": secrets.token_hex(32),
    "BETTER_AUTH_SECRET": secrets.token_hex(32),
    "CRON_SECRET": secrets.token_hex(32),
    "DATA_ENCRYPTION_KEY": base64.b64encode(secrets.token_bytes(32)).decode(),
    "PERSONAL_CSV_ENCRYPTION_KEY": base64.b64encode(secrets.token_bytes(32)).decode(),
    "STAGING_DOMAIN": parsed.hostname,
    "TAILSCALE_IP": tailscale_ip,
}
(root / ".env").write_text("".join(f"{key}={value}\n" for key, value in env.items()))
print(f"Staging secrets created in {root}; credentials are in access.txt (not printed).")
print("Provision the Resend sender/key, app/worker OpenRouter keys, CLOUDFLARE_DNS_API_TOKEN and ACME_EMAIL separately before deploying.")
print(f"Then point {parsed.hostname} (A record, DNS only) to {tailscale_ip}.")
