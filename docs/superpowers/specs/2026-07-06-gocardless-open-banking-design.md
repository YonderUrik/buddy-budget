# Open Banking via GoCardless — design

**Data**: 2026-07-06
**Stato**: approvato, in attesa di piano di implementazione

## Contesto

`docs/functional-spec.md` e `CLAUDE.md` marcavano l'integrazione bancaria reale (Open Banking/PSD2) come fuori scope per la fase attuale, rimandata a quando si fosse scelto un provider. Provider scelto ora: **GoCardless Bank Account Data API** (ex Nordigen). Questo spec copre la prima integrazione end-to-end: connessione conto, sync automatico periodico, categorizzazione best-effort delle transazioni importate.

Il modello dati esistente era già predisposto: `accounts.source` e `transactions.source` (enum `data_source`: `manuale`/`auto`), UI dei conti Auto (sola lettura sui campi finanziari, badge, "Scollega") già costruita in `docs/superpowers/specs/2026-07-04-conti-screen-design.md`.

## Vincoli GoCardless rilevanti

- Autenticazione **a livello applicazione**, non per utente: `secret_id`/`secret_key` → `access_token` (valido 24h, refresh fino a 30 giorni). Nessun token utente da salvare/cifrare.
- Consenso utente (End User Agreement + Requisition) ha scadenza configurabile, fino a 90 giorni; scaduto va rinnovato con un nuovo flusso di consenso.
- Endpoint `GET /institutions` richiede parametro `country` — non esiste una ricerca cross-country in un'unica chiamata.
- Rate limit per conto/endpoint esposto negli header di risposta (`remaining`/`reset`), variabile per banca — non un numero fisso documentato univoco.
- Credenziali GoCardless non ancora esistenti: si parte in sandbox; passaggio a produzione è solo un cambio di env var, nessun impatto sul codice.

## Data model

Nuove tabelle (Drizzle, `lib/db/schema/`):

- **`bank_connections`**: `id` (uuid), `userId` (FK `auth_user`), `institutionId` (text, id GoCardless), `institutionName` (text), `requisitionId` (text), `status` (enum: `pending` | `linked` | `expired` | `error`), `consentExpiresAt` (timestamp), `createdAt`, `updatedAt`.
- **`bank_account_links`**: `id` (uuid), `connectionId` (FK `bank_connections`), `accountId` (FK `accounts`, il conto locale con `source: 'auto'`), `externalAccountId` (text, id conto GoCardless), `lastSyncedAt` (timestamp, nullable), `nextSyncEligibleAt` (timestamp, default now).
- **`gocardless_token`**: singola riga di cache per l'access token applicativo — `accessToken` (text), `expiresAt` (timestamp). Refresh automatico via `secret_id`/`secret_key` quando scaduto.

Modifiche a tabelle esistenti:

- **`transactions`**: nuova colonna `externalId` (text, nullable, `unique` insieme a `accountId`) — usata per idempotenza sull'import (dedup ai sync successivi via `ON CONFLICT`).
- **`categories`**: aggiunta `"Da categorizzare"` (type `variabile`) a `DEFAULT_CATEGORIES` — fallback quando il matching automatico non trova nulla. Nessuna modifica di schema.

## Flusso di connessione

1. In "+ Aggiungi conto" (`add-account-form.tsx`): scelta iniziale "Manuale" (form esistente) / "Collega banca" (nuovo flusso).
2. "Collega banca": selezione paese → ricerca/lista istituti in quel paese (`GET /institutions?country=`).
3. Istituto scelto → backend crea una `requisition` GoCardless (redirect URL = nostro callback, `reference` = id della riga `bank_connections` appena creata con `status: pending`) → redirect del browser al link di consenso restituito.
4. Utente autorizza sul sito/app della banca → la banca reindirizza a `/api/gocardless/callback?ref=...`.
5. Il callback recupera la requisition; se `status: linked`, per ogni `accounts` esterno restituito recupera i dettagli (nome, IBAN, tipo) e redirige a una pagina client di selezione.
6. La pagina mostra un checkbox per ogni conto esterno trovato. L'utente seleziona quali importare.
7. Alla conferma: per ogni conto selezionato, crea riga `accounts` (`source: auto`) + riga `bank_account_links`; `bank_connections.status = linked`. Subito dopo lancia un sync iniziale mirato solo su questi conti (storico completo disponibile + saldo corrente).

### Riconnessione (consenso scaduto)

Stesso flusso "Collega banca", ma alla selezione (passo 6) l'utente sceglie "collega a conto esistente" invece di "crea nuovo" — associa il conto esterno restituito a un `accounts.id` locale già presente. Aggiorna `connectionId`, `externalAccountId`, resetta `consentExpiresAt` sulla riga `bank_account_links` esistente. Transazioni e storico già importati restano intatti (nessuna riscrittura).

### Errori nel flusso

