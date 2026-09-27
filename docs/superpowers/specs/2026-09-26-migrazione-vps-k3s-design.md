# Migrazione da Vercel + Neon a VPS con k3s — design

Data: 2026-09-26
Stato: design approvato in conversazione, in attesa di revisione della spec scritta.
Sostituisce/aggiorna: sezioni "Deployment", "CI/CD" e "Osservabilità" di `2026-07-03-tech-stack-architecture-design.md` (le scelte di fondo restano, qui diventano concrete).

## Obiettivo

Spostare l'intera infrastruttura di BuddyBudget da Vercel + Neon a una VPS gestita in prima persona, per tre motivi espliciti dell'utente:

1. **Costi**: Vercel non è sostenibile a lungo termine.
2. **Prestazioni**: processo Node persistente, niente cold start, DB e Redis nella stessa macchina dell'app.
3. **Apprendimento**: l'utente vuole imparare a gestire un'intera infrastruttura "da produzione vera" (k3s, GitOps, observability), quindi si preferiscono strumenti standard del settore a scorciatoie (Coolify/Dokploy scartati per questo).

Vincolo di processo: **l'utente viene guidato passo passo**. Ogni fase diventa un piano in formato runbook guidato: Claude prepara file e comandi e spiega il perché di ogni passo; l'utente esegue le azioni su account/pannelli/terminale e incolla l'output; Claude verifica prima di proseguire. Acquisti, creazione di chiavi e modifiche DNS le fa sempre l'utente.

## Profilo di rischio

Oggi l'app è usata dall'utente (profilo "A"), ma l'architettura deve essere pronta per utenti esterni reali con dati bancari veri ("B") senza doverla rifare. Conseguenze:

- backup continui fuori dal provider VPS con point-in-time recovery, e restore **provato**;
- nessuna porta pubblica sulla VPS, accesso amministrativo solo via VPN;
- infrastruttura interamente dichiarativa e ricostruibile;
- single node accettato oggi come single point of failure consapevole (vedi "Rimandato").

## Risorse

VPS Hostinger: 2 vCPU, 8 GB RAM, 100 GB NVMe, ~8 €/mese. Da verificare all'acquisto: prezzo di rinnovo (quello da 8 € è tipicamente promozionale con pagamento anticipato), datacenter in UE (GDPR), immagine Ubuntu LTS.

Budget RAM stimato a regime ~4 GB (margine ~50%):

| Componente | RAM indicativa |
|---|---|
| k3s (control plane) + Traefik | ~600 MB |
| Next.js, 2 repliche | 300–600 MB |
| CloudNativePG (operator + 1 istanza) | 600 MB–1 GB |
| Redis | ~100 MB |
| ArgoCD | 500 MB–1 GB |
| VictoriaMetrics + Loki + Alloy + Grafana | ~700 MB–1 GB |
| cloudflared, Umami | ~250 MB |

Regole: ogni pod ha `requests`/`limits` espliciti; **nessuna build sulla VPS** (le immagini si costruiscono in GitHub Actions); i 2 core sono il collo di bottiglia atteso, da monitorare.

## Architettura

```
Internet ──▶ Cloudflare (DNS, WAF, TLS, DDoS)
                 │  tunnel in uscita, nessuna porta pubblica
┌────────────────▼──────────── VPS Hostinger (k3s single-node) ─────────┐
│ ns ingress:   cloudflared ──▶ Traefik                                  │
│ ns app:       buddy-budget (Deployment, 2 repliche, Next standalone)    │
│               CronJob: gocardless-sync (ogni 12h), net-worth-snapshot (23:50)│
│               Job PreSync ArgoCD: drizzle-migrate                        │
│ ns data:      CloudNativePG (Postgres, 1 istanza) ── WAL + base ──▶ R2  │
│               Redis (AOF, PVC)                                          │
│ ns argocd:    ArgoCD ◀── pull ── GitHub repo buddy-budget-infra         │
│ ns observ.:   VictoriaMetrics · Loki · Alloy · Grafana ──▶ alert Telegram│
│ ns analytics: Umami (DB separato sullo stesso cluster CNPG)             │
└────────────────▲───────────────────────────────────────────────────────┘
                 │ Tailscale (SSH, kubectl, Grafana, ArgoCD — solo admin)
             amministratore

GitHub Actions (repo app): lint · tsc · vitest (Postgres di servizio) · build immagine
   → GHCR → aggiornamento tag immagine nel repo infra → ArgoCD sync
Servizi esterni: Resend (email), GoCardless, uptime check esterno (UptimeRobot/Healthchecks.io)
```

### Decisioni per componente

