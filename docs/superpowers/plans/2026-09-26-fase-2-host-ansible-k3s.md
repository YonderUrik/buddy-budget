# Phase 2 — Host: hardening + k3s — Runbook

**Spec:** `docs/superpowers/specs/2026-09-26-migrazione-vps-k3s-design.md` ("Fase 2" row of the Phases table)

**Goal:** turn the blank VPS (`<IP-VPS>`, Ubuntu 24.04 LTS) into a ready and secure k3s node, rebuildable from scratch with Ansible.

**Verified starting state** (read from the VPS before writing this plan):
- SSH: `PermitRootLogin yes`, `PasswordAuthentication yes` (active because of a conflict between two drop-in files: `/etc/ssh/sshd_config.d/50-cloud-init.conf` says `yes`, `60-cloudimg-settings.conf` says `no`, but OpenSSH uses the **first value encountered** and 50 is processed before 60 — so "yes" wins). Port 22 reachable from the internet.
- Firewall: `ufw` installed but inactive, no `nftables` rules.
- `unattended-upgrades` installed.
- No Tailscale, no k3s on the VPS.
- 2 vCPU, 7.8GB of free RAM.

**Who runs what:** I run most of the commands from here (I already have working SSH access, and I use WSL Ubuntu on your PC for Ansible). I ask for your explicit confirmation **only** before the two steps that could lock you out of the VPS if something goes wrong (blocking approval, cannot be bypassed): SSH hardening and firewall activation. In both cases I verify the alternative access **before** proceeding, not after.

**Safety net**: if something were to lock us out, Hostinger offers a browser console (hPanel → VPS → "Console" tab or similar) that works independently of SSH/firewall. Check now, before starting, that you know where it is in the panel — no need to open it, just know that it exists.

## Order of the steps (each one verified before the next)

1. Ansible in WSL + structure of the `buddy-budget-infra` repo.
2. "base" playbook: `deploy` user with sudo, same SSH key, no destructive changes.
3. Tailscale on the VPS, verified **working** from `deploy`.
4. **[confirmation required]** SSH hardening (disable password and root), verified still reachable via the public IP before the firewall.
5. **[confirmation required]** Firewall: deny all inbound except SSH from the Tailscale network only — immediate check via the Tailscale IP.
6. `unattended-upgrades` configured explicitly (not just installed).
7. k3s installed without Traefik/servicelb (they arrive in Phase 3), verified with `kubectl get nodes`.
8. `kubeconfig` retrieved on your PC, pointed at the VPS Tailscale IP, verified locally.

---

### Step 1 — Ansible + infra repo

I run:
- Install Ansible in WSL Ubuntu (`pipx` or `apt`, recent version).
- Clone `buddy-budget-infra` into a local folder, and create:
  ```
  ansible/
    ansible.cfg
    inventory/hosts.ini
    group_vars/all.yml
    playbooks/
      01-base.yml
      02-tailscale.yml
      03-harden-ssh.yml
      04-firewall.yml
      05-unattended-upgrades.yml
      06-k3s.yml
    site.yml
  README.md
  ```
- `site.yml` includes the playbooks in order (`import_playbook`), each one idempotent and re-runnable on its own.
- The inventory has a single host today (`vps1 ansible_host=<IP-VPS>`); adding a second node in the future is one line.
- The private key used by Ansible is your existing `~/.ssh/id_ed25519` (no new key).

**Check:** `ansible all -m ping` from WSL against the inventory answers `pong`.

---

### Step 2 — "base" playbook (deploy user)

Creates the `deploy` user (sudo **with** a password required for interactive commands, but with a NOPASSWD rule restricted to just the commands Ansible will use for automation — not a generic "sudo ALL NOPASSWD"), adds your public key to its `authorized_keys`. **It doesn't touch root/password yet**: it stays a second way of access, not a replacement.

**Check:** SSH connection as `deploy@<IP-VPS>` with your key, and `sudo -n true` works.

---

### Step 3 — Tailscale on the VPS

Installs the official Tailscale client and runs `tailscale up` **without an auth key** (no secrets involved): the command prints a one-time approval URL. I paste it here, you open it logged into your Tailscale account and approve the device — same mechanism as an OAuth login, the URL alone gives access to nothing unless you open it.

