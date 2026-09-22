# Import/sync GoCardless veloce con avanzamento visibile (job in background)

Data: 2026-09-22
Sostituisce: `2026-09-10-gocardless-sync-performance-design.md` (mai implementata, superata dalla categorizzazione a regole).
Primo caso d'uso dello standard "Operazioni lunghe" di `CLAUDE.md` (sezione Principi di architettura).

## Problema

1. Confermando i "Conti trovati" (`app/(app)/conti/collega/[connectionId]/page.tsx`) l'import delle transazioni è lentissimo e l'utente resta davanti a un bottone disabilitato senza sapere cosa succede.
2. Anche il sync manuale di un conto (bottone in `AccountRow`) è lentissimo, con il solo feedback di un'icona che gira.

L'utente vuole un avanzamento **reale e granulare** ("Importati 120 di 500 movimenti") che **resti visibile cambiando pagina**.

## Causa (dal codice)

- `syncAccountLink` (`lib/gocardless/sync.ts`) esegue **un `INSERT` per transazione, in sequenza**: N movimenti = N round-trip verso Postgres (Neon, remoto rispetto alla funzione).
- `POST /api/gocardless/connections/[id]/finalize` sincronizza i conti selezionati **uno dopo l'altro** dentro la richiesta HTTP.
- Ogni chiamata GoCardless rilegge il token dal DB (`getAccessToken`).
- `flushRuleHits` fa un `UPDATE` per regola in sequenza (impatto minore).
- **Non ottimizzabile**: la latenza delle API GoCardless (saldo + transazioni), che su banche reali può durare secondi per conto.

La categorizzazione è già in memoria (`buildRuleResolver`) e non va toccata.

## Vincolo di deploy

L'app gira oggi su **Vercel + Neon** (serverless) e ci resterà per un po'; in futuro forse su VPS con Node persistente. La soluzione deve funzionare in entrambi i casi: niente processi in memoria di lunga durata, niente infrastruttura solo-Vercel.

## Approcci valutati

- **Scelto — `after()` + stato su Redis + polling.** La route crea un job, risponde con `{ jobId }` e lavora in `after()` (`next/server`) fino a `maxDuration`. Funziona su Vercel e su Node persistente.
- Scartato — Vercel Workflow/Queues: più robusto, ma lock-in Vercel e sproporzionato per un lavoro di secondi.
- Scartato — il client guida il lavoro a blocchi: sopravvive solo finché la tab resta aperta, sposta logica sul client.
- Scartato — streaming della risposta: si perde cambiando pagina.

Stato su **Redis** (già usato per il rate limit) e non Postgres: stato effimero con TTL, nessuna migrazione (evita anche il blocco noto di `db:push` su `transactions_account_external_id_unique`).

## Design

### 1. Modello del job (`lib/sync-jobs/`)

```ts
export type SyncJobKind = "initial-import" | "manual-sync";
export type SyncJobStatus = "running" | "done" | "failed";
export type SyncAccountPhase =
  | "queued" | "balance" | "fetching" | "saving"
  | "done" | "limited" | "expired" | "error";

export interface SyncJobAccount {
  accountId: string;
  name: string;
  phase: SyncAccountPhase;
  total: number | null;      // noto solo dopo lo scarico da GoCardless
  processed: number;         // righe elaborate (inserite + già presenti)
  inserted: number;          // righe nuove
  categorized: number;
  uncategorized: number;
}

export interface SyncJob {
  id: string;
  userId: string;
  kind: SyncJobKind;
  status: SyncJobStatus;
  dismissed: boolean;
  startedAt: string;         // ISO
  updatedAt: string;         // ISO, heartbeat
  accounts: SyncJobAccount[];
}
```

**Store** (`lib/sync-jobs/store.ts`) dietro un'interfaccia minima `SyncJobStore` (come `RateLimitStore`), con adapter Redis (`redis-sync-job-store.ts`) e fake in memoria per i test:

- chiave job: `sync-job:{userId}:{jobId}` (JSON, TTL 24h, rinnovato a ogni update);
- indice: `sync-jobs:{userId}` (set dei jobId, stesso TTL);
- lock per conto: `sync-lock:{accountId}` via `SET NX EX`, TTL = `maxDuration` + 60s.

Operazioni: `createJob`, `setAccounts(jobId, accounts)`, `updateAccount(jobId, accountId, patch)` (aggiorna anche `updatedAt` e ricalcola `status`), `listJobs(userId)`, `dismissJob(userId, jobId)`, `acquireAccountLock(accountId)`, `releaseAccountLock(accountId)`.

`status` si deriva dagli account: `running` finché almeno un conto non è in fase finale (`done`/`limited`/`expired`/`error`); poi `failed` se **tutti** sono `error`, altrimenti `done`.

**Funzioni pure** (`lib/sync-jobs/view.ts`):
- `toJobView(job, now)`: se `status === "running"` e `now - updatedAt > SYNC_JOB_STALE_MS` (60s), restituisce il job come interrotto (`interrupted: true`, conti non finali in fase `error`);
- `overallProgress(job)`: `{ determinate: true, processed, total }` solo quando tutti i conti hanno `total !== null`, altrimenti `{ determinate: false }`.

