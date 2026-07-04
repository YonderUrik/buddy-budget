# Modello dati di base: Conti, Categorie, Transazioni, Budget

**Data**: 2026-07-03
**Stato**: approvato

## Contesto

Primo spec del livello applicativo dopo la pausa del piano infra (`docs/superpowers/plans/2026-07-03-infra-foundation.md`, in pausa: si è deciso di partire dal codice applicativo prima di costruire cluster/CI-CD). Definisce lo schema Postgres/Drizzle per le entità fondamentali da cui dipendono quasi tutte le schermate: conti, categorie di spesa, transazioni, budget mensile.

Le decisioni si appoggiano su quanto già verificato interattivamente nel mockup e documentato in `docs/functional-spec.md` (sezioni "Conti" e "Spese", più "Implicazioni per il modello dati reale" in fondo al documento).

## Cosa questo spec copre

- Setup di Drizzle ORM + Postgres per lo sviluppo locale.
- Schema per: `users` (stub), `categories`, `accounts`, `transactions`, `budgets`.

## Cosa NON copre (deciso consapevolmente, vedi sezione "Fuori scope e futuro" in fondo)

- Autenticazione vera, investimenti/titoli, debiti, pensione, immobile, scenari di Pianifica, abbonamenti rilevati automaticamente.
- Qualunque UI: questo spec produce solo lo schema dati, non le schermate.

## Setup tecnico

- **Drizzle ORM** su **Postgres**, driver **`postgres`** (postgres.js): stessa connection string funziona sia con **Neon** (usato solo per lo sviluppo locale, per decisione presa — nessun Docker/Postgres nativo installato in questo ambiente) sia con il Postgres self-hosted che verrà usato in produzione quando il piano infra riprenderà. Nessun codice divergente tra i due ambienti.
- Configurazione via variabile d'ambiente `DATABASE_URL` (file `.env.local`, non committato).
- Migrazioni con `drizzle-kit`; il comando esatto (`push` in sviluppo vs `generate`+`migrate` per uno storico di migration file) viene deciso nel piano di implementazione, non qui.

## Entità

### `users` (stub — non è autenticazione)

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid, PK | |
| `currency` | text, not null, default `'EUR'` | codice valuta ISO 4217, impostazione per-utente scelta in onboarding (vedi nota `CLAUDE.md`); **un'unica valuta per utente**, non per conto/transazione |
| `created_at` | timestamp, not null, default now | |