**Check:** the VPS shows up in [login.tailscale.com/admin/machines](https://login.tailscale.com/admin/machines); I get its Tailscale IP (`100.x.x.x`) and verify **from here** an SSH connection to that address as `deploy`. Only after this check do I move on to step 4.

---

### Step 4 — SSH hardening ⚠️ confirmation required

**Decided with the user**: `PasswordAuthentication` stays **unchanged** (`yes`) — no desktop-only lockout risk, password fallback available for `deploy` if the key is lost. Marked as **debt to revisit** when a second device is available (laptop/phone with an SSH client). Direct **root** login, instead, is disabled regardless: it is the most obvious target for brute-force, and is no longer needed since `deploy` with sudo replaces it entirely.

Writes `/etc/ssh/sshd_config.d/10-hardening.conf` (the `10-` prefix makes it win over the existing `50-`/`60-`, because of how OpenSSH's `Include` works — first value encountered wins):
```
PermitRootLogin no
PubkeyAuthentication yes
```
Reloads `sshd`, then I verify with `sshd -T` on the VPS that the effective values are the intended ones (including that `passwordauthentication` stays `yes`).

**Before running this step I ask for explicit confirmation in chat.** After running it, I check *immediately*: login as `deploy` via the public IP (still open, the firewall is not touched yet) works (key and password), and `ssh root@...` no longer works in any way. If something doesn't add up, I stop here — access via `deploy` stays active anyway, no lockout risk at this stage.

---

### Step 5 — Firewall ⚠️ confirmation required

`ufw` rules:
- default: deny all inbound, allow all outbound;
- allow **port 22 only from the Tailscale network** (`100.64.0.0/10`);
- allow **port 6443** (k8s API) only from the same network, for remote `kubectl` in Phase 3+;
- enable `ufw`.

No public port remains open after this step — consistent with the spec's "Cloudflare Tunnel, no public ports" choice.

**Before running this step I ask for explicit confirmation**, and I re-check SSH access via Tailscale (step 3) just before — if that check is not fresh, I redo it. Right after enabling `ufw`, I *myself* try an SSH connection to the VPS's **Tailscale IP**: if it works, the step is closed; if it fails, I use the Hostinger console to disable `ufw` (`ufw disable`) and we stop to understand what didn't work, with no further attempts.

---

### Step 6 — Explicit `unattended-upgrades`

The package is already installed, but I explicitly check/set `/etc/apt/apt.conf.d/20auto-upgrades` and `50unattended-upgrades` for: automatic security updates, automatic reboot at 04:00 only if required by a kernel/libc update. Reversible at any time (no application service runs on the VPS yet, so a scheduled reboot today has no impact).

**Check:** `unattended-upgrade --dry-run --debug` raises no errors.

---

### Step 7 — k3s

I install k3s (official script) **without Traefik and without servicelb** (`--disable traefik --disable servicelb`): we configure the ingress and its binding on ports 80/443 on purpose in Phase 3 together with `cloudflared`, instead of letting k3s open something automatically now.

**Check:** `k3s kubectl get nodes` shows the node `Ready`.

---

### Step 8 — kubeconfig locally

I copy `/etc/rancher/k3s/k3s.yaml` to your PC (`~/.kube/buddybudget-config`), replacing `server: https://127.0.0.1:6443` with `server: https://<ip-tailscale-vps>:6443`. This file contains a client certificate: **it must never be committed** to the infra repo (we gitignore it explicitly).

**Check:** `kubectl --kubeconfig ~/.kube/buddybudget-config get nodes` from your PC (via Tailscale, no need to be on the same physical network) shows the node `Ready`.

## End of phase

Completion criterion (from the spec): *"an external scan finds no open ports; `kubectl` works via Tailscale"*. I verify both explicitly before closing: a scan of the public ports from outside (not from inside the tailnet) and a successful `kubectl get nodes` from local.

Then commit the content of `ansible/` to the `buddy-budget-infra` repo, update CLAUDE.md, and plan **Phase 3** (ArgoCD, KSOPS, cloudflared + Traefik, NetworkPolicy).
