# Ottimizzazione performance sync GoCardless (import conti trovati + sync manuale)

Data: 2026-09-10

## Problema

L'utente segnala che:
1. Selezionando i "Conti Trovati" (finalizzazione collegamento banca), l'import delle transazioni è lentissimo.
2. Anche la sincronizzazione manuale di un singolo conto (bottone "Sincronizza ora" in Conti) è lentissima.
3. Su Vercel, il sync spesso non funziona affatto ("non riesco a sincronizzare nulla").

## Causa radice (investigazione `superpowers:systematic-debugging`)

In `lib/gocardless/sync.ts`, `syncAccountLink` importa le transazioni scaricate da GoCardless con un `for...await` **sequenziale**, ed esegue **3 query DB per ogni singola transazione**:

1. `resolveCategoryId` (`lib/gocardless/categorize.ts:41`) richiama `getFallbackCategoryId` — **query ripetuta** anche se `syncAccountLink` ha già recuperato lo stesso valore una volta prima del loop (riga 70).
2. `matchCategoryId` — un `SELECT` con `ILIKE` sulla tabella `transactions` per trovare l'ultima transazione con descrizione simile.
3. Un `INSERT` singolo per riga (con `onConflictDoNothing` per l'idempotenza).

Per un import iniziale con centinaia di transazioni storiche, questo significa centinaia × 3 round-trip DB eseguiti **uno alla volta**, mai in batch né in parallelo.

Aggravante in `app/api/gocardless/connections/[id]/finalize/route.ts` (righe 90-96): se l'utente seleziona più conti nella schermata "Conti trovati" (`app/(app)/conti/collega/[connectionId]/page.tsx`), anche i conti stessi vengono sincronizzati **sequenzialmente** tra loro (altro `for...await`), moltiplicando linearmente il tempo totale.

Su Vercel l'effetto è amplificato: il Postgres è self-hosted su cluster k3s (non un DB Marketplace Vercel poolato/co-locato), quindi ogni round-trip serverless↔DB paga latenza di rete piena. Centinaia di round-trip sequenziali possono superare il timeout della funzione, causando il sintomo "non sincronizza nulla" invece di un semplice ritardo.

**Fuori scope di questo piano**: se dopo il fix i sync su Vercel restano completamente non funzionanti (non solo più lenti), è probabile un problema di connettività/firewall Vercel↔Postgres self-hosted separato dalla performance delle query — da investigare a parte controllando i log Vercel (non ancora fatto dall'utente al momento di questo spec).

## Cosa NON cambia

- La logica di matching categoria: resta "ultima transazione con descrizione simile (case-insensitive), altrimenti categoria fallback" — cambia solo *dove* viene calcolata (in memoria invece che a query per transazione).
- Lo schema del database.
- Il comportamento visibile all'utente sulla categorizzazione delle transazioni importate.
- La semantica di idempotenza dell'import (nessun duplicato a ogni sync, basata sul vincolo unique `(accountId, externalId)`).
- `resolveCategoryId`/`getFallbackCategoryId`/`matchCategoryId` in `lib/gocardless/categorize.ts` restano invariate come funzioni pubbliche: sono usate anche da `app/api/transactions/categorize-suggestions/route.ts` (wizard "Categorizza automaticamente" in Transazioni), fuori scope qui.

## Design

### 1. Matcher precaricato in memoria (`lib/gocardless/categorize.ts`)

Nuova funzione:

```ts
export interface CategoryMatcher {
  fallbackCategoryId: string;
  match(description: string): string;
}

export async function buildCategoryMatcher(userId: string): Promise<CategoryMatcher>
```

Implementazione:
- Recupera una volta `fallbackCategoryId` (`getFallbackCategoryId`, invariata).
- Recupera in una singola query **tutte** le transazioni dell'utente con categoria diversa dal fallback, selezionando solo `description`, `categoryId`, `date`, ordinate per `date DESC`.
- Costruisce una `Map<string, string>` (chiave: descrizione normalizzata lowercase+trim, valore: `categoryId` della transazione più recente con quella descrizione — la prima incontrata nell'ordine DESC vince, stessa semantica di `ORDER BY date DESC LIMIT 1` esistente).
- `match(description)` normalizza la descrizione in ingresso allo stesso modo e fa un lookup nella Map; ritorna `fallbackCategoryId` se non trovata.

Nota: il matching esistente usa `ilike` (case-insensitive, senza wildcard espliciti quindi equivalente a uguaglianza case-insensitive) — la normalizzazione lowercase+trim in memoria riproduce lo stesso comportamento senza introdurre un fuzzy-match nuovo.

### 2. `syncAccountLink` (`lib/gocardless/sync.ts`)

- Costruisce il matcher una volta (`buildCategoryMatcher(link.userId)`) invece di richiamare `resolveCategoryId` per ogni transazione.
- Nel loop sulle transazioni scaricate, calcola `categoryId = matcher.match(description)` — **zero query per transazione**.
- Sostituisce l'insert singolo con un **insert batch**: costruisce l'array di tutte le righe da inserire (filtrando quelle senza `externalId`, come già oggi), poi un'unica chiamata:

  ```ts
  db.insert(transactions)
    .values(rows)
    .onConflictDoNothing({ target: [transactions.accountId, transactions.externalId] })
    .returning({ categoryId: transactions.categoryId })
  ```

- I contatori (`newTransactionsCount`, `categorizedCount`, `uncategorizedCount`) si calcolano dal risultato ritornato (righe effettivamente inserite, escluse quelle scartate da `onConflictDoNothing`), stessa logica di oggi applicata al risultato batch invece che riga per riga.
- Se `rows` è vuoto (nessuna transazione nuova da GoCardless, o tutte senza `externalId`), si salta l'insert (nessuna chiamata DB inutile).

Risultato: da N×3 query sequenziali a **2 query totali** per il matching+insert (una `SELECT` per il matcher, una `INSERT` batch), indipendentemente dal numero di transazioni.

### 3. Sync multi-conto parallelo (`app/api/gocardless/connections/[id]/finalize/route.ts`)

Il loop finale:
```ts
for (const link of linksToSync) {
  try { await syncAccountLink(link, redisRateLimitStore); }
  catch (error) { console.error(...); }
}
```
diventa:
```ts
await Promise.all(
  linksToSync.map((link) =>
    syncAccountLink(link, redisRateLimitStore).catch((error) => {
      console.error(`Sync iniziale fallito per il conto ${link.accountId}`, error);
    })
  )
);
```
Comportamento invariato (best-effort, un fallimento su un conto non blocca gli altri né la risposta) — cambia solo l'esecuzione da sequenziale a parallela. Sicuro perché il rate-limit GoCardless (`isRateLimited`/`recordRateLimit`) è tracciato per `externalAccountId`, quindi indipendente tra conti diversi.

Lo scheduler cron (`lib/gocardless/scheduler.ts`, `runDueSyncs`) **non viene toccato**: gira ogni 12h in background, non blocca nessuna richiesta utente — la sequenzialità lì non è il problema segnalato. Beneficia comunque indirettamente della velocizzazione di `syncAccountLink` per singolo conto.

### 4. Feedback UI (spinner + testo esplicito)

- **`app/(app)/conti/collega/[connectionId]/page.tsx`**: il bottone "Conferma" (riga 129-131), quando `finalize.isPending`, mostra testo "Sincronizzazione in corso, può richiedere qualche minuto..." invece di "Conferma" invariato con solo `disabled`.
- **`components/domain/accounts/account-row.tsx`**: il bottone di sync manuale (righe 233-244) già mostra uno spinner (`RefreshCw` con `animate-spin` quando `syncMutation.isPending`) ma nessun testo — aggiungere un piccolo testo accanto all'icona (es. tooltip/`title` aggiornato dinamicamente, o una label testuale inline quando pending) con lo stesso messaggio esplicito.

Nessun'altra modifica allo stato/query (niente streaming di progresso conto-per-conto: scartato in fase di brainstorming come complessità non necessaria rispetto al fix di performance, che dovrebbe già ridurre l'attesa da minuti a secondi).

## Testing

- `lib/gocardless/categorize.test.ts`: nuovi test per `buildCategoryMatcher` — matcher ritorna categoria dell'ultima transazione con descrizione uguale (case-insensitive), fallback se nessun match, comportamento invariato rispetto ai test esistenti di `resolveCategoryId`/`matchCategoryId` (che restano, non vengono rimossi).
- `lib/gocardless/sync.test.ts`: aggiornare i test esistenti di `syncAccountLink` per riflettere l'insert batch (stesso comportamento osservabile: conteggi corretti, idempotenza su `externalId` duplicato, categoria assegnata correttamente) + un nuovo test con più transazioni per verificare che il matching in memoria assegni categorie diverse coerentemente all'interno dello stesso batch.
- `app/api/gocardless/connections/[id]/finalize/route.test.ts`: verificare che più conti vengano sincronizzati anche se uno dei due fallisce (comportamento best-effort invariato, ora con `Promise.all`).

## Verifica manuale utente (fuori scope agente, nessun Postgres/browser reale nel sandbox)

- Collegare una banca sandbox con più conti e molte transazioni storiche, misurare il tempo di "Conferma" prima/dopo.
- Sync manuale su un conto con molte transazioni non ancora importate.
- **Su Vercel**: ripetere lo stesso test dopo il deploy. Se il sync torna a funzionare (anche se lento) il fix risolve il problema. Se resta completamente non funzionante, controllare i log Vercel per l'errore esatto (timeout vs connection refused vs altro) — indica un problema di connettività separato da investigare in una sessione dedicata.
