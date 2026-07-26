# Conti: ultimo sync visibile + sync manuale con throttle + feedback esito

Data: 2026-07-26

## Contesto

Richiesta utente: nella schermata Conti, per ogni conto collegato via GoCardless (`source: "auto"`), mostrare quando è avvenuta l'ultima sincronizzazione e poter forzare un sync manuale, rispettando un tetto di **massimo 4 sync al giorno per conto e almeno 4 ore tra un sync e l'altro**. Dopo il sync, mostrare un feedback con quante nuove transazioni sono state trovate, quante categorizzate automaticamente, quante rimaste "Da categorizzare".

Oggi esiste già:
- `bankAccountLinks.lastSyncedAt`/`nextSyncEligibleAt` (colonne presenti ma `lastSyncedAt` mai esposto in UI).
- Uno scheduler cron (`lib/gocardless/scheduler.ts`) che sincronizza ogni conto dovuto ogni 12h, gestendo un rate-limit **reale** GoCardless basato sugli header di risposta (`lib/gocardless/rate-limit.ts`, per endpoint `balances`/`transactions`), diverso concettualmente dal tetto applicativo richiesto qui.
- Nessun bottone di sync manuale in UI (nota già presente in CLAUDE.md).
- Nessuna libreria toast nel progetto.

Decisione chiarita con l'utente in brainstorming: il tetto di 4/giorno + gap minimo 4h è un **budget condiviso** tra lo scheduler automatico e i click manuali (non due contatori separati), per restare allineati al vero limite GoCardless lato sandbox (~4 chiamate/giorno/endpoint/conto, già annotato in CLAUDE.md) evitando di sommare i due canali oltre quota. Il feedback post-sync usa un **toast globale** (libreria `sonner` via shadcn, non ancora presente nel progetto).

## Throttle applicativo (budget condiviso)

Nuova colonna su `bank_account_links`:

```ts
syncTimestamps: jsonb("sync_timestamps").notNull().default('[]'), // array di stringhe ISO, max 4 elementi, più recente per primo
```