### 2. `syncAccountLink` (`lib/gocardless/sync.ts`)

Firma estesa, retrocompatibile:

```ts
export interface SyncProgress {
  phase: "balance" | "fetching" | "saving";
  total?: number;
  processed?: number;
  inserted?: number;
  categorized?: number;
  uncategorized?: number;
}

export async function syncAccountLink(
  link: SyncableLink,
  rateLimitStore: RateLimitStore,
  onProgress?: (progress: SyncProgress) => Promise<void> | void
): Promise<SyncResult>
```

- Emette `balance` prima della chiamata saldo e `fetching` prima della chiamata transazioni.
- Risolve categoria/split in memoria per tutte le transazioni (invariato), poi inserisce a **blocchi da `SYNC_INSERT_CHUNK_SIZE = 50`**:
  ```ts
  db.insert(transactions).values(chunk)
    .onConflictDoNothing({ target: [transactions.accountId, transactions.externalId] })
    .returning({ externalId: transactions.externalId, categoryId: transactions.categoryId })
  ```
- I contatori si calcolano dalle righe restituite. `recordHit(ruleId)` solo per gli `externalId` restituiti (righe davvero inserite), tramite una mappa `externalId → ruleId` costruita in fase di risoluzione.
- Dopo ogni blocco emette `saving` con `total`, `processed` (cumulativo), `inserted`, `categorized`, `uncategorized`.
- Un errore di `onProgress` viene loggato e ignorato: non interrompe mai il sync.
- `SyncResult` invariato. Lo scheduler (`lib/gocardless/scheduler.ts`) continua a chiamarla senza callback.

**Token GoCardless**: cache in memoria di modulo in `client.ts` (valore + scadenza), consultata prima della query DB. È valida per la vita dell'istanza; la cache DB resta la fonte condivisa.

**`flushRuleHits`**: gli update per regola vengono eseguiti con `Promise.all` invece che in sequenza.

### 3. Orchestratore (`lib/sync-jobs/run.ts`)

```ts
export async function runSyncJob(job: SyncJob, links: SyncableLink[], deps): Promise<void>
```

Per ogni conto, **in parallelo** (`Promise.allSettled`):
1. `syncAccountLink(link, rateLimitStore, (p) => store.updateAccount(job.id, link.accountId, mapProgress(p)))`;
2. mappa l'esito: `synced` → `done` con i conteggi finali, `gocardless-limited` → `limited`, `expired` → `expired`, eccezione → `error` (loggata);
3. rilascia il lock del conto in un `finally`.

### 4. Route

Entrambe esportano `export const maxDuration = 300`.

**`POST /api/gocardless/connections/[id]/finalize`**, nell'ordine:
1. sessione, ownership della connessione, validazione Zod, ownership degli account `existing` (invariati);
2. `createJob` su Redis con `accounts: []` — **se Redis fallisce, 503 prima di creare qualunque conto**;
3. creazione/aggiornamento di account e link (invariata), poi `setAccounts(jobId, …)` con gli `accountId` reali in fase `queued` (se questa scrittura fallisce: log e si prosegue, il sync parte comunque e il job verrà visto come interrotto — i dati restano corretti);
4. acquisizione dei lock (un conto già in sync, possibile solo per un `existing`, va direttamente in `error` con messaggio "già in corso");
5. `after(() => runSyncJob(...))`;
6. risposta `201 { jobId }`.

**`POST /api/gocardless/accounts/[accountId]/sync`**:
1. sessione, ownership, eleggibilità (invariati; 404/429 come oggi);
2. `acquireAccountLock` — se occupato, **409 `{ status: "already-running" }`**;
3. `createJob` (503 se Redis fallisce, con rilascio del lock);
4. `after(() => runSyncJob(...))`;
5. risposta `202 { jobId }`.

**`GET /api/sync-jobs`**: job dell'utente in sessione non `dismissed`, già passati per `toJobView`.

**`POST /api/sync-jobs/[id]/dismiss`**: segna `dismissed` solo se la chiave `sync-job:{userId}:{id}` esiste per l'utente in sessione (404 altrimenti). Nessun job di altri utenti è mai leggibile né modificabile.

### 5. Client (`lib/queries/sync-jobs.ts`)

- `useSyncJobsQuery()`: fetch al mount, `refetchInterval: 1000` solo mentre esiste almeno un job `running`, altrimenti `false`.
- Quando un job passa da `running` a stato finale: invalida `accounts`, `transactions`, `bank-connections` (e le query derivate già invalidate oggi dal sync manuale).
- `useDismissSyncJobMutation()`.
- `useFinalizeConnectionMutation` e `useSyncAccountMutation` invalidano `sync-jobs` all'`onSuccess`. Il toast di successo del sync manuale viene **rimosso** (il feedback è nel pannello). Restano i toast per gli errori sincroni: `not-eligible`, `already-running` ("Sincronizzazione già in corso"), 503, `unknown`.

