# Fase 1 — Account e fondamenta — Runbook

**Spec:** `docs/superpowers/specs/2026-09-26-migrazione-vps-k3s-design.md` (riga "Fase 1" della tabella Fasi)

**Obiettivo:** avere tutti gli account e le credenziali necessari alle fasi successive, prima di toccare qualunque server. Nessun codice in questa fase: solo account, chiavi, un acquisto.

**Formato:** runbook guidato, come la Fase 0. Ogni passo marcato **👤 UTENTE** lo esegui tu (pannelli, acquisti, generazione chiavi); io spiego il perché, verifico l'output e do il via al passo successivo. Le credenziali vere non passano mai in chiaro nella chat: dove serve, uso lo stesso schema "incollale in un terminale tuo" già usato in Fase 0.

**Criterio di completamento** (dalla spec): tutti gli account esistono, credenziali salvate in un password manager.

## Ordine dei passi e perché

1. **Dominio + Cloudflare** prima di tutto: serve come base per Tunnel, DNS, e più avanti i certificati.
2. **Tailscale**: indipendente, va fatto comunque prima di avere una VPS da proteggere.
3. **Cloudflare R2**: indipendente, serve ai backup di CNPG in Fase 4 ma le chiavi si generano ora.
4. **Chiave age**: indipendente, serve a SOPS in Fase 3.
5. **Acquisto VPS**: ultimo passo a pagamento, dopo aver deciso dominio/regione.
6. **Repo `buddy-budget-infra`**: contenitore vuoto per ora, riempito dalla Fase 2 in poi.

---

### Passo 1 — Dominio su Cloudflare

