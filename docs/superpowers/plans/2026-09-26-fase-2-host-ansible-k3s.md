# Fase 2 — Host: hardening + k3s — Runbook

**Spec:** `docs/superpowers/specs/2026-09-26-migrazione-vps-k3s-design.md` (riga "Fase 2" della tabella Fasi)

**Obiettivo:** portare la VPS vergine (`179.198.212.157`, Ubuntu 24.04 LTS) a un nodo k3s pronto e in sicurezza, ricostruibile da zero con Ansible.

**Stato di partenza verificato** (letto dalla VPS prima di scrivere questo piano):
- SSH: `PermitRootLogin yes`, `PasswordAuthentication yes` (attivo per un conflitto tra due file di drop-in: `/etc/ssh/sshd_config.d/50-cloud-init.conf` dice `yes`, il `60-cloudimg-settings.conf` dice `no`, ma OpenSSH usa il **primo valore incontrato** e il 50 viene processato prima del 60 — quindi vince "yes"). Porta 22 raggiungibile da internet.
- Firewall: `ufw` installato ma inattivo, nessuna regola `nftables`.
- `unattended-upgrades` installato.
- Nessun Tailscale, nessun k3s sulla VPS.
- 2 vCPU, 7,8GB RAM liberi.

**Chi esegue cosa:** la maggior parte dei comandi li lancio io da qui (ho già accesso SSH funzionante, e uso WSL Ubuntu sul tuo PC per Ansible). Ti chiedo conferma esplicita **solo** prima dei due passi che potrebbero tagliarti fuori dalla VPS se qualcosa va storto (approvazione blocking, non aggirabile): l'hardening SSH e l'attivazione del firewall. In entrambi i casi verifico l'accesso alternativo **prima** di procedere, non dopo.

**Rete di sicurezza**: se qualcosa dovesse bloccarci fuori, Hostinger offre una console browser (hPanel → VPS → scheda "Console" o simile) che funziona indipendentemente da SSH/firewall. Verifica ora, prima di iniziare, che sai dov'è nel pannello — non serve aprirla, solo sapere che esiste.

## Ordine dei passi (ciascuno verificato prima del successivo)

1. Ansible in WSL + struttura del repo `buddy-budget-infra`.
2. Playbook "base": utente `deploy` con sudo, stessa chiave SSH, nessuna modifica distruttiva.
3. Tailscale sulla VPS, verificato **funzionante** da `deploy`.
4. **[conferma richiesta]** Hardening SSH (disabilita password e root), verificato ancora accessibile via IP pubblico prima del firewall.
5. **[conferma richiesta]** Firewall: nega tutto in ingresso salvo SSH dalla sola rete Tailscale — verifica immediata via IP Tailscale.
6. `unattended-upgrades` configurato esplicitamente (non solo installato).
7. k3s installato senza Traefik/servicelb (arrivano in Fase 3), verificato con `kubectl get nodes`.
8. `kubeconfig` recuperato sul tuo PC, puntato all'IP Tailscale della VPS, verificato da locale.

---

### Passo 1 — Ansible + repo infra

Eseguo io:
- Installo Ansible in WSL Ubuntu (`pipx` o `apt`, versione recente).
- Clono `buddy-budget-infra` in una cartella locale, creo:
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
- `site.yml` include i playbook in ordine (`import_playbook`), ciascuno idempotente e rilanciabile singolarmente.
- L'inventario ha un solo host oggi (`vps1 ansible_host=179.198.212.157`); aggiungere un secondo nodo in futuro è una riga.
- La chiave privata usata da Ansible è la tua `~/.ssh/id_ed25519` esistente (nessuna nuova chiave).

**Verifica:** `ansible all -m ping` dal WSL contro l'inventario risponde `pong`.

---

### Passo 2 — Playbook "base" (utente deploy)

Crea l'utente `deploy` (sudo **con** password richiesta per comandi interattivi, ma con una regola NOPASSWD ristretta ai soli comandi che Ansible userà per l'automazione — non "sudo ALL NOPASSWD" generico), aggiunge la tua chiave pubblica ai suoi `authorized_keys`. **Non tocca ancora root/password**: resta un secondo modo di accesso, non un sostituto.

**Verifica:** connessione SSH come `deploy@179.198.212.157` con la tua chiave, e `sudo -n true` funziona.

---

### Passo 3 — Tailscale sulla VPS

Installa il client Tailscale ufficiale e lancia `tailscale up` **senza chiave di autenticazione** (niente segreti in gioco): il comando stampa un URL di approvazione one-time. Te lo incollo qui, tu lo apri loggato nel tuo account Tailscale e approvi il dispositivo — stesso meccanismo di un login OAuth, l'URL da solo non dà accesso a nulla se non lo apri tu.

