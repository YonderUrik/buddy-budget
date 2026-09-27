# Fase 7 — Cutover (Vercel + Neon → VPS k3s)

> **Stato (2026-09-27):** piano scritto, nessun task eseguito. Prerequisito soddisfatto: Fase 6 completa (9/9), verifica manuale utente end-to-end su `app.buddybudget.io` con dati reali confermata dall'utente.

> **Per chi esegue:** runbook guidato, stesso formato delle Fasi 1-6. Ogni comando `kubectl`/`psql`/DNS resta un'azione dell'utente da terminale (via Tailscale) o da pannello (Cloudflare, Vercel, Google Cloud Console) — Claude prepara i comandi esatti e i manifest, verifica gli esiti, non esegue nulla con credenziali proprie. Nessun task va eseguito senza una finestra di fermo annunciata agli utenti concordata in anticipo (oggi: solo l'utente stesso, ma il criterio resta lo stesso per il futuro).

**Goal:** spostare il traffico di produzione da Vercel + Neon (`buddybudget.io`) al cluster k3s (stesso Deployment già verificato su `app.buddybudget.io` in Fase 6), con un fermo annunciato di 15–30 minuti, mantenendo Vercel/Neon spenti ma **non cancellati** per 2 settimane come rollback, poi rotazione di tutti i segreti e spegnimento definitivo.

**Dominio di produzione oggi:** `buddybudget.io` (apice), su Vercel.

**Architecture:** nessun componente k8s nuovo — si riusa il Deployment/Service/CronJob/Umami già in esercizio dalla Fase 6 su `app.buddybudget.io`. Il cutover è: (1) un secondo `Host()` match nella stessa `IngressRoute` per `buddybudget.io`, puntato allo stesso Service `buddy-budget`; (2) `APP_URL`/`BETTER_AUTH_URL` nel Secret app aggiornati al dominio vero; (3) un dump/restore finale Neon → CNPG per portare i dati all'ultimo stato consistente (la copia fatta in Fase 6 è ormai vecchia di giorni); (4) il record DNS `buddybudget.io` su Cloudflare ripuntato dal target Vercel al tunnel Cloudflare (stesso CNAME già usato per `app.`/`test.`/`status.`).

**Spec:** `docs/superpowers/specs/2026-09-26-migrazione-vps-k3s-design.md`, sezione "Cutover e rollback (Fase 7)" (riga 122) — fermo 15–30 min, rollback 2 settimane, rotazione segreti alla chiusura.

## Global Constraints

- **Nessuna interruzione permanente prima di aver verificato che il nuovo lato funziona**: il traffico si sposta solo dopo che dump+restore sono confermati (conteggio righe, un paio di query di controllo), mai "a occhio".
- **Vercel e Neon non si toccano in modo distruttivo in questa fase**: si spengono/disabilitano (progetto in pausa, dominio rimosso da Vercel), non si cancella nulla. La cancellazione è il **Task 8**, esplicitamente dopo 2 settimane e solo su conferma dell'utente.
- **GoCardless non richiede aggiornamenti di configurazione esterna**: il redirect URL è costruito a runtime da `getAppUrl()` (`app/api/gocardless/connections/route.ts`), non è registrato staticamente in un pannello — cambia da solo seguendo `APP_URL`.
- **Google OAuth invece sì**: better-auth è montato su `/api/auth/[...all]`, quindi il redirect URI da aggiungere in Google Cloud Console è `https://buddybudget.io/api/auth/callback/google` (stesso pattern già usato per `app.buddybudget.io` in Fase 6 Task 5 — verificare lì l'URI esatto già registrato come riferimento, prima di aggiungerne uno nuovo).
- **Resend (email transazionali)**: nessuna azione — l'invio non dipende dal dominio da cui è servita l'app, solo dal dominio mittente già verificato su Resend (non cambia).
- **Congelare le scritture durante dump+restore**: il freeze deve fermare _entrambe_ le fonti di scrittura concorrenti (Vercel Cron è già disattivato dalla Fase 0; i CronJob k8s **vanno sospesi anche loro** per la finestra di dump, altrimenti un sync GoCardless/snapshot patrimonio scritto su CNPG durante il dump Neon→CNPG verrebbe sovrascritto dal restore).
- **Cloudflare-proxied vs DNS-only**: se il record apex `buddybudget.io` oggi punta a Vercel come proxied (nuvoletta arancione) su Cloudflare, lo switch del CNAME è quasi istantaneo (i client risolvono comunque verso gli IP anycast di Cloudflare, cambia solo il routing interno) — se invece è un record DNS-only (es. l'A record consigliato da Vercel, `76.76.21.21`), vale la vera propagazione DNS e il fermo va calcolato includendo il TTL del record. **Verificare il tipo di record prima di stimare il fermo** (Task 1).
- **`www.buddybudget.io`**: se oggi esiste un redirect www→apice (o viceversa) configurato su Vercel, va replicato con lo stesso schema su Cloudflare/Traefik — non dare per scontato che non esista senza controllare (Task 1).

## Review Focus

- **Split-brain dati**: se per un qualunque motivo (cache DNS di un client, browser con tab vecchia aperta) una richiesta scrive ancora su Neon dopo l'inizio del dump, quella scrittura va persa silenziosamente al restore — da qui il fermo annunciato e la disattivazione esplicita del progetto Vercel (Task 4) invece di limitarsi allo switch DNS.
- **Redirect Google OAuth dimenticato**: se il Task 3 non è fatto prima del Task 6 (switch traffico reale), il login Google si rompe per tutti gli utenti reali nel momento esatto del cutover — a differenza di Fase 6 dove l'impatto era su un dominio di prova.
- **CronJob non risospesi dopo il restore**: se il Task 5 (sospensione CronJob) non viene invertito nel Task 7, GoCardless/snapshot patrimonio restano fermi in silenzio dopo il cutover — nessun errore visibile, solo dati che smettono di aggiornarsi.
- **`app-secrets.enc.yaml` aggiornato ma non risincronizzato**: cambiare `APP_URL`/`BETTER_AUTH_URL` nel Secret senza un restart dei pod (`kubectl rollout restart`) lascia i pod vivi a servire con i valori vecchi finché non vengono naturalmente riavviati — ArgoCD aggiorna il Secret ma non riavvia da solo un Deployment il cui unico cambiamento è un Secret referenziato via `envFrom` (i pod non ricreano l'env a runtime).

---

## Ordine dei passi

1. Ricognizione pre-cutover: tipo di record DNS apex, redirect www, stato backup R2, conferma finestra di fermo con l'utente.
2. Aggiungere `Host(buddybudget.io)` alla `IngressRoute` esistente (senza ancora spostare DNS/segreti — innocuo, non cambia nulla finché DNS punta a Vercel).
3. Registrare il redirect URI Google OAuth per il dominio di produzione.
4. **Finestra di fermo**: sospendere i CronJob k8s + mettere Vercel in pausa (o rimuovere temporaneamente il dominio custom, a scelta dell'utente) → dump Neon → restore in CNPG → verifica.
5. Aggiornare `APP_URL`/`BETTER_AUTH_URL` nel Secret app al dominio vero + `kubectl rollout restart`.
6. Switch DNS: ripuntare `buddybudget.io` (e `www.` se esiste) dal target Vercel al tunnel Cloudflare.
7. Riattivare i CronJob + verifica end-to-end sul dominio reale (stessa checklist del Task 9 di Fase 6) + ripuntare l'uptime check UptimeRobot.
8. Chiudere la finestra di rollback (annotare la data +14 giorni, monitorare) — **task separato, da fare tra 2 settimane**: rotazione di tutti i segreti, spegnimento vero di Vercel/Neon, rimozione `@vercel/analytics` e delle chiavi Umami inutilizzate dal Secret.

---

### Task 1: Ricognizione pre-cutover

**Files:** nessuno (solo verifica).

**Interfaces:**
- Consumes: nessuna.
- Produces: conferma del tipo di record DNS e della finestra di fermo — precondizione per stimare correttamente il Task 6.

- [ ] **Step 1: Tipo di record DNS**

Su Cloudflare DNS → controllare il record per `buddybudget.io` (e `www` se esiste): tipo (`CNAME`/`A`), target attuale, se proxied (nuvoletta arancione) o DNS-only, TTL. Se DNS-only: il fermo del Task 6 deve includere il TTL configurato (tipicamente Vercel consiglia record proxati o TTL bassi, ma va confermato qui, non assunto).

- [ ] **Step 2: Redirect www**

Controllare su Vercel → Project → Domains se esiste un secondo dominio `www.buddybudget.io` con redirect verso l'apice (o viceversa). Se sì, lo stesso redirect va replicato lato Traefik/Cloudflare nel Task 6 (nuova regola `IngressRoute` con `RedirectRegex` o un secondo record DNS + `Host()` match).

- [ ] **Step 3: Stato backup R2**

Confermare che l'ultimo backup CNPG su R2 (Fase 4) sia recente (`rclone ls` sul bucket, oppure `kubectl get backup -n data`) — non blocca il cutover ma è la rete di sicurezza se il restore Task 4 va storto.

- [ ] **Step 4: Concordare la finestra di fermo**

Data/ora esatta con l'utente (fuori orario di utilizzo tipico), comunicata come "manutenzione programmata" se ci sono altri utenti oltre lui. Annotare qui la data scelta prima di procedere al Task 4.

---

### Task 2: `Host(buddybudget.io)` nella IngressRoute

**Files:**
- Modify: `argocd/manifests/app/ingressroute.yaml` (repo `buddy-budget-infra`)

**Interfaces:**
- Consumes: `IngressRoute` esistente (Fase 6), Service `buddy-budget`.
- Produces: Traefik pronto a rispondere su `buddybudget.io` non appena il DNS punterà lì — nessun effetto finché il Task 6 non sposta il DNS (il vecchio target Vercel resta autoritativo fino ad allora).

- [ ] **Step 1: Aggiungere la route**

```yaml
# argocd/manifests/app/ingressroute.yaml — aggiungere accanto alla route esistente per app.buddybudget.io
    - match: Host(`buddybudget.io`) && (Path(`/stats/script.js`) || Path(`/stats/api/send`))
      kind: Rule
      middlewares:
        - name: umami-strip-stats
      services:
        - name: umami
          port: 3000
    - match: Host(`buddybudget.io`)
      kind: Rule
      services:
        - name: buddy-budget
          port: 3000
```

Decidere qui, con l'utente, se **tenere anche `app.buddybudget.io`** come alias permanente (utile come ambiente di staging/preview sempre aggiornato dalla CI) o rimuoverlo dopo il cutover — non blocca nulla, entrambe le route possono coesistere indefinitamente sullo stesso Deployment.

- [ ] **Step 2: Commit e push, verifica sync ArgoCD**

```bash
cd buddy-budget-infra
git add argocd/manifests/app/ingressroute.yaml
git commit -m "feat: aggiunge Host(buddybudget.io) alla IngressRoute per il cutover (Fase 7)"
git push origin main
```

Verificare con `kubectl get ingressroute -n app buddy-budget -o yaml` che la route sia applicata. Nessun impatto visibile finché il DNS non cambia (Task 6).

---

### Task 3: Redirect URI Google OAuth

**Files:** nessuno (pannello esterno, Google Cloud Console).

**Interfaces:**
- Consumes: nessuna.
- Produces: login Google funzionante sul dominio di produzione dal momento del cutover — precondizione bloccante per il Task 6.

- [ ] **Step 1**

Google Cloud Console → Credentials → OAuth Client ID usato da `GOOGLE_CLIENT_ID` → Authorized redirect URIs → aggiungere:

```
https://buddybudget.io/api/auth/callback/google
```

(verificare l'URI esatto già presente per `https://app.buddybudget.io/api/auth/callback/google`, aggiunta in Fase 6 Task 5, e ricalcarne il formato).

- [ ] **Step 2**

Non rimuovere l'URI di `app.buddybudget.io` se si è deciso al Task 2 di tenerlo attivo.

---

### Task 4: Finestra di fermo — sospensione scritture, dump, restore

**Files:** nessuno (comandi da terminale, esecuzione utente via Tailscale).

**Interfaces:**
- Consumes: connessione a Neon (produzione) e a CNPG (cluster k3s).
- Produces: CNPG con l'ultimo stato consistente dei dati di produzione — precondizione bloccante per il Task 6.

- [ ] **Step 1: Sospendere i CronJob k8s**

```bash
kubectl patch cronjob gocardless-sync -n app -p '{"spec":{"suspend":true}}'
kubectl patch cronjob net-worth-snapshot -n app -p '{"spec":{"suspend":true}}'
```

- [ ] **Step 2: Mettere Vercel in pausa**

Vercel → Project → Settings → scegliere una delle due (a scelta dell'utente, entrambe fermano le scritture reali):
- **Pausare il progetto** (Vercel supporta la pausa a livello di team/progetto sui piani che la offrono) — il dominio risponde con una pagina di pausa Vercel.
- **Rimuovere temporaneamente il dominio custom** dal progetto (Settings → Domains → remove `buddybudget.io`) — il dominio smette di risolvere verso Vercel finché non lo si ripunta al Task 6 comunque, quindi in pratica il Task 6 fa proprio questo passo "in avanti" (si ripunta a Traefik invece che rimettere Vercel).

Scelta consigliata: rimuovere il dominio da Vercel qui stesso, così il Task 6 diventa solo "aggiungere il record su Cloudflare verso il tunnel" invece di due operazioni separate.

- [ ] **Step 3: Dump da Neon**

Dalla macchina dell'utente (mai da questa sessione cloud — credenziali di produzione):

```bash
pg_dump "$NEON_PRODUCTION_URL" --format=custom --file=buddybudget-cutover-$(date +%Y%m%d%H%M).dump
```

- [ ] **Step 4: Restore in CNPG**

Stesso pattern già provato in Fase 4 (prova di restore) e Fase 6 (copia dati) — restore **pulito** (il DB CNPG di produzione contiene solo la copia stale di Fase 6, va sovrascritta):

```bash
# Da un pod con accesso a CNPG (o port-forward), sullo stesso DB già usato in Fase 6
pg_restore --clean --if-exists --no-owner --role=<ruolo_app> \
  --dbname="$CNPG_PRODUCTION_URL" buddybudget-cutover-*.dump
```

- [ ] **Step 5: Verifica conteggio righe**

Confrontare `SELECT count(*) FROM <tabelle principali>` tra il dump appena fatto (o Neon, se ancora raggiungibile in lettura) e CNPG dopo il restore — stesso criterio già usato in Fase 0 per la baseline. Non procedere al Task 5 se i conteggi non combaciano.

---

### Task 5: Aggiornare `APP_URL`/`BETTER_AUTH_URL` e riavviare

**Files:**
- Modify: `argocd/manifests/app/app-secrets.enc.yaml` (repo `buddy-budget-infra`)

**Interfaces:**
- Consumes: Secret `app-env` esistente.
- Produces: pod pronti a servire richieste su `https://buddybudget.io` — precondizione per il Task 6 (l'ordine conta: se il DNS si sposta prima che i pod abbiano il nuovo `APP_URL`, i redirect GoCardless/email puntano ancora al dominio sbagliato per la finestra tra i due task).

- [ ] **Step 1: Decifrare, modificare, ricifrare**

```bash
cd buddy-budget-infra
sops argocd/manifests/app/app-secrets.enc.yaml
# cambiare:
#   APP_URL: https://app.buddybudget.io          → https://buddybudget.io
#   BETTER_AUTH_URL: https://app.buddybudget.io   → https://buddybudget.io
```

- [ ] **Step 2: Commit, push, verifica sync**

```bash
git add argocd/manifests/app/app-secrets.enc.yaml
git commit -m "feat: APP_URL/BETTER_AUTH_URL al dominio di produzione per il cutover (Fase 7)"
git push origin main
```

- [ ] **Step 3: Restart esplicito**

ArgoCD aggiorna il Secret ma non riavvia da solo i pod (vedi Review Focus) — riavviare esplicitamente:

```bash
kubectl rollout restart deployment/buddy-budget -n app
kubectl rollout status deployment/buddy-budget -n app
```

- [ ] **Step 4: Verifica interna**

Da dentro il cluster o via port-forward: `curl http://<pod-ip>:3000/api/health` → conferma che i pod nuovi siano `Ready` prima di spostare il DNS.

---

### Task 6: Switch DNS

**Files:** nessuno (pannello Cloudflare).

**Interfaces:**
- Consumes: risultato del Task 1 (tipo di record), Task 4 (Vercel già disattivato), Task 5 (pod pronti).
- Produces: `buddybudget.io` servito dal cluster k3s.

- [ ] **Step 1**

Cloudflare DNS → modificare il record `buddybudget.io` (e `www` se applicabile, vedi Task 1) da target Vercel a **CNAME verso lo stesso tunnel già usato per `app.`/`test.`/`status.`** (`<tunnel-id>.cfargotunnel.com`), **proxied** (nuvoletta arancione) — coerente con gli altri sottodomini, non serve certificato Let's Encrypt separato (TLS terminato da Cloudflare come per tutto il resto).

- [ ] **Step 2: Verifica da rete esterna**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://buddybudget.io/api/health
```

Atteso `200`. Se il record era DNS-only (non proxied), attendere il TTL configurato al Task 1 prima di considerare il cutover concluso.

---

### Task 7: Riattivazione CronJob + verifica end-to-end + uptime check

**Files:** nessuno.

**Interfaces:**
- Consumes: tutto quanto dai Task 1-6.
- Produces: cutover concluso, via libera per la finestra di rollback di 2 settimane.

- [ ] **Step 1: Riattivare i CronJob**

```bash
kubectl patch cronjob gocardless-sync -n app -p '{"spec":{"suspend":false}}'
kubectl patch cronjob net-worth-snapshot -n app -p '{"spec":{"suspend":false}}'
```

- [ ] **Step 2: Checklist end-to-end su `https://buddybudget.io`**

Stessa checklist del Task 9 di Fase 6, ripetuta sul dominio vero (login magic link + Google, Panoramica, Conti + sync manuale, Transazioni, Cash flow, Categorie, `/categorizza`, Umami Realtime, `kubectl get cronjobs -n app` → `LAST SCHEDULE` valorizzato dopo l'orario previsto).

- [ ] **Step 3: Ripuntare l'uptime check esterno**

UptimeRobot (Fase 5) monitora oggi `status.buddybudget.io` come proxy dell'app — aggiungere (o spostare) un check su `https://buddybudget.io/api/health`.

- [ ] **Step 4: Annunciare la fine del fermo**

Comunicare la fine della finestra di manutenzione.

---

### Task 8: Chiusura finestra di rollback (da fare 2 settimane dopo il Task 7, in una sessione dedicata)

**Files:**
- Modify: `argocd/manifests/app/app-secrets.enc.yaml` (rotazione segreti)
- Modify: `app/layout.tsx` (rimozione `@vercel/analytics`)
- Modify: `package.json` (rimozione dipendenza `@vercel/analytics`)

**Interfaces:**
- Consumes: 2 settimane trascorse senza necessità di rollback (nessun problema che abbia richiesto di ripuntare il DNS a Vercel).
- Produces: Vercel/Neon spenti per davvero, tutti i segreti ruotati, codice pulito dal residuo Vercel.

- [ ] **Step 1: Conferma esplicita dell'utente**

Non procedere in autonomia solo perché sono passati 14 giorni sul calendario — chiedere conferma che non ci sono stati problemi/rollback nel frattempo.

- [ ] **Step 2: Rotazione di tutti i segreti**

`DATABASE_URL` (nuova password ruolo CNPG), `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_SECRET` (rigenerato in Google Console), `GOCARDLESS_SECRET_KEY` (rigenerato in GoCardless), `RESEND_API_KEY` (rigenerata in Resend), `CRON_SECRET` — motivo: sono transitati su Vercel (env vars del progetto), quindi vanno considerati potenzialmente esposti a chiunque avesse accesso a quel progetto.

- [ ] **Step 3: Spegnimento vero**

Cancellare il progetto Vercel e il progetto Neon (o solo disattivarli secondo cosa permette il piano tariffario — la cancellazione fisica è a discrezione dell'utente, il criterio di "fatto" di questa fase è che non ricevano più traffico né contengano l'ultima copia utile dei dati).

- [ ] **Step 4: Pulizia codice**

Rimuovere `@vercel/analytics` da `app/layout.tsx`/`package.json` (Umami lo sostituisce dalla Fase 6); rimuovere `NEXT_PUBLIC_UMAMI_SRC`/`NEXT_PUBLIC_UMAMI_WEBSITE_ID` da `app-secrets.enc.yaml` (non più letti, valori ora letterali nel layout — debito già annotato in Fase 6); rimuovere `vercel.json` se non serve più a nulla (verificare prima che non contenga altro).

- [ ] **Step 5: Log finale**

Aggiornare `CLAUDE.md`: "In corso ora" chiude la migrazione VPS, sposta lo stato del progetto su "produzione servita da k3s", registra la voce di log con la data di spegnimento definitivo.
