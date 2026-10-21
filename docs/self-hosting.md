# Self-hosting con Docker

BuddyBudget si installa con Docker Compose. L’installer ti guida nel terminale: indirizzo pubblico, servizi consigliati, integrazioni facoltative e riepilogo. Il compose avvia app, Postgres, Redis e lavori periodici; con OpenRouter include anche il worker AI.

L’installer è in inglese e ha sei passi: indirizzo, AI, prezzi, email, integrazioni facoltative e riepilogo. Ogni servizio propone `Set up this service now` oppure `Skip for now`. Senza una chiave non chiede modelli né avvia verifiche del servizio saltato; i modelli consigliati si possono cambiare solo scegliendo l’opzione avanzata. Le integrazioni facoltative si scelgono da un unico elenco: Invio le salta tutte.

> **Versione e architettura**: i tag pubblici dipendono dalla pubblicazione dei manutentori (sezione in fondo). Su ARM verifica che il tag contenga `linux/arm64`, oppure costruisci dal sorgente. Per modifiche non ancora rilasciate usa sempre la build dal sorgente.

## Avvio in 5 minuti

Servono Docker con il plugin Compose v2 e un terminale interattivo. Il setup usa Node.js 24 o successivo se presente, altrimenti gira in un container temporaneo, senza installare dipendenze sul computer.

```bash
git clone https://github.com/YonderUrik/buddy-budget.git
cd buddy-budget
./scripts/selfhost-init.sh --start  # configura e avvia con le immagini pubblicate
```

L’installer attende che l’app sia pronta e poi mostra `BuddyBudget is ready`, l’URL da aprire e come accedere. Le migration girano da sole. In modalità personale apre automaticamente il profilo locale, senza pagina di login. In modalità server, senza Resend, la schermata finale spiega come richiedere il link dalla pagina di login e trovarlo nei log; con Resend invita ad aprire l’email.

Per provare questo branch o altre modifiche non rilasciate: `./scripts/selfhost-init.sh --build`. Configura, costruisce e avvia con un solo comando. Se `.env` è già pronto, usa `./scripts/selfhost-start.sh --build` per avviare senza ripetere le domande.

Senza opzioni, `./scripts/selfhost-init.sh` salva solo la configurazione: il messaggio finale chiarisce che l’app non è stata avviata e indica il comando successivo. `--start` usa le immagini pubblicate, `--build` usa il checkout locale. In caso di errore di build o timeout di avvio non compare alcun messaggio di successo e vengono indicati stato e log da controllare.

### Uso personale o server

Il primo dei sette passi chiede `How will you use BuddyBudget?`:

- **Just me, on this computer**: crea un solo profilo personale e apre l’app senza login. Non servono email o Google. L’onboarding conserva le scelte di paese, lingua, valuta, categorie e consensi. Le email restano facoltative, con mittente Resend e indirizzo personale per ricevere le notifiche.
- **On a server or shared with others**: accesso con email o Google. Una configurazione già esistente mantiene questa modalità come suggerimento; non viene disabilitata automaticamente l’autenticazione di installazioni precedenti.

La modalità personale salva `SELFHOST_AUTH_MODE=local`, richiede `APP_BIND=127.0.0.1` e un URL `http://localhost:<porta>` o `http://127.0.0.1:<porta>`. L’app rifiuta l’avvio con configurazioni che espongono l’accesso automatico; rifiuta host inattesi e richieste del browser provenienti da altri siti. Non pubblicare questa modalità tramite proxy, tunnel o inoltro di porte. Per la rete scegli la modalità server. Il valore predefinito del template e di `--defaults` resta `server`.

Per spostare il profilo personale su un server, rilancia il setup, scegli server e inserisci la tua email. `SELFHOST_OWNER_EMAIL` viene associato allo stesso profilo: categorie, dati e preferenze restano intatti; tutte le vecchie sessioni automatiche vengono revocate all’avvio. Puoi poi accedere con il link via email (o dai log). L’email deve essere diversa da quella di eventuali altri account: non vengono fusi utenti. Per attivare la modalità personale serve un database nuovo o il solo profilo personale già creato dal setup; non viene adottato un account di un database condiviso.

