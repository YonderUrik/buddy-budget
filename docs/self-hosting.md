# Self-hosting con Docker

BuddyBudget gira con un solo comando su qualunque macchina con Docker (Linux, macOS, Windows con WSL2; amd64 o arm64, anche un Raspberry Pi 4/5). Il compose avvia l'app, Postgres, Redis e un promemoria che lancia i lavori periodici.

> **Stato delle immagini**: finché i manutentori non attivano la pubblicazione su ghcr.io (sezione «Per chi pubblica le immagini» in fondo), `docker compose up` non trova `latest`: costruisci dal sorgente (sezione «Costruire dal sorgente», serve internet per scaricare i font).

## Avvio in 5 minuti

Servono Docker con il plugin Compose v2 e `openssl`.

```bash
git clone https://github.com/YonderUrik/buddy-budget.git
cd buddy-budget
./scripts/selfhost-init.sh      # crea .env con i segreti casuali
docker compose up -d
```

Apri <http://localhost:3000>. Alla prima partenza le migration girano da sole (servizio `migrate`) e l'app diventa raggiungibile in circa un minuto: `docker compose ps` mostra `healthy`.

### Primo accesso senza email

L'accesso è con un link via email (o Google). Se non hai configurato Resend, il link compare nei log: inserisci la tua email nella pagina di login, poi

```bash
docker compose logs app | grep "Link di accesso"
```

e apri l'URL stampato (vale pochi minuti). L'account si crea al primo accesso; segue l'onboarding con lingua e valuta.

## Cosa funziona senza servizi esterni

| Integrazione | Variabili | Se la lasci vuota |
|---|---|---|
| Email (Resend) | `RESEND_API_KEY`, `RESEND_FROM` | Il link di accesso va nei log. Non partono avvisi di prezzo, email dell'account, avvisi di scadenza bancaria, segnalazioni dall'app. |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Il pulsante «Continua con Google» compare ma risponde con un errore: usa il link via email. |
| Banche (GoCardless) | `GOCARDLESS_SECRET_ID`, `GOCARDLESS_SECRET_KEY` | Niente conti collegati; restano conti manuali, import CSV, investimenti, debiti, pensione. |

Tutto il resto (movimenti, categorie e regole, budget, investimenti con i prezzi dalle fonti gratuite, debiti, analitiche) funziona senza chiavi. Il servizio `cron` aggiorna i prezzi e gli snapshot del patrimonio agli stessi orari della produzione (06:30/17:30/22:30 UTC).

Non incluso nel compose: il worker per l'import AI dei CSV personali (`buddy-budget-csv-worker`, richiede una chiave OpenRouter). Gli altri import CSV non ne hanno bisogno.

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

Pianifica il backup con `cron` del sistema e copia i file fuori dalla macchina. Conserva anche `.env`: perdere `BETTER_AUTH_SECRET` disconnette tutti, non perde dati. Dall'app, Impostazioni → Esporta i dati scarica uno ZIP leggibile con i tuoi dati.

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