- Utente abbandona il consenso senza tornare al callback: nessuna riga creata oltre alla `bank_connections` iniziale (resta `pending`), niente cleanup necessario — stateless, ritentabile liberamente.
- Requisition rifiutata/sospesa dalla banca: `bank_connections.status = 'error'`, toast d'errore, nessun conto creato.
- Banca condivide zero conti: la pagina di selezione mostra stato vuoto.

## Sync engine, rate limiting, scheduler

- **Scheduler**: `node-cron`, avviato in `instrumentation.ts` (hook di boot Next.js), intervallo 12h. Gira in-process nel container Next.js (nessuna risorsa k8s aggiuntiva) — scelta consapevole nonostante il rischio di duplicazione/interruzione se si scala a più repliche, accettabile per ora (namespace `production` a istanza singola).
- **Redis**: prima introduzione reale nel progetto (finora solo pianificata in `docs/superpowers/specs/2026-07-03-tech-stack-architecture-design.md`, mai implementata). Richiede `REDIS_URL` + client `ioredis`. Usata per tracciare `remaining`/`reset` del rate limit per `externalAccountId` dopo ogni chiamata GoCardless.
- **Ogni tick**:
  1. Seleziona `bank_account_links` con `nextSyncEligibleAt <= now()` e connessione non `expired`/`error`.
  2. Per ciascuno: garantisce un `access_token` GoCardless valido (cache `gocardless_token`, refresh se scaduto).
  3. Controlla il contatore Redis per quel conto; se `remaining = 0` salta fino al `reset` salvato.
  4. `GET /accounts/{id}/balances` → aggiorna `accounts.balance`.
  5. `GET /accounts/{id}/transactions` → upsert in `transactions` via `externalId` (idempotente).
  6. Categorizzazione best-effort: cerca l'ultima transazione dell'utente con stessa `description` (case-insensitive) che abbia già una categoria diversa da `"Da categorizzare"` → riusa quella categoria; altrimenti assegna `"Da categorizzare"`.
  7. Aggiorna `lastSyncedAt = now()`, `nextSyncEligibleAt = now() + 12h`.
- **Errore 401 / consenso scaduto**: `bank_connections.status = 'expired'`, badge "Riconnetti" lato UI (vedi sotto), nessun retry automatico finché l'utente non riconnette.
- **Errore 5xx/rete GoCardless**: log, nessun retry immediato — si ritenta al tick successivo (12h).
- **Fuori scope, deciso consapevolmente**: nessun bottone "Aggiorna ora" manuale in fase 1 (apre un secondo path di rate-limit da gestire, non richiesto) — riattivabile in una fase futura.

## UI

- `add-account-form.tsx`: step iniziale "Manuale" / "Collega banca".
- Nuovo flusso "Collega banca": selezione paese → ricerca istituto → redirect consenso → (dopo callback) selezione conti esterni via checkbox, o dropdown "collega a conto esistente" in caso di riconnessione.
- `account-row.tsx`: badge "Riconnetti" quando la connessione associata ha `status: expired`; bottone che riapre il flusso di consenso scoped a quel conto.
- Icona/colore dei conti Auto creati da GoCardless: nessun fetch/uso dei loghi istituto (scope aggiuntivo non richiesto) — icona di default generica (`landmark`), personalizzabile dall'utente come già previsto per i conti Auto (`account-icon-color-picker.tsx`, invariato).

## Testing

- **Unit**: matching categoria (match trovato / fallback `"Da categorizzare"`), calcolo `nextSyncEligibleAt`, logica chiave rate-limit Redis (formato chiave, TTL, lettura `remaining`/`reset`).
- **Integration**: CRUD e scoping per utente di `bank_connections`/`bank_account_links` (stesso pattern di `lib/db/integration.test.ts` già in uso per `accounts`), route di callback con client GoCardless mockato, idempotenza upsert transazioni (sync ripetuto sullo stesso `externalId` non duplica righe).
- Nessuna chiamata reale a GoCardless nei test automatici — mock a livello HTTP. Le credenziali sandbox (da creare) servono solo per verifica manuale end-to-end.

## Scope esplicitamente escluso (per ora)

- Bottone di sync manuale "Aggiorna ora" (vedi sopra).
- Notifiche email di scadenza consenso (solo badge in UI per ora; Resend è già configurato per auth, riutilizzabile in futuro).
- Loghi istituto nella UI.
- Retry automatico/backoff sofisticato sugli errori 5xx (si riprova al tick successivo, punto).
- Multi-replica del processo Next.js: lo scheduler in-process assume istanza singola; se in futuro si scala orizzontalmente, lo scheduling andrà spostato a un CronJob k8s esterno (opzione valutata e scartata per ora in favore della semplicità di deploy).

## Domande aperte

Nessuna: tutte le decisioni di questa fase sono state prese durante il brainstorming (vedi sezioni sopra). Credenziali GoCardless (sandbox) da creare fuori da questo repo prima di poter testare end-to-end manualmente.