In modalità personale le Impostazioni mantengono export e reset dei dati, senza richiedere una nuova verifica via email. Per eliminare tutta l’installazione e il profilo usa la disinstallazione descritta sotto.

### Quali servizi servono davvero?

- **OpenRouter — fortemente consigliato** per categorie AI e CSV di banche e broker non supportati. Crea la chiave su <https://openrouter.ai/settings/keys>, aggiungi credito e imposta un limite di spesa. App e worker la ricevono automaticamente. Ogni persona deve comunque autorizzare l’AI nelle proprie Impostazioni; i CSV richiedono il consenso all’invio del file.
- **Yahoo — già configurato, senza chiave API**. Il setup può controllare una quotazione dalla macchina su cui gira. Un blocco o limite del servizio non richiede di acquistare una chiave Yahoo. Le altre fonti e i cambi BCE sono integrati.
- **Resend — consigliato in modalità server, facoltativo in modalità personale** per login via email, riepiloghi e avvisi. Servono chiave e mittente su un dominio verificato. Il setup abilita il cron email; ogni utente sceglie le notifiche, inizialmente spente.
- **GoCardless, Google, Logo.dev e fonti prezzi aggiuntive — facoltativi**. Il setup spiega cosa abilitano e dove ottenere le credenziali. Google richiede il callback `<APP_URL>/api/auth/callback/google`.
- **Ollama — facoltativo** per commenti al portafoglio, anche su un server locale. Non sostituisce OpenRouter per categorie e CSV.

Le verifiche non inviano dati finanziari, non generano risposte AI a pagamento e non spediscono email. OpenRouter viene controllato per autenticazione e limite della chiave: credito dell’account e compatibilità del modello JSON/ZDR si confermano al primo uso. Resend viene controllato per chiave e dominio: una chiave di solo invio può non permettere di leggere i domini. Google e GoCardless vengono controllati come coppie di campi; il login o collegamento reale si verifica dall’app.

### Modificare la configurazione

Rilancia `./scripts/selfhost-init.sh`: i servizi già configurati propongono `Keep existing settings`, `Edit settings` e `Disable this service`. Invio conserva il valore suggerito o già salvato; per disabilitare un servizio usa il menu esplicito. Saltare un servizio a metà non salva credenziali incomplete e conserva l’eventuale configurazione precedente. I segreti esistenti non vengono mostrati; password database, segreto di accesso e cifratura non vengono rigenerati. Annullando al riepilogo non si modifica `.env`.

Dopo il salvataggio esegui `./scripts/selfhost-start.sh` (oppure `--build` per usare il codice locale). Il comando ferma l’eventuale worker precedente e applica i profili correnti: Compose non ferma da solo un container di un profilo disabilitato. La chiave di cifratura CSV viene conservata. Con `selfhost-init.sh --start` o `--build` questo passaggio è automatico. Impostazioni → Account mostra i servizi configurati; solo chi amministra il server cambia le chiavi con l’installer.

