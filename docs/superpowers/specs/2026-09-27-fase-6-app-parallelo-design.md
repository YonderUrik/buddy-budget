# Fase 6 migrazione VPS — app in parallelo — design

Data: 2026-09-27
Stato: design approvato in conversazione, in attesa di revisione della spec scritta.
Riferimento: `docs/superpowers/specs/2026-09-26-migrazione-vps-k3s-design.md` (sezione Fasi, riga 6).

## Obiettivo

Prima del cutover vero (Fase 7, switch DNS + fermo annunciato), far girare BuddyBudget dentro il cluster k3s appena costruito (Fasi 1-5), con dati reali, verificando end-to-end tutte le schermate — cosa che nessuna fase precedente ha potuto fare (finora solo demo whoami e componenti generici). Vercel + Neon restano la produzione reale per tutta questa fase: l'app di verifica gira in parallelo, non sostituisce nulla finché l'utente non approva il passaggio alla Fase 7.

Criterio di "fatto" (dallo spec principale): verifica manuale completa di tutte le schermate con DB reale; i cron Vercel disattivati prima di attivare i CronJob k8s.

## Decisioni prese in brainstorming

- **Dati**: dump completo da Neon (non un subset anonimizzato) — l'ambiente resta dietro lo stesso auth applicativo e l'unico utente reale oggi è chi guida questa migrazione stessa.
- **Dominio**: `app.buddybudget.io` usato direttamente (non un sottodominio temporaneo) — è già il nome finale deciso per l'app (il dominio nudo `buddybudget.io` è riservato a una futura landing page, fuori scope qui), e oggi nessun altro lo occupa.
- **Repliche**: 2 (uguale al target di produzione), non 1 — si verifica da subito anche il comportamento multi-pod (lock condivisi su sync/snapshot, rolling update).
- **Aggiornamento tag immagine**: step nella CI del repo app (non ArgoCD Image Updater) — nessun componente nuovo nel cluster, coerente col principio "il GitOps è il confine" già scritto nello spec principale.
- **Cron**: i cron Vercel (`gocardless-sync`, `net-worth-snapshot`) vanno disattivati esplicitamente prima di attivare i CronJob k8s equivalenti, per non superare il rate limit GoCardless (~4 chiamate/giorno/conto) con due stack che sincronizzano lo stesso conto in parallelo.

## Componenti

### 1. Namespace e manifest app (repo `buddy-budget-infra`)

Nuovo namespace `app`:
- `Deployment` — 2 repliche, immagine `ghcr.io/<org>/buddy-budget:<tag>` (target `runner` del Dockerfile multi-stage di Fase 0), `env` da un `ConfigMap` (valori non sensibili: `APP_URL=https://app.buddybudget.io`, ecc.) + un `Secret` cifrato SOPS (DB URL, `BETTER_AUTH_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`, credenziali GoCardless, `REDIS_URL`) — stesso schema `kustomization.yaml`+`generator.yaml` già usato per gli altri secret (`grafana-secrets`, R2, tunnel Cloudflare).
- `readinessProbe`/`livenessProbe` su `/api/health` e `/api/health/ready` (già esistenti da Fase 0).
- `Service` ClusterIP.
- `IngressRoute` Traefik per `app.buddybudget.io`, stesso pattern di `test.buddybudget.io` (Fase 3) — richiede aggiungere l'hostname alla configurazione del tunnel cloudflared (già catch-all da Fase 5, quindi nessuna modifica lì) e un record DNS Cloudflare (azione utente).
- `NetworkPolicy`: ingress solo da `ingress` (Traefik) sulla porta dell'app; egress verso `data` (Postgres/Redis) e verso Internet per GoCardless/Resend/Google OAuth (DNS+HTTPS), nessun altro traffico.
- `ResourceQuota`/`LimitRange` sul namespace, soglie con margine sopra l'uso osservato (~300-600 MB per le 2 repliche, per il budget RAM già scritto nello spec principale).

### 2. Migrazione dati Neon → CNPG

