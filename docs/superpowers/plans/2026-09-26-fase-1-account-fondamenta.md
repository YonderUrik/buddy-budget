# Phase 1 — Accounts and foundations — Runbook

**Spec:** `docs/superpowers/specs/2026-09-26-migrazione-vps-k3s-design.md` ("Fase 1" row of the Phases table)

**Goal:** have all the accounts and credentials the following phases need, before touching any server. No code in this phase: only accounts, keys, one purchase.

**Format:** guided runbook, like Phase 0. Each step marked **👤 UTENTE** (user) is carried out by you (dashboards, purchases, key generation); I explain why, check the output and give the go-ahead for the next step. Real credentials never pass in clear text through the chat: where needed, I use the same "paste them into a terminal of yours" pattern already used in Phase 0.

**Completion criterion** (from the spec): all accounts exist, credentials saved in a password manager.

## Order of the steps and why

1. **Domain + Cloudflare** before anything else: it is the base for the Tunnel, DNS, and later on the certificates.
2. **Tailscale**: independent, but should be done anyway before having a VPS to protect.
3. **Cloudflare R2**: independent, needed for CNPG backups in Phase 4, but the keys are generated now.
4. **age key**: independent, needed for SOPS in Phase 3.
5. **VPS purchase**: last paid step, after deciding on domain/region.
6. **`buddy-budget-infra` repo**: empty container for now, filled from Phase 2 onwards.

---

### Step 1 — Domain on Cloudflare

**👤 UTENTE:**
1. If you don't already have a domain for BuddyBudget, register one (on Cloudflare Registrar or elsewhere — if elsewhere, you still add it to Cloudflare in point 2). Any `.dev`/`.app`/`.com` domain is fine; it doesn't have to be the final one forever.
2. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Add a site** → enter the domain → **Free** plan.
3. Cloudflare shows two **nameservers** (e.g. `ada.ns.cloudflare.com`, `bob.ns.cloudflare.com`). Go to the domain's registrar (where you bought it) and replace the nameservers with Cloudflare's.
4. Go back to Cloudflare and wait for the site status to change from "Pending" to **Active** (it can take from minutes to a few hours).

**Tell me when it is "Active"** and the domain name (the name is public, no problem writing it here).

---

### Step 2 — Tailscale

**👤 UTENTE:**
1. Create an account on [tailscale.com](https://tailscale.com) (login with Google/GitHub is fine, **Personal** plan, free).
2. Install the Tailscale client on your PC (Windows) and log in: [tailscale.com/download](https://tailscale.com/download/windows).
3. Check that it is connected: Tailscale icon in the system tray, status "Connected".
4. In the Tailscale dashboard ([login.tailscale.com/admin/machines](https://login.tailscale.com/admin/machines)) you should see your PC in the list.

There's no need to create nodes for the VPS yet: the Ansible playbook in Phase 2 will do it, installing Tailscale there too.

**Tell me when your PC shows up in the machine list.**

---

### Step 3 — Cloudflare R2 (storage for backups)

**👤 UTENTE:**
1. Cloudflare dashboard → **R2 Object Storage** (side menu) → enable it if asked (a card is required, but the 10GB free plan charges nothing until you exceed the threshold).
2. **Create bucket** → name `buddybudget-backups` → automatic location.
3. **Manage R2 API tokens** (on the same R2 page, not in the general account tokens) → **Create API token**:
   - Permissions: **Object Read & Write**, limited to the `buddybudget-backups` bucket.
   - Generate. Cloudflare shows **only once**: Access Key ID, Secret Access Key, and the S3 endpoint (like `https://<account-id>.r2.cloudflarestorage.com`).
4. Save the three pieces of information in a password manager, labelled "R2 buddybudget-backups". **Don't paste them here.**

**Just tell me "done"** when the bucket exists and the keys are saved. We'll check that they really work when we configure CNPG in Phase 4 (real write test), not now.

---

### Step 4 — age key (root of the encrypted secrets)

This is the only key that, if lost, makes all the encrypted secrets in the infra repo unrecoverable (short of regenerating them one by one). It must be generated **by you**, locally, and **must never end up in the chat, in a repo or in a file synced without encryption**.

**👤 UTENTE**, in Git Bash:
```bash
# Install age (once only)
winget install FiloSottile.age
```
Then, in a folder **outside** the repo (e.g. `~/secrets/`):
```bash
mkdir -p ~/secrets && cd ~/secrets
age-keygen -o buddybudget-age-key.txt
cat buddybudget-age-key.txt
```
The file contains two lines: a comment with the **public key** (`# public key: age1...`) and the **private key** (`AGE-SECRET-KEY-1...`).

1. Copy the public key line (the `age1...` one) and paste it here: it is not a secret, I need it to configure SOPS in Phase 3.
2. The private key **stays only in this file**: save it in the password manager (entry "age key BuddyBudget infra", paste the whole content of the file) and make an offline copy (e.g. on a USB stick, or printed and kept somewhere safe). If you want, I can show you how to encrypt a backup of that file — just tell me.
3. From here on the `~/secrets/buddybudget-age-key.txt` file is not needed in the repo: we'll only use it to decrypt locally if necessary.

**Tell me the public key** and confirm that you saved the private one in at least two places.

---

### Step 5 — `buddy-budget-infra` repo

**👤 UTENTE:**
1. On GitHub, create a new **private** repository called `buddy-budget-infra` (same account/organization as `buddy-budget`).
2. No need to initialize it with anything (no README, no `.gitignore`): it stays empty for now, we fill it from Phase 2 onwards.

**Tell me when it exists** (or paste me the URL, e.g. `https://github.com/YonderUrik/buddy-budget-infra`) and I'll check that it is reachable and private.

---

### Step 6 — Hostinger VPS purchase

Do it last, once steps 1-5 are confirmed: you avoid paying for hosting while you are still setting up free accounts.

**👤 UTENTE:**
1. Go to [hostinger.it](https://www.hostinger.it) → VPS → choose the plan with **2 vCPU / 8GB RAM / 100GB NVMe**.
2. **Before paying**, check and write to me:
   - the **renewal price** (not the discounted one at first checkout) — usually shown in small print or in the cart summary;
   - the **available datacenter** — choose one in the EU (e.g. Netherlands, Germany, Lithuania — Hostinger usually lists the locations during setup);
   - if it offers to choose the image right away: choose **Ubuntu 24.04 LTS** (without panels like CyberPanel/Plesk: Ansible puts k3s on it, no panel needed).
3. Complete the purchase.
4. From the Hostinger panel (hPanel → VPS → your server) retrieve: **public IP address** and, if available, the option to set a root password or an SSH key at creation time — **choose an SSH key if asked**, not a password (more secure, and consistent with what we'll do with Ansible in Phase 2).

If you don't have an SSH key pair on your PC yet, let me know before getting to this point: I'll generate one with a command, so you can upload it to Hostinger during setup.

**Tell me**: renewal price, chosen datacenter, and (when ready) the public IP of the VPS.

---

## End of phase

When all 6 steps are confirmed, I update CLAUDE.md (project status + decision log) with the domain, the existence of the accounts and the VPS IP, and we prepare the plan for **Phase 2** (Ansible: host hardening + k3s).