Per uno script automatico o la configurazione manuale: `./scripts/selfhost-init.sh --defaults` crea un file minimo (richiede `openssl`) e non tocca un `.env` esistente. Per abilitare manualmente l’AI configura `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `PERSONAL_CSV_ENCRYPTION_KEY` (32 byte in base64) e `COMPOSE_PROFILES=ai`.

### Primo accesso in modalità server senza email

In modalità personale non c’è alcun login. In modalità server l’accesso è con un link via email (o Google). Se non hai configurato Resend, il link compare nei log: inserisci la tua email nella pagina di login, poi

```bash
docker compose logs app | grep "Link di accesso"
```

e apri l'URL stampato (vale pochi minuti). L'account si crea al primo accesso; segue l'onboarding con lingua e valuta.

## Cosa funziona senza servizi esterni

| Integrazione | Variabili | Se la lasci vuota |
|---|---|---|
| Email (Resend) | `RESEND_API_KEY`, `RESEND_FROM` | Il link di accesso va nei log. Non partono avvisi di prezzo, email dell'account, avvisi di scadenza bancaria, segnalazioni dall'app. |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Il pulsante non compare: usa il link di accesso. |
| Banche (GoCardless) | `GOCARDLESS_SECRET_ID`, `GOCARDLESS_SECRET_KEY` | Niente conti collegati; restano conti manuali, import CSV, investimenti, debiti, pensione. |
| AI (OpenRouter) | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `PERSONAL_CSV_ENCRYPTION_KEY`, `COMPOSE_PROFILES=ai` | Niente categorie AI o CSV personali; restano regole e import standard. |
| Loghi (Logo.dev) | `LOGODEV_PUBLISHABLE_KEY`, `LOGODEV_SECRET_KEY` | Icone locali. |

Movimenti, categorie e regole, budget, investimenti con prezzi gratuiti, debiti e analitiche funzionano senza chiavi. Prezzi, cambi e inflazione richiedono comunque internet. Il cron aggiorna i prezzi alle 06:30/17:30/22:30 UTC e gli snapshot alle 06:50/17:50/23:50 UTC. Le notifiche girano alle 07:00 UTC se `NOTIFICATIONS_MODE=execute`.

Il servizio `csv-worker` usa il profilo `ai`, abilitato dal wizard. La stessa chiave di cifratura CSV viene passata ad app e worker. In self-hosting il tracker Umami del servizio ospitato è disattivato. I report di supporto richiedono `SUPPORT_EMAIL_TO`: se vuota, nessun report viene inviato al supporto BuddyBudget.

## HTTPS e dominio

Il compose pubblica l'app solo su `127.0.0.1` (cambia `APP_BIND` per esporla in rete locale). Per usarla da fuori mettila dietro un reverse proxy con HTTPS e imposta `APP_URL=https://budget.esempio.it` in `.env` (poi `docker compose up -d`): il valore serve a magic link, cookie e callback. Esempio con [Caddy](https://caddyserver.com) (certificato Let's Encrypt automatico), `Caddyfile`:

```
budget.esempio.it {
    reverse_proxy 127.0.0.1:3000
}
```

Traefik, nginx o un tunnel (Cloudflare Tunnel, Tailscale) vanno bene allo stesso modo: basta inoltrare a `127.0.0.1:3000` con gli header `X-Forwarded-*`.

## Aggiornare

```bash
docker compose pull
docker compose up -d
```

Le migration girano prima dell'app. Per bloccarti su una versione imposta `BUDDYBUDGET_VERSION=0.44.2` in `.env` (le versioni sono nelle [release](https://github.com/YonderUrik/buddy-budget/releases)); con `latest` segui l'ultima release. Prima di un aggiornamento importante fai un backup.

## Backup e ripristino

Tutti i dati sono nel volume Postgres `postgres-data`.

```bash
# backup (file compresso, ripristinabile su qualunque Postgres 17)
docker compose exec -T postgres pg_dump -U buddybudget -Fc buddybudget > buddybudget-$(date +%F).dump

# ripristino su un'istanza vuota (dopo `docker compose up -d postgres`)
docker compose exec -T postgres pg_restore -U buddybudget -d buddybudget --clean --if-exists < buddybudget-2026-10-10.dump
```

Pianifica il backup con `cron` del sistema e copia i file fuori dalla macchina. Conserva anche `.env`: perdere `BETTER_AUTH_SECRET` disconnette tutti, non perde dati. Se hai impostato `DATA_ENCRYPTION_KEY` (descrizioni e note cifrate nel database, facoltativa), conservala a parte: senza quella chiave un backup non si rilegge. I dati salvati prima di impostarla si cifrano con `docker compose run --rm migrate pnpm db:encrypt-fields --execute`. Dall'app, Impostazioni → Esporta i dati scarica uno ZIP leggibile con i tuoi dati.