### 6. UI (`components/domain/sync/`)

**`SyncProgressPanel`**, montato in `app/(app)/layout.tsx` accanto ad `AppShell` (il layout resta agnostico dal dominio). Visibile se esiste almeno un job non `dismissed`. Pannello flottante in basso a destra su desktop, a tutta larghezza in basso su mobile.

- **Compatto:** "Sincronizzazione · N conti" (o "Sincronizzazione completata") + barra complessiva (`overallProgress`).
- **Espanso** (click/Enter): una `SyncAccountProgressRow` per conto.

Testi per fase (funzione pura `describeAccountProgress`, costanti nominate):

| Fase | Testo | Barra |
|---|---|---|
| queued | In attesa | nessuna |
| balance | Aggiorno il saldo… | indeterminata |
| fetching | Scarico i movimenti dalla banca… | indeterminata |
| saving | Importati {processed} di {total} movimenti | determinata |
| done | {inserted} nuovi · {categorized} categorizzati · {uncategorized} da categorizzare (oppure "Nessun movimento nuovo. Saldo aggiornato.") | piena |
| limited / expired | messaggi esistenti di `sync-messages.ts` | nessuna |
| error | "Sincronizzazione non riuscita. Riprova più tardi." (o il messaggio "interrotta" se `interrupted`) | nessuna |

- Se `uncategorized > 0` a fine job: link "Categorizza" verso `/categorizza`.
- Bottone chiudi (X) visibile solo a job concluso → `dismiss`.
- Singolare/plurale corretti (riuso di `pluralize`).
- Accessibilità: `role="progressbar"` con `aria-valuenow/min/max` sulle barre determinate, `aria-busy` su quelle indeterminate, riepilogo finale in `aria-live="polite"`, animazioni della barra indeterminata dietro `motion-safe:`.
- Colori solo da token tema.

**Pagina "Conti trovati"**: durante il pending "Conferma" diventa "Avvio…". All'`onSuccess` porta a `/conti` come oggi (ora immediato).

**`AccountRow`**: l'icona sync gira ed è disabilitata se quel `accountId` compare in un job `running` (derivato da `useSyncJobsQuery`, non da `syncMutation.isPending`), con `title` "Sincronizzazione in corso".

## Cosa NON cambia

- Logica di categorizzazione a regole, guard di direzione, split.
- Schema Postgres.
- Idempotenza dell'import (vincolo unique `(accountId, externalId)`).
- Budget di sync condiviso 4/giorno + gap 4h (`computeSyncEligibility`) e aggiornamento di `syncTimestamps` a fine sync riuscito.
- Scheduler cron (nessuna modifica funzionale).

## Fuori scope (debito annotato in CLAUDE.md)

- Su Vercel lo scheduler `node-cron` di `instrumentation.ts` non gira: sync automatici ogni 12h e snapshot patrimonio non partono. Migrazione a Vercel Cron in sessione dedicata.
- Riprendere automaticamente un job interrotto (oggi: messaggio, poi il sync successivo riprende grazie all'idempotenza).

## Test (vitest)

- `lib/gocardless/sync.test.ts`: 120 transazioni → 3 blocchi, conteggi corretti; seconda esecuzione → 0 nuove (idempotenza); sequenza `onProgress` (`balance`, `fetching`, `saving` con `processed` 50/100/120); `hitCount` incrementato solo per righe inserite; eccezione in `onProgress` non interrompe il sync; chiamata senza callback invariata.
- `lib/sync-jobs/store.test.ts` (fake in memoria): create/update/list/dismiss, derivazione `status`, lock acquisito/negato/rilasciato, isolamento tra utenti.
- `lib/sync-jobs/view.test.ts`: stallo oltre 60s → interrotto; `overallProgress` determinato solo con tutti i `total`.
- `lib/sync-jobs/run.test.ts`: conti in parallelo, un conto in errore non blocca gli altri, lock sempre rilasciato, mapping degli esiti.
- `components/domain/sync/describe-account-progress.test.ts`: testi per fase, plurali.
- Route (`after()` mockato per eseguire subito): finalize → `201 { jobId }`, 503 con Redis giù e nessun conto creato; sync → `202 { jobId }`, 409 con lock occupato; `GET /api/sync-jobs` non restituisce job di altri utenti; dismiss di un job altrui → 404.

## Verifica manuale utente (niente browser/Postgres reale nel sandbox)

- Su Vercel: collegare una banca sandbox con più conti, confermare, cambiare pagina durante il sync: il pannello resta e il contatore avanza.
- Riepilogo finale corretto, link "Categorizza", chiusura persistente dopo refresh.
- Sync manuale: doppio click / seconda tab → "già in corso"; icona che gira anche se il sync è partito altrove.
- Saldi e liste aggiornati da soli a fine job.
- Tempo di import prima/dopo su un conto con molti movimenti.