- `pg_dump --format=custom` da Neon (comando preparato da Claude, eseguito dall'utente da un terminale con la connection string Neon — mai in chat, stesso vincolo di sempre per credenziali).
- Trasferimento del file dump alla VPS (`scp` via Tailscale) e `pg_restore` dentro un pod temporaneo con `psql`/client Postgres che punta al `Service` CNPG del namespace `data`.
- Verifica: conteggio righe per tabella (`SELECT count(*) FROM ...` su ogni tabella non vuota) confrontato Neon vs CNPG, non solo "il restore non ha dato errori".
- Il restore va rieseguito (drop+ricrea) ogni volta che serve un dato più fresco durante la fase di verifica manuale, finché non si passa alla Fase 7 (che farà l'ultimo restore, quello vero, a cutover).

### 3. CronJob k8s

Due `CronJob` nel namespace `app`:
- `gocardless-sync` — schedule ogni 12h (stesso orario di Vercel Cron), container `curl` (o `alpine/curl`) minimale che chiama `GET http://buddy-budget.app.svc.cluster.local/api/cron/gocardless-sync` con header `Authorization: Bearer $CRON_SECRET` (da env/secret), `restartPolicy: OnFailure`.
- `net-worth-snapshot` — schedule alle 23:50, stesso pattern.
- Nessuna modifica alle route `/api/cron/*` esistenti (già idempotenti da Fase 0).
- Precondizione esplicita, da eseguire **prima** di applicare questi manifest: disattivare/rimuovere le voci `crons` in `vercel.json` (o l'env che le disabilita) e verificare su Vercel che non girino più.

### 4. Umami

- Secondo `Deployment` (immagine ufficiale `ghcr.io/umami-software/umami:postgresql-latest` o versione pinnata, da verificare al momento di scrivere il piano) nel namespace `app`, con un database dedicato (`umami`, utente separato, **non** condiviso con quello dell'app) nello stesso cluster CNPG — coerente con quanto già scritto nello spec principale ("DB separato sullo stesso cluster CNPG").
- `Service` ClusterIP + `IngressRoute` per un sottodominio dedicato (es. `analytics.buddybudget.io`, da confermare nel piano) solo per l'accesso admin alla dashboard Umami — non deve essere raggiungibile pubblicamente allo stesso modo dell'app; valutare nel piano se instradarlo dietro Tailscale come ArgoCD/Grafana invece che via cloudflared pubblico.
- Script di tracking Umami aggiunto al layout Next.js (`app/layout.tsx`), URL/site-id da variabile d'ambiente pubblica (`NEXT_PUBLIC_UMAMI_*`), nessuna raccolta dati finché lo script non è configurato (comportamento di default della libreria — noop se le env mancano).

### 5. Step CI: aggiornamento automatico del tag immagine

Nel workflow GitHub Actions del repo app (quello già esistente da Fase 0 che builda e pusha su GHCR), nuovo job successivo al push immagine:
1. Checkout di `buddy-budget-infra` con una **nuova deploy key in scrittura** (quella esistente per ArgoCD è sola lettura, va aggiunta una seconda chiave dedicata a questo scopo, con permessi limitati a questo repo — azione utente via `gh repo deploy-key add`).
2. Aggiornamento del tag immagine nel manifest `Deployment` del namespace `app` (`yq`/`kustomize edit set image` o `sed` mirato, da scegliere nel piano in base a cosa già usa il repo infra).
3. Commit + push su `main` del repo infra, messaggio con lo sha dell'immagine.
4. ArgoCD (già in polling/webhook da Fase 3) sincronizza da solo, nessuna azione manuale.

## Sequenza operativa attesa (dettaglio nel piano runbook)

1. Disattivare i cron Vercel.
2. Creare manifest namespace `app` (Deployment/Service/IngressRoute/NetworkPolicy/ResourceQuota) — senza ancora i CronJob.
3. Dump/restore dati Neon → CNPG, verifica conteggio righe.
4. Deploy dell'app via ArgoCD, verifica readiness/liveness, DNS `app.buddybudget.io` funzionante da fuori.
5. Applicare i CronJob k8s, verificare una prima esecuzione manuale (`kubectl create job --from=cronjob/...`) prima di aspettare lo schedule.
6. Deploy Umami, verificare tracking su una pagina reale.
7. Aggiungere lo step CI di aggiornamento tag, verificare con un commit di prova che il ciclo build→tag→sync funzioni end-to-end.
8. Verifica manuale utente di tutte le schermate (Conti, Transazioni, Cash flow, Categorie, Panoramica) contro l'app in k8s.

## Rischi e vincoli

- **Doppio sync GoCardless**: mitigato dal punto 1 della sequenza (cron Vercel disattivati per primi), da non invertire mai l'ordine.
- **Restore ripetuti durante la verifica**: ogni restore sovrascrive lo stato del DB di test — se l'utente modifica dati nell'app di test e poi rifà un restore da Neon, quelle modifiche si perdono. Comportamento accettato (l'app di test non è la fonte di verità finché non è la Fase 7 a farne il restore definitivo).
- **Deploy key di scrittura**: nuovo segreto con permessi di scrittura su un repo che ArgoCD legge — va tenuto scoped al solo repo infra (non un token account-wide), stesso principio di least-privilege già applicato agli altri segreti.
- **Umami esposto**: se instradato via cloudflared pubblico invece che Tailscale, la dashboard admin (non solo lo script di tracking, che è pubblico per natura) sarebbe raggiungibile da Internet senza login proprio a differenza di ArgoCD/Grafana — da decidere esplicitamente nel piano, non lasciare a un default implicito.

## Fuori scope (rimandato)

- Cutover vero (Fase 7): resta una fase separata con il proprio runbook.
- Rimozione della demo whoami su `test.buddybudget.io`: non necessaria per questa fase (nomi diversi, nessun conflitto), da valutare a cutover completato.
- Alta disponibilità/multi-nodo: invariato rispetto allo spec principale.