Conserva anche `PERSONAL_CSV_ENCRYPTION_KEY` nei backup privati del file `.env`: senza, i file e i parser AI già cifrati non sono recuperabili. I dati strutturati importati restano nel database.

## Disinstallare o ripartire da zero

Dallo stesso checkout usato per l’installazione, con Docker avviato:

```bash
./scripts/selfhost-uninstall.sh
```

Rimuove i container (anche il worker AI) e la rete dell’installazione, conservando database e `.env`, incluse le chiavi di cifratura. Per reinstallare con gli stessi dati: `./scripts/selfhost-start.sh` (oppure `--build` per il sorgente).

Per eliminare definitivamente anche tutti gli account, transazioni, database e configurazione:

```bash
./scripts/selfhost-uninstall.sh --purge
```

Il comando chiede di digitare `DELETE`; Invio annulla senza modifiche. Fai prima il backup del database e di `.env` se vuoi recuperarli. Per automazioni già autorizzate usa `--purge --yes`. Se Docker segnala un errore, `.env` viene conservato e puoi riprovare. Funziona anche quando `.env` è già assente.

La pulizia riguarda il progetto Compose dell’installazione: non modifica `.env.local`, altri progetti Docker o database esterni. Sorgenti, immagini scaricate e cache di build restano disponibili; non viene eseguito alcun prune globale. Dopo `--purge`, `./scripts/selfhost-init.sh --build` permette una prova da zero.

## Postgres esterno

Rimuovi il servizio `postgres` e le sue dipendenze, e metti in `DATABASE_URL` (nei servizi `app` e `migrate`) l'URL del tuo database. Con TLS usa `?sslmode=require`: senza `sslmode` in produzione l'app pretende TLS.

## Costruire dal sorgente

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

## Problemi comuni

- **`required variable … is missing`**: manca `.env`; lancia `./scripts/selfhost-init.sh`.
- **`app` resta `unhealthy`**: `docker compose logs app`. Se elenca variabili non valide, controlla `APP_URL` (con `http://` o `https://`).
- **Il link di accesso porta a un indirizzo sbagliato**: `APP_URL` non coincide con l'URL del browser.
- **Prezzi fermi**: `docker compose logs cron` e `docker compose exec cron ps`; i lavori girano agli orari UTC indicati sopra.

## Per chi pubblica le immagini (manutentori)

Le immagini stanno su **GitHub Container Registry** (`ghcr.io/yonderurik/buddy-budget` e `buddy-budget-migrate`), non su Docker Hub: gratuito e senza limiti di pull per i pacchetti pubblici, stesso login e stessi permessi del repo, già usato dal deploy di produzione. Il motivo della scelta è nella decisione `docs/decisioni/2026-10-10-self-hosting-docker.md`.

Il workflow di release pubblica già le immagini per amd64. Per pubblicare anche arm64 e il tag `latest` serve attivarlo, una volta:

1. Repo → Settings → Secrets and variables → Actions → **Variables** → crea `SELFHOST_IMAGES` = `true`. Dalla release successiva le immagini sono multi-architettura (amd64 + arm64, build arm64 con QEMU: la CI dura di più), con tag `latest` e SBOM.
2. Dopo la prima pubblicazione: profilo/organizzazione → Packages → ogni pacchetto (`buddy-budget`, `buddy-budget-migrate`) → Package settings → *Change visibility* → **Public**. Senza questo i `docker compose pull` degli altri chiedono il login.
3. Provare: `docker pull ghcr.io/yonderurik/buddy-budget:latest` da un account non loggato e `docker buildx imagetools inspect` per vedere le due architetture.

Per tornare al comportamento di prima basta cancellare la variabile.