| Area | Scelta | Alternative scartate e perché |
|---|---|---|
| Provider | Hostinger VPS | — (scelta dell'utente; il design è indipendente dal provider) |
| Provisioning host | **Ansible** (playbook nel repo infra, lanciato da WSL) | Configurazione manuale: non ricostruibile, rischio di dimenticare passi di sicurezza |
| Orchestrazione | **k3s** single-node | Docker Compose/Coolify: più semplici ma contrari all'obiettivo di apprendimento e alla futura crescita multi-nodo |
| Ingresso | **Cloudflare Tunnel** (`cloudflared` nel cluster) → Traefik | Porte 80/443 aperte con o senza proxy Cloudflare: superficie esposta maggiore |
| Accesso admin | **Tailscale** (SSH, API k8s, Grafana, ArgoCD) | Esposizione pubblica con autenticazione: inaccettabile con dati bancari |
| GitOps | **ArgoCD**, repo separato `buddy-budget-infra` | Flux (più leggero, UI assente); deploy push da Actions (niente riconciliazione/drift detection) |
| Segreti | **SOPS + age** nel repo infra, decifrati da ArgoCD via KSOPS | Sealed Secrets: chiave legata al cluster, disaster recovery più scomodo |
| Postgres | **CloudNativePG**, backup continui (WAL archiving + base backup) su **Cloudflare R2**, PITR | StatefulSet + `pg_dump` notturno (fino a 24h di perdita, niente PITR); restare su Neon (contrario all'obiettivo, latenza) |
| Redis | Istanza singola, AOF su PVC, **nessun backup** | — contiene solo dati effimeri per design (rate limit, cache, stato job) |
| Migration DB | Migration Drizzle versionate, eseguite da Job k8s come hook `PreSync` di ArgoCD | `db:push` in produzione: non versionato, già causa di incidenti ripetuti |
| Job pianificati | **CronJob k8s** che chiamano endpoint interni `/api/cron/*` protetti da segreto | `node-cron` in `instrumentation.ts`: doppia esecuzione con più repliche, non osservabile, non funziona su serverless |
| Observability | **VictoriaMetrics + Loki (single-binary) + Grafana Alloy + Grafana** | kube-prometheus-stack: ~3× la RAM per lo stesso risultato su 8 GB |
| Alerting | Grafana alerting → **Slack** (webhook nativo) + uptime check esterno | Telegram: scartato il 2026-09-27, l'utente vuole restare su Slack (già usato, e possibile base per notifiche di altri strumenti in futuro). Solo monitoring interno: se cade la VPS cade anche l'allarme |
| Web analytics | **Umami** self-hosted (in alternativa Cloudflare Web Analytics) al posto di `@vercel/analytics` | — |
| Email | Resend, invariato | — |
| Ambienti | Solo `production`; le PR si verificano in CI | Staging: rimandato (RAM e complessità) |

### Principi trasversali

- **Tutto dichiarativo e ricostruibile.** Ansible (host) + repo infra (cluster) + R2 (dati) + chiave age (segreti) bastano a riportare in vita il servizio su una VPS nuova senza passaggi manuali non documentati. La chiave age è l'unico segreto "radice": custodita offline (password manager + copia cartacea), mai nel repo.
- **Least privilege.** NetworkPolicy default-deny per namespace con eccezioni esplicite (app → Postgres/Redis, cloudflared → Traefik → app, Alloy → tutti per la raccolta); container non-root con filesystem read-only dove possibile; utente DB applicativo non superuser; token GHCR e R2 con permessi minimi.
- **Portabilità.** Il codice applicativo non conosce Kubernetes: gli endpoint cron sono normali route HTTP, la config arriva da variabili d'ambiente. L'app resta deployabile su Vercel o altrove.
- **Il GitOps è il confine.** Nessuna modifica manuale al cluster con `kubectl apply` fuori dal repo infra, salvo debug temporaneo annotato.

## Modifiche all'applicazione (Fase 0)

Si fanno **prima** della migrazione, mentre l'app gira ancora su Vercel, e hanno valore anche se la migrazione slittasse.

1. **Migration Drizzle vera**: baseline generata dallo schema attuale, `drizzle-kit migrate` al posto di `db:push`. Chiude il debito noto (tabelle/colonne applicate con `CREATE TABLE`/`ALTER TABLE` diretto, vincolo `transactions_account_external_id_unique` che blocca `db:push`).
2. **Immagine container**: `output: "standalone"` in `next.config.ts`, `Dockerfile` multi-stage con utente non-root, nessun segreto nell'immagine.
3. **Health check**: `/api/health` per liveness (processo vivo) e readiness (ping a Postgres e Redis), esclusa dal matcher di auth in `proxy.ts`.
4. **Cron come endpoint**: `node-cron` e i due `start*Scheduler` rimossi da `instrumentation.ts`; nuove route `/api/cron/gocardless-sync` e `/api/cron/net-worth-snapshot` protette da un segreto condiviso (`CRON_SECRET`, header `Authorization: Bearer`), idempotenti. Nel frattempo le chiama **Vercel Cron**, così il sync automatico e lo snapshot patrimonio iniziano a funzionare subito in produzione (oggi non girano). Il lavoro lungo segue lo standard "Operazioni lunghe" (`after()` + stato su Redis).
5. **Validazione env all'avvio**: schema Zod unico per le variabili d'ambiente, errore esplicito se ne manca una.
6. **CI GitHub Actions**: lint, `tsc --noEmit`, vitest con Postgres e Redis come service container, build e push immagine su GHCR su merge a `main`. L'aggiornamento automatico del tag nel repo infra si aggiunge in Fase 6.

## Fasi

Ogni fase ha un proprio piano (runbook guidato) e un proprio criterio di "fatto".

| # | Fase | Contenuto | Fatto quando |
|---|---|---|---|
| 0 | App pronta | Modifiche elencate sopra, su Vercel | CI verde, immagine su GHCR avviabile in locale con Docker, cron Vercel funzionanti in produzione |
| 1 | Account e fondamenta | Dominio con DNS su Cloudflare, account Tailscale, bucket R2 + chiavi, chiave age, acquisto VPS, repo `buddy-budget-infra` | Tutti gli account esistono, credenziali in password manager |
| 2 | Host | Playbook Ansible: utente non-root, SSH solo chiave e solo via Tailscale, firewall deny-all in ingresso, `unattended-upgrades`, k3s | Uno scan esterno non trova porte aperte; `kubectl` funziona via Tailscale |
| 3 | Piattaforma | ArgoCD + KSOPS, cloudflared + Traefik, NetworkPolicy default-deny, ResourceQuota/LimitRange | Una app di prova risponde su un sottodominio via tunnel, gestita da ArgoCD |
| 4 | Dati | CNPG + backup su R2, Redis | **Restore provato** su un cluster Postgres usa-e-getta da backup R2, con PITR a un istante scelto |
| 5 | Observability | VictoriaMetrics, Loki, Alloy, Grafana, alert Slack, uptime check esterno | Un alert di prova (es. pod in crash) arriva su Slack; il check esterno segnala lo spegnimento simulato |
| 6 | App in parallelo | Deploy su sottodominio di prova con copia dei dati Neon, CronJob, Umami, aggiornamento tag automatico | Verifica manuale completa di tutte le schermate con DB reale; i cron Vercel vengono **disattivati** prima di attivare i CronJob (rate limit GoCardless ~4 chiamate/giorno per conto) |
| 7 | Cutover | Freeze annunciato 15–30 min → `pg_dump` da Neon → restore in CNPG → switch DNS → verifica | App di produzione servita dalla VPS; dopo 2 settimane senza rollback: spegnimento Vercel/Neon e rotazione segreti |

### Cutover e rollback (Fase 7)

- Fermo annunciato di 15–30 minuti; replica logica a zero downtime scartata come sproporzionata al carico attuale.
- Rollback: Vercel e Neon restano intatti e riattivabili (DNS indietro) per 2 settimane. Durante questa finestra un rollback perde i dati scritti sulla VPS dopo il cutover: accettato, finestra breve e utenza ridotta.
- Chiusura: rotazione di **tutti** i segreti usati su Vercel (DB, better-auth, GoCardless, Google OAuth, Resend), cancellazione del file locale `vercelnenon.txt` (credenziali Neon in chiaro, gitignored e mai committato), rimozione di `@vercel/analytics`.

## Rimandato consapevolmente

- **Claude Code sempre attivo per sviluppo continuo**: rimandato. Vincolo già deciso: **mai sulla VPS di produzione** (rischio supply chain/prompt injection con accesso a dati bancari e contesa di CPU). Opzioni quando si riprende: Claude Code on the web (sessioni cloud) oppure una seconda VPS "dev box" senza credenziali di produzione, che lavora solo via PR.
- **Paperclip (orchestrazione di più agenti come "azienda")**: rimandato a dopo il cutover (Fase 7), stessi vincoli del punto precedente — gira sulla futura dev box, mai sulla VPS di produzione; gli agenti lavorano solo via PR con CI obbligatoria e merge umano; spesa dei modelli limitata dai budget di Paperclip. Prerequisito: CI + GitOps delle Fasi 0-6 funzionanti.
- **Staging**: rimandato per RAM e complessità; le PR si verificano in CI.
- **Multi-nodo / alta disponibilità**: rimandato. La preparazione è già nel design (Ansible per aggiungere nodi, CNPG che scala a repliche nello stesso manifest).
- **Cutover zero downtime** (replica logica): scartato per ora.
- **ChatOps/integrazioni aggiuntive su Slack** (deciso 2026-09-27, dopo aver scelto Slack come canale alert della Fase 5): valutare in una sessione dedicata, dopo la Fase 5, l'integrazione di altri strumenti (CI, ArgoCD sync, deploy) come notifiche su Slack dove sensato — solo visibilità, non comandi/gestione operativa da chat (scartata esplicitamente come fuori scope per il rischio di superficie di attacco aggiuntiva con dati bancari in gioco).

## Rischi noti

- **Single node**: guasto della VPS = servizio giù fino alla ricostruzione. Mitigazione: ricostruzione dichiarativa + backup R2 + restore provato; RTO atteso nell'ordine di un'ora.
- **CPU (2 core)**: picchi di sync GoCardless concorrenti con observability. Mitigazione: limits, metriche CPU con alert, possibile upgrade verticale della VPS.
- **Dipendenza da Cloudflare** come edge unico: accettata.
- **Custodia della chiave age**: se va persa, i segreti cifrati nel repo non sono più leggibili (si rigenerano ruotandoli, ma è lavoro). Due copie offline obbligatorie.