**Verifica:** la VPS compare in [login.tailscale.com/admin/machines](https://login.tailscale.com/admin/machines); ottengo il suo IP Tailscale (`100.x.x.x`) e verifico **da qui** una connessione SSH a quell'indirizzo come `deploy`. Solo dopo questa verifica passo al passo 4.

---

### Passo 4 — Hardening SSH ⚠️ conferma richiesta

**Deciso con l'utente**: `PasswordAuthentication` resta **invariata** (`yes`) — niente desktop-only lockout risk, fallback via password disponibile per `deploy` se la chiave si perde. Segnato come **debito da rivedere** quando sarà disponibile un secondo dispositivo (portatile/telefono con client SSH). Il login diretto di **root** invece si disattiva comunque: è il bersaglio più ovvio per un brute-force, e non serve più visto che `deploy` con sudo lo sostituisce in tutto.

Scrive `/etc/ssh/sshd_config.d/10-hardening.conf` (il prefisso `10-` lo fa vincere sul `50-`/`60-` esistenti, per come funziona l'`Include` di OpenSSH — primo valore incontrato vince):
```
PermitRootLogin no
PubkeyAuthentication yes
```
Ricarica `sshd`, poi verifico con `sshd -T` sulla VPS che i valori effettivi siano quelli voluti (incluso che `passwordauthentication` resti `yes`).

**Prima di eseguire questo passo ti chiedo conferma esplicita in chat.** Dopo averlo eseguito, verifico *subito*: login come `deploy` via IP pubblico (ancora aperto, il firewall non è ancora toccato) funziona (chiave e password), e che `ssh root@...` non funzioni più in nessun modo. Se qualcosa non torna, mi fermo qui — l'accesso via `deploy` resta comunque attivo, nessun rischio di lockout a questo stadio.

---

### Passo 5 — Firewall ⚠️ conferma richiesta

Regole `ufw`:
- default: nega tutto in ingresso, permetti tutto in uscita;
- permetti **porta 22 solo dalla rete Tailscale** (`100.64.0.0/10`);
- permetti **porta 6443** (API k8s) solo dalla stessa rete, per `kubectl` da remoto in Fase 3+;
- attiva `ufw`.

Nessuna porta pubblica resta aperta dopo questo passo — coerente con la scelta "Cloudflare Tunnel, niente porte pubbliche" della spec.

**Prima di eseguire questo passo ti chiedo conferma esplicita**, e riverifico subito prima l'accesso SSH via Tailscale (passo 3) — se quella verifica non fosse fresca, la rifaccio. Subito dopo aver attivato `ufw`, provo *io stesso* una connessione SSH all'**IP Tailscale** della VPS: se funziona, il passo è chiuso; se fallisce, uso la console Hostinger per disattivare `ufw` (`ufw disable`) e ci fermiamo a capire cosa non ha funzionato, senza altri tentativi.

---

### Passo 6 — `unattended-upgrades` esplicito

Il pacchetto è già installato ma verifico/imposto esplicitamente `/etc/apt/apt.conf.d/20auto-upgrades` e `50unattended-upgrades` per: aggiornamenti di sicurezza automatici, riavvio automatico alle 04:00 solo se richiesto da un aggiornamento kernel/libc. Reversibile in ogni momento (nessun servizio applicativo gira ancora sulla VPS, quindi un riavvio programmato oggi non ha impatto).

**Verifica:** `unattended-upgrade --dry-run --debug` non lancia errori.

---

### Passo 7 — k3s

Installo k3s (script ufficiale) **senza Traefik e senza servicelb** (`--disable traefik --disable servicelb`): l'ingress e il suo binding sulle porte 80/443 li configuriamo apposta in Fase 3 insieme a `cloudflared`, invece di lasciare che k3s apra qualcosa in automatico ora.

**Verifica:** `k3s kubectl get nodes` mostra il nodo `Ready`.

---

### Passo 8 — kubeconfig in locale

Copio `/etc/rancher/k3s/k3s.yaml` sul tuo PC (`~/.kube/buddybudget-config`), sostituendo `server: https://127.0.0.1:6443` con `server: https://<ip-tailscale-vps>:6443`. Questo file contiene un certificato client: **non va mai committato** nel repo infra (lo gitignoriamo esplicitamente).

**Verifica:** `kubectl --kubeconfig ~/.kube/buddybudget-config get nodes` dal tuo PC (via Tailscale, non serve essere sulla stessa rete fisica) mostra il nodo `Ready`.

## Fine fase

Criterio di completamento (dalla spec): *"uno scan esterno non trova porte aperte; `kubectl` funziona via Tailscale"*. Verifico entrambi esplicitamente prima di chiudere: uno scan delle porte pubbliche dall'esterno (non da dentro la tailnet) e un `kubectl get nodes` riuscito da locale.

Poi commit del contenuto di `ansible/` nel repo `buddy-budget-infra`, aggiornamento di CLAUDE.md, e piano della **Fase 3** (ArgoCD, KSOPS, cloudflared + Traefik, NetworkPolicy).
