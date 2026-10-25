#!/usr/bin/env python3
"""Generate isolated staging secrets on the host. Never copy a production .env."""
import argparse
import base64
import json
import os
from pathlib import Path
import secrets
import subprocess
from urllib.parse import urlparse

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("url", help="Public HTTPS staging origin")
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
(root / "secrets" / "cloudflare").mkdir(mode=0o700, parents=True, exist_ok=True)
if (root / ".env").exists():
    raise SystemExit("Staging .env already exists; leaving all secrets unchanged.")
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
    "COMPOSE_PROFILES": "public",
}
(root / ".env").write_text("".join(f"{key}={value}\n" for key, value in env.items()))
credentials = root / "secrets" / "cloudflare" / "credentials.json"
if credentials.exists():
    tunnel_id = json.loads(credentials.read_text())["TunnelID"]
    (credentials.parent / "config.yml").write_text(f"tunnel: {tunnel_id}\ncredentials-file: /etc/cloudflared/credentials.json\ningress:\n  - hostname: {parsed.hostname}\n    service: http://gateway:80\n  - service: http_status:404\n")
print(f"Staging secrets created in {root}; credentials are in access.txt (not printed).")
print("Provision the Resend sender/key and app/worker OpenRouter keys separately before deploying.")
