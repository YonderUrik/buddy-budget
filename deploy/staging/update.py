#!/usr/bin/env python3
"""Pull successful main CI candidates. No GitHub token or inbound SSH is needed."""
import argparse
import datetime
import fcntl
import gzip
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import urllib.request

REPO = "YonderUrik/buddy-budget"
FILES = ("compose.yml", "nginx.conf", "scheduler.sh", "certs.sh")


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "buddybudget-staging", "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def candidate():
    deployments = json.loads(fetch(f"https://api.github.com/repos/{REPO}/deployments?environment=staging-candidate&per_page=5"))
    for deployment in deployments:
        if deployment["ref"] != "main":
            continue
        statuses = json.loads(fetch(deployment["statuses_url"]))
        if statuses and statuses[0]["state"] == "success":
            return deployment
    return None


def backup_database(root, compose, env, required=False):
    running = subprocess.run(compose + ["ps", "--status", "running", "-q", "postgres"], check=True, capture_output=True, text=True, env=env)
    if running.stdout.strip():
        backups = root / "backups"
        backups.mkdir(mode=0o700, exist_ok=True)
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        backup = backups / f"{stamp}.sql.gz"
        raw_dump = backup.with_suffix("")
        with raw_dump.open("wb") as output:
            subprocess.run(compose + ["exec", "-T", "postgres", "pg_dump", "-U", "buddybudget", "-d", "buddybudget"], check=True, stdout=output, env=env)
        with raw_dump.open("rb") as source, gzip.open(backup, "wb") as output:
            shutil.copyfileobj(source, output)
        raw_dump.unlink()
        for old in sorted(backups.glob("*.sql.gz"))[:-7]:
            old.unlink()
        print(f"Database backed up: {backup.name}", flush=True)
    elif required:
        raise RuntimeError("Staging PostgreSQL is not running; no backup was created")


def deploy(root, release, version, deployment_id):
    if shutil.disk_usage(root).free < 5 * 1024**3:
        raise RuntimeError("Less than 5 GiB free; refusing to pull images on the shared host")
    compose = ["docker", "compose", "--env-file", str(root / ".env"), "-f", str(release / "compose.yml")]
    env = dict(os.environ, BUDDYBUDGET_VERSION=version, STAGING_ROOT=str(root))
    subprocess.run(compose + ["config", "--quiet"], check=True, env=env)
    subprocess.run(compose + ["pull"], check=True, env=env)
    # Refuse to migrate an existing database without a successful backup first.
    backup_database(root, compose, env)
    subprocess.run(compose + ["up", "-d", "--remove-orphans", "--wait", "--wait-timeout", "240"], check=True, env=env)
    # Record success only after every enabled service is ready. A failed rollout retries.
    state = {"deployment_id": deployment_id, "version": version, "release": str(release), "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    temporary = root / "current.json.tmp"
    temporary.write_text(json.dumps(state, indent=2) + "\n")
    temporary.replace(root / "current.json")
    print(f"Staging healthy: {version}", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.home() / "buddy-budget-staging")
    parser.add_argument("--bootstrap", type=Path, help="Reviewed local release directory for initial/manual deployment")
    parser.add_argument("--version", help="Explicit published version with --bootstrap")
    parser.add_argument("--backup-only", action="store_true", help="Back up the current staging database")
    args = parser.parse_args()
    os.umask(0o077)
    root = args.root.resolve()
    with (root / "update.lock").open("w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        if args.backup_only:
            state = json.loads((root / "current.json").read_text())
            compose = ["docker", "compose", "--env-file", str(root / ".env"), "-f", str(Path(state["release"]) / "compose.yml")]
            env = dict(os.environ, BUDDYBUDGET_VERSION=state["version"], STAGING_ROOT=str(root))
            backup_database(root, compose, env, required=True)
            return
        if args.bootstrap:
            if not args.version or not re.fullmatch(r"(?:\d+\.\d+\.\d+|sha-[a-f0-9]{40})", args.version):
                parser.error("--bootstrap requires a version or full SHA image tag")
            deploy(root, args.bootstrap.resolve(), args.version, 0)
            return
        target = candidate()
        if target is None:
            print("No tested staging candidate published yet.")
            return
        current = json.loads((root / "current.json").read_text()) if (root / "current.json").exists() else {}
        # Delayed CI runs must not replace a newer deployed commit.
        if target["id"] <= current.get("deployment_id", 0):
            return
        sha = target["sha"]
        if not re.fullmatch(r"[a-f0-9]{40}", sha):
            raise ValueError("Invalid candidate SHA")
        previous = current.get("version", "")
        if previous.startswith("sha-") and previous != f"sha-{sha}":
            comparison = json.loads(fetch(f"https://api.github.com/repos/{REPO}/compare/{previous[4:]}...{sha}"))
            if comparison["status"] == "behind":
                print("Ignoring a late CI candidate older than the deployed commit.")
                return
            if comparison["status"] != "ahead":
                raise ValueError("Candidate diverges from the deployed commit; manual review required")
        release = root / "releases" / sha
        release.mkdir(parents=True, exist_ok=True)
        for name in FILES:
            (release / name).write_bytes(fetch(f"https://raw.githubusercontent.com/{REPO}/{sha}/deploy/staging/{name}"))
        deploy(root, release, f"sha-{sha}", target["id"])


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Staging update failed: {error}", file=sys.stderr)
        sys.exit(1)