`lastSyncedAt`/`nextSyncEligibleAt` restano (quest'ultimo ridotto da 12h a 4h come gap minimo, usato come filtro cheap lato query dallo scheduler — vedi sotto).

Nuovo modulo puro `lib/gocardless/sync-eligibility.ts`:

```ts
export const MAX_SYNCS_PER_DAY = 4;
export const MIN_SYNC_GAP_MS = 4 * 60 * 60 * 1000;
export const SYNC_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface SyncEligibility {
  eligible: boolean;
  syncsUsedToday: number;
  syncsRemainingToday: number;
  nextEligibleAt: Date | null; // null se eligible === true
}

export function computeSyncEligibility(recentSyncTimestamps: Date[], now: Date): SyncEligibility
```

Logica:
1. `recentInWindow` = timestamp con `now - t < SYNC_WINDOW_MS`, ordinati crescenti.
2. `syncsUsedToday = recentInWindow.length`; `syncsRemainingToday = max(0, MAX_SYNCS_PER_DAY - syncsUsedToday)`.
3. `lastSync` = il più recente di tutti i timestamp passati (anche fuori finestra, per il gap minimo — irrilevante in pratica perché fuori da 24h supera sempre il gap di 4h).
4. `minGapOk = !lastSync || now - lastSync >= MIN_SYNC_GAP_MS`.
5. `capOk = syncsUsedToday < MAX_SYNCS_PER_DAY`.
6. `eligible = minGapOk && capOk`.
7. `nextEligibleAt`: se `!minGapOk` → `lastSync + MIN_SYNC_GAP_MS`; altrimenti se `!capOk` → `recentInWindow[0] + SYNC_WINDOW_MS` (il più vecchio dei 4 esce dalla finestra); altrimenti `null`.

Finestra scorrevole reale (non un contatore con reset a intervalli fissi): con al massimo 4 elementi conservati, filtrare per età ad ogni check è sufficiente e preciso.

Lo scheduler automatico (cron ogni 12h, invariato) e l'endpoint di sync manuale (sotto) chiamano entrambi questa funzione prima di tentare un sync reale, condividendo lo stesso array `syncTimestamps` per conto — nessuna distinzione tra "budget automatico" e "budget manuale".

## `syncAccountLink` — risultato esteso

`lib/gocardless/sync.ts`, `syncAccountLink` ritorna (invece di `void`) un risultato discriminato:

```ts
export type SyncResult =
  | { status: "synced"; newTransactionsCount: number; categorizedCount: number; uncategorizedCount: number; balanceUpdated: true }
  | { status: "gocardless-limited" } // rate-limit reale GoCardless (header-based), check esistente
  | { status: "expired" };           // 401, comportamento esistente invariato
```

Cambiamenti interni:
- I due check `isRateLimited` esistenti, se true, ritornano `{ status: "gocardless-limited" }` invece di `return;` silenzioso.
- L'insert transazioni usa `.returning()` sull'`onConflictDoNothing`: solo le righe realmente inserite contano come "nuove". Per ciascuna riga inserita, confronta il suo `categoryId` con `fallbackId` (già risolto una volta per lo user tramite `getFallbackCategoryId`, riusato nel loop invece di richiamare `resolveCategoryId` due volte) per incrementare `categorizedCount` o `uncategorizedCount`.
- Al successo, un solo update su `bankAccountLinks`: `lastSyncedAt = now`, `syncTimestamps` = `[now, ...precedenti].slice(0, 4)` (ISO strings), `nextSyncEligibleAt = now + MIN_SYNC_GAP_MS`.
- Comportamento 401 (marca `bankConnections.status = "expired"`) invariato, solo il return value cambia da `void` a `{ status: "expired" }`.

`runDueSyncs` (scheduler) ignora il valore di ritorno (comportamento attuale già logga solo eccezioni non catturate); aggiunge però, prima di chiamare `syncAccountLink` per ciascun link dovuto, un check `computeSyncEligibility(link.syncTimestamps, now).eligible` e salta silenziosamente (stesso pattern di skip già esistente per il rate-limit reale) se il budget condiviso è già esaurito da sync manuali precedenti nello stesso giorno. `findDueLinks` estende la `select` per includere `syncTimestamps`.

## Endpoint manuale

Nuovo `app/api/gocardless/accounts/[accountId]/sync/route.ts`:

```
POST /api/gocardless/accounts/[accountId]/sync
```

- Auth check (come gli altri endpoint gocardless).
- Fetch del link joinando `bankAccountLinks` + `bankConnections` filtrando `accountId = params.accountId AND bankConnections.userId = session.user.id AND bankConnections.status = "linked"` (ownership + stato, pattern IDOR-safe già usato altrove in questo modulo). Non trovato → 404.
- `computeSyncEligibility(link.syncTimestamps, now)`: se `!eligible` → 429 `{ error: "not-eligible", nextEligibleAt, syncsRemainingToday }`, **nessuna chiamata a `syncAccountLink`** (evita di sprecare quota GoCardless reale per un tentativo che sappiamo già bloccato).
- Altrimenti chiama `syncAccountLink(link, redisRateLimitStore)` e mappa il risultato:
  - `synced` → 200 `{ status: "synced", newTransactionsCount, categorizedCount, uncategorizedCount }`
  - `gocardless-limited` → 429 `{ status: "gocardless-limited" }`
  - `expired` → 409 `{ status: "expired" }`

`GET /api/gocardless/connections` (status esistente, `app/api/gocardless/connections/route.ts`) esteso: la select include anche `lastSyncedAt`/`syncTimestamps` dal link, e la response calcola `computeSyncEligibility` per riga. Nuova forma:

```ts
export interface BankConnectionStatus {
  accountId: string;
  status: "pending" | "linked" | "expired" | "error";
  lastSyncedAt: string | null;
  eligible: boolean;
  nextEligibleAt: string | null;
  syncsRemainingToday: number;
}
```

Estensione additiva: i consumatori esistenti (`reconnectAccountIds` in `ContiPage`, filtrati per `status`) restano invariati.

## UI

**Toast**: aggiunta `sonner` via shadcn (`pnpm dlx shadcn@latest add sonner`, genera `components/ui/sonner.tsx` già theme-aware su `next-themes`); `<Toaster />` montato in `app/layout.tsx` dentro `<body>`, accanto a `ThemeProvider`.

**`formatRelativeTime`** (nuovo, puro, in `lib/format.ts`): `(date: Date, now?: Date) => string` — "adesso" (<1 min), "X min fa" (<60 min), "X h fa" (<24h), "X giorni fa" (<7 giorni), altrimenti data assoluta breve (es. "12 lug").

**`AccountRow`** (`components/domain/accounts/account-row.tsx`): nuova prop opzionale `syncInfo?: { lastSyncedAt: string | null; eligible: boolean; nextEligibleAt: string | null; syncsRemainingToday: number }`, popolata solo per righe `isAuto`. Aggiunge:
- Testo muted "Ultimo sync: {formatRelativeTime(...)}" (o "Mai sincronizzato" se `lastSyncedAt` è null) vicino al badge Auto.
- Bottone icona `RefreshCw` (icona già importata nel file) per avviare il sync manuale via `useSyncAccountMutation(account.id)`. Disabilitato quando `!eligible`, con attributo nativo `title` che spiega il motivo ("Prossimo sync disponibile alle HH:MM" se gap minimo, "Limite di 4 sync al giorno raggiunto, prossimo alle HH:MM" se tetto giornaliero) — nessuna nuova dipendenza Tooltip, il `title` del browser basta per questo caso d'uso.
- Durante la mutation, icona in stato "spinning" (classe `animate-spin`, pattern comune con lucide-react), bottone disabilitato.

**`ContiPage`**: estende la mappa già costruita da `connectionStatuses` per includere anche i campi di sync, passando `syncInfo` per `accountId` a ogni `AccountRow`.

**Mutation** (`lib/queries/gocardless.ts`), `useSyncAccountMutation`:

```ts
export function useSyncAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      const response = await fetch(`/api/gocardless/accounts/${accountId}/sync`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new SyncNotAvailableError(body); // include status/nextEligibleAt
      return body as SyncSuccessResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["gocardless", "connections", "status"] });
      toast.success(buildSyncSummaryMessage(result));
    },
    onError: (error: SyncNotAvailableError) => {
      toast.error(buildSyncErrorMessage(error));
    },
  });
}
```

`buildSyncSummaryMessage`/`buildSyncErrorMessage`: funzioni pure (testabili), es.:
- `{newTransactionsCount: 0}` → "Nessuna nuova transazione trovata. Saldo aggiornato."
- `{newTransactionsCount: 5, categorizedCount: 3, uncategorizedCount: 2}` → "5 nuove transazioni (3 categorizzate, 2 da categorizzare). Saldo aggiornato."
- `gocardless-limited` → "La banca ha temporaneamente esaurito le chiamate disponibili. Riprova più tardi."
- `expired` → "Sessione con la banca scaduta. Riconnetti il conto per sincronizzare."
- `not-eligible` (429 pre-check) → "Hai raggiunto il limite di sync per ora. Prossimo disponibile alle {ora}."

## Migrazione

Nuova colonna `sync_timestamps` va applicata con `pnpm db:push` **dall'utente** (non da un agente — DB locale condiviso con `main`, convenzione già stabilita in CLAUDE.md per le colonne precedenti su `categories`).

## Edge case

- Conto appena collegato, mai sincronizzato: `lastSyncedAt` null → "Mai sincronizzato", `syncTimestamps` vuoto → sempre eleggibile (nessun gap/tetto da rispettare).
- Sync manuale mentre lo scheduler ha appena consumato l'ultimo slot del giorno: bottone disabilitato lato UI (stato calcolato da `GET /api/gocardless/connections`), e comunque ri-verificato server-side nell'endpoint di sync (non ci si fida solo del client).
- Connessione con più conti collegati (`bankConnections` 1-N `bankAccountLinks`): il budget è per **conto** (`bankAccountLinks.syncTimestamps`), non per connessione — sincronizzare un conto non consuma budget degli altri conti sulla stessa banca.
- Sync che fallisce a metà (es. balance ok, poi errore rete sulle transazioni): nessuna transazione DB atomica introdotta, comportamento best-effort riga-per-riga invariato rispetto a oggi; in questo caso l'eccezione propaga (non è né `synced` né uno stato gestito), l'endpoint la lascia risalire come 500 generico e il toast d'errore userà un messaggio di fallback.

## Test

- `lib/gocardless/sync-eligibility.test.ts` (nuovo): boundary gap 4h (appena sotto/sopra), boundary tetto 4/24h (il quinto tentativo entro 24h dal più vecchio dei 4 blocca, esce dalla finestra dopo 24h dal più vecchio), array vuoto → sempre eligible, `nextEligibleAt` corretto in entrambi i casi di blocco.
- `lib/gocardless/sync.test.ts` (esteso): asserzioni sul risultato discriminato (`newTransactionsCount`/`categorizedCount`/`uncategorizedCount` su un mix di transazioni nuove/duplicate/categorizzabili-per-storico/fallback) e sui campi aggiornati (`syncTimestamps` contiene il nuovo timestamp, `nextSyncEligibleAt` spostato di 4h).
- Nuovo `app/api/gocardless/accounts/[accountId]/sync/route.test.ts`: ownership (conto di un altro utente → 404), 429 quando non eleggibile (nessuna chiamata a `syncAccountLink`/GoCardless), mapping corretto status→HTTP.
- `lib/format.test.ts` (esteso o nuovo): `formatRelativeTime` per le soglie min/ore/giorni/fallback data assoluta.
- `buildSyncSummaryMessage`/`buildSyncErrorMessage`: test puri per ogni combinazione di stato.
- Componenti UI (`AccountRow`, `ContiPage`) non testati a unit, in linea con la convenzione già seguita nel progetto — verifica manuale utente (nessun Postgres/Redis nel sandbox agentico).

## Fuori scope (esplicitamente escluso)

- Sync manuale per connessioni con più conti in un solo click ("sincronizza tutti") — richiesta esplicitamente per singolo conto.
- Storico/log delle sincronizzazioni passate oltre l'ultimo timestamp mostrato — solo "ultimo sync" e conteggio residuo di oggi, nessuna cronologia dettagliata.
- Modifica della cadenza dello scheduler automatico (resta cron ogni 12h) — solo il gap minimo e il tetto condiviso cambiano.
- Retry automatico o backoff intelligente sul rate-limit reale GoCardless — comportamento già esistente (skip silenzioso lato scheduler, messaggio d'errore lato manuale) non viene ampliato.