**👤 UTENTE:**
1. Se non hai già un dominio per BuddyBudget, registralo (su Cloudflare Registrar o altrove — se altrove, lo aggiungi comunque a Cloudflare al punto 2). Un dominio `.dev`/`.app`/`.com` qualsiasi va bene; non deve essere quello finale per sempre.
2. Vai su [dash.cloudflare.com](https://dash.cloudflare.com) → **Aggiungi un sito** → inserisci il dominio → piano **Free**.
3. Cloudflare mostra due **nameserver** (es. `ada.ns.cloudflare.com`, `bob.ns.cloudflare.com`). Vai dal registrar del dominio (dove l'hai comprato) e sostituisci i nameserver con quelli di Cloudflare.
4. Torna su Cloudflare e attendi che lo stato del sito passi da "In attesa" ad **Attivo** (può richiedere da minuti a qualche ora).

**Dimmi quando è "Attivo"** e il nome del dominio (il nome è pubblico, nessun problema a scriverlo qui).

---

### Passo 2 — Tailscale

**👤 UTENTE:**
1. Crea un account su [tailscale.com](https://tailscale.com) (login con Google/GitHub va bene, piano **Personal**, gratis).
2. Installa il client Tailscale sul tuo PC (Windows) e fai login: [tailscale.com/download](https://tailscale.com/download/windows).
3. Verifica che sia connesso: icona Tailscale nella system tray, stato "Connected".
4. Nella dashboard Tailscale ([login.tailscale.com/admin/machines](https://login.tailscale.com/admin/machines)) dovresti vedere il tuo PC in elenco.

Non serve ancora creare nodi per la VPS: lo farà il playbook Ansible in Fase 2, che installerà Tailscale anche lì.

**Dimmi quando il tuo PC compare nell'elenco delle macchine.**

---

### Passo 3 — Cloudflare R2 (storage per i backup)

**👤 UTENTE:**
1. Dashboard Cloudflare → **R2 Object Storage** (menu laterale) → attivalo se richiesto (serve una carta, ma il piano gratuito da 10GB non addebita nulla finché non superi la soglia).
2. **Crea bucket** → nome `buddybudget-backups` → location automatica.
3. **Gestisci token API R2** (nella stessa pagina R2, non nei token account generali) → **Crea token API**:
   - Permessi: **Modifica oggetti** (lettura e scrittura), limitato al bucket `buddybudget-backups`.
   - Genera. Cloudflare mostra **una sola volta**: Access Key ID, Secret Access Key, e l'endpoint S3 (tipo `https://<account-id>.r2.cloudflarestorage.com`).
4. Salva le tre informazioni in un password manager, con etichetta "R2 buddybudget-backups". **Non incollarle qui.**

**Dimmi solo "fatto"** quando il bucket esiste e le chiavi sono salvate. Verificheremo che funzionino davvero quando configureremo CNPG in Fase 4 (test di scrittura reale), non ora.

---

### Passo 4 — Chiave age (root dei segreti cifrati)

Questa è l'unica chiave che, se persa, rende irrecuperabili tutti i segreti cifrati nel repo infra (a meno di rigenerarli uno per uno). Va generata **da te**, in locale, e **non deve mai finire in chat, in un repo o in un file sincronizzato senza cifratura**.

**👤 UTENTE**, in Git Bash:
```bash
# Installa age (una volta sola)
winget install FiloSottile.age
```
Poi, in una cartella **fuori** dal repo (es. `~/secrets/`):
```bash
mkdir -p ~/secrets && cd ~/secrets
age-keygen -o buddybudget-age-key.txt
cat buddybudget-age-key.txt
```
Il file contiene due righe: un commento con la **chiave pubblica** (`# public key: age1...`) e la **chiave privata** (`AGE-SECRET-KEY-1...`).

1. Copia la riga della chiave pubblica (quella `age1...`) e incollamela qui: non è un segreto, serve a me per configurare SOPS in Fase 3.
2. La chiave privata **resta solo su questo file**: salvala nel password manager (voce "age key BuddyBudget infra", incolla tutto il contenuto del file) e fanne una copia offline (es. su una chiavetta USB, o stampata e conservata al sicuro). Se vuoi, posso indicarti come cifrare un backup di quel file — dimmelo.
3. Da qui in poi il file `~/secrets/buddybudget-age-key.txt` non serve più nel repo: lo useremo solo per decifrare in locale se necessario.

**Dimmi la chiave pubblica** e conferma che hai salvato la privata in almeno due posti.

---

### Passo 5 — Repo `buddy-budget-infra`

**👤 UTENTE:**
1. Su GitHub, crea un nuovo repository **privato** chiamato `buddy-budget-infra` (stesso account/organizzazione di `buddy-budget`).
2. Non serve inizializzarlo con nulla (niente README, niente `.gitignore`): resta vuoto per ora, lo popoliamo dalla Fase 2 in poi.

**Dimmi quando esiste** (o incollami l'URL, es. `https://github.com/YonderUrik/buddy-budget-infra`) e verifico che sia raggiungibile e privato.

---

### Passo 6 — Acquisto VPS Hostinger

Fallo per ultimo, quando i passi 1-5 sono confermati: eviti di pagare l'hosting mentre sistemi ancora account gratuiti.

**👤 UTENTE:**
1. Vai su [hostinger.it](https://www.hostinger.it) → VPS → scegli il piano con **2 vCPU / 8GB RAM / 100GB NVMe**.
2. **Prima di pagare**, verifica e scrivimi:
   - il **prezzo di rinnovo** (non quello scontato al primo checkout) — di solito visibile in piccolo o nel riepilogo carrello;
   - il **datacenter disponibile** — scegli uno in UE (es. Paesi Bassi, Germania, Lituania — Hostinger di solito elenca le location nel setup);
   - se propone di scegliere l'immagine subito: scegli **Ubuntu 24.04 LTS** (senza pannelli tipo CyberPanel/Plesk: ci mette k3s Ansible, non serve un pannello).
3. Completa l'acquisto.
4. Dal pannello Hostinger (hPanel → VPS → il tuo server) recupera: **indirizzo IP pubblico** e, se disponibile, la possibilità di impostare una password di root o una chiave SSH in fase di creazione — **scegli chiave SSH se te lo chiede**, non password (più sicuro, e coerente con quanto faremo con Ansible in Fase 2).

Se non hai ancora una coppia di chiavi SSH sul tuo PC, fammelo sapere prima di arrivare a questo punto: te la genero con un comando, così la carichi su Hostinger al momento del setup.

**Dimmi**: prezzo di rinnovo, datacenter scelto, e (quando pronto) l'IP pubblico della VPS.

---

## Fine fase

Quando tutti e 6 i passi sono confermati, aggiorno CLAUDE.md (stato del progetto + log delle decisioni) con dominio, presenza degli account e IP della VPS, e prepariamo il piano della **Fase 2** (Ansible: hardening dell'host + k3s).