Placeholder consapevole: quando arriverà better-auth (piano futuro, oggi in pausa insieme all'infra), questa tabella verrà quasi certamente rimodellata per adattarsi allo schema utente richiesto dalla libreria. Serve solo ad avere già ora una FK stabile per le altre tabelle, evitando una migration invasiva su conti/categorie/transazioni quando l'autenticazione arriverà davvero.

### `categories`

Seedate per utente alla creazione dell'utente (non una lista globale condivisa), per lasciare aperta senza friction una futura personalizzazione per-utente.

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid, FK → `users.id`, not null | |
| `name` | text, not null | |
| `type` | enum(`fissa`, `variabile`), not null | usato dal grafico "Fisse vs variabili" in Spese |
| `created_at` | timestamp, not null, default now | |

Seed delle 8 categorie (criterio: ricorrenza/prevedibilità dell'importo mese su mese):
- **fisse**: Affitto, Bollette & casa, Abbonamenti
- **variabili**: Spesa alimentare, Ristoranti, Altro, Svago, Trasporti

### `accounts` (Conti)

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid, FK → `users.id`, not null | |
| `name` | text, not null | |
| `institution` | text, nullable | banca/istituto — nullable per i conti manuali senza banca (es. "Contanti") |
| `type` | text, not null | tipo conto (es. "corrente", "contanti") — testo libero, nessuna tassonomia fissa emersa dal mockup |
| `balance` | numeric(12,2), not null, default 0 | |
| `source` | enum(`manuale`, `auto`), not null, default `manuale` | i conti "auto" saranno di sola lettura salvo "scollega" a livello applicativo — vincolo enforcement nel piano di implementazione, non nello schema |
| `created_at` / `updated_at` | timestamp, not null | |

### `transactions`

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid, FK → `users.id`, not null | |
| `account_id` | uuid, FK → `accounts.id`, not null | |
| `category_id` | uuid, FK → `categories.id`, not null | |
| `description` | text, not null | |
| `amount` | numeric(12,2), not null | **con segno**: negativo = uscita, positivo = entrata (generalizzato fin da ora per evitare una migration quando arriverà Cash flow) |
| `excluded_amount` | numeric(12,2), not null, default 0 | quota esclusa dal conteggio (meccanismo "Dividi"), stesso segno di `amount`; vincolo `|excluded_amount| ≤ |amount|` |
| `date` | date, not null | |
| `source` | enum(`manuale`, `auto`), not null, default `manuale` | |
| `created_at` / `updated_at` | timestamp, not null | |

Indice su `(user_id, date)` per le query per periodo (KPI di Spese: settimana/mese/3 mesi/anno).

### `budgets`

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid, FK → `users.id`, not null | |
| `category_id` | uuid, FK → `categories.id`, not null | |
| `monthly_amount` | numeric(12,2), not null | |
| `created_at` / `updated_at` | timestamp, not null | |

Vincolo di unicità su `(user_id, category_id)`: un solo budget *corrente* per categoria, nessuna storicizzazione per mese (nessun "budget di gennaio" diverso da "budget di febbraio" salvato nel tempo). "Budget rimanente" in Spese = somma dei `monthly_amount` meno lo speso del periodo corrente.

## Fuori scope e futuro (tracciato esplicitamente, vedi anche `CLAUDE.md`)

**Cosa stiamo facendo ora**: questo spec + il piano di implementazione che seguirà producono solo lo schema dati (Drizzle + migration + seed), nessuna UI, nessuna API, nessuna autenticazione vera.

**Cosa saltiamo consapevolmente in questo spec, e perché**:
- **Storicizzazione del budget per mese**: nessuna richiesta esplicita in `functional-spec.md`; si aggiunge un'entità/colonna dedicata se e quando servirà davvero confrontare budget di mesi diversi.
- **Categorie personalizzabili dall'utente** (rinominare/aggiungerne): nessuna evidenza che serva oggi; la seed per-utente lascia comunque la porta aperta.
- **Multi-valuta per conto/transazione**: la valuta è un'unica impostazione per utente (onboarding), non per riga; se in futuro servirà un conto in valuta estera sarà un'estensione esplicita.
- **Autenticazione vera** (tabella `users` è uno stub): rimandata al piano infra/auth, oggi in pausa. [completato in 2026-07-04 auth plan]
- **Enforcement lato DB del vincolo `|excluded_amount| ≤ |amount|`**: nello schema resta un vincolo documentato/applicativo per ora; se emergono bug di dati incoerenti si valuterà un CHECK constraint Postgres nel piano di implementazione.

**Cosa è previsto in futuro, e quando tornarci**:
- **Budget mensile → schermata Spese vera**: prossimo spec naturale dopo questo, per costruire la UI che consuma `transactions`/`categories`/`budgets`.
- **Investimenti, Debiti, Pensione, Immobile**: spec di modello dati separati, quando si affronteranno quelle schermate.
- **Scenari di Pianifica e abbonamenti rilevati automaticamente**: dipendono dalle entità sopra e arriveranno dopo.
- **Piano infra (k3s, CI/CD)**: in pausa (vedi `docs/superpowers/plans/2026-07-03-infra-foundation.md`), da riprendere quando ci sarà abbastanza applicazione reale da meritare un deploy in produzione.
- **Autenticazione (better-auth)**: quando riprenderà, quasi certamente richiederà di rimodellare `users` — impatto noto e accettato fin da ora.
