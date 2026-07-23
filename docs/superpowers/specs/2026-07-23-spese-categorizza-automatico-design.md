# Categorizza automaticamente — Spese

## Problema

Le transazioni "Da categorizzare" spesso ripetono descrizioni già categorizzate manualmente in passato (stesso merchant/causale). Oggi bisogna categorizzarle una per una a mano, anche quando la scelta corretta è ovvia perché già fatta prima. Se in passato la spesa era stata anche "divisa" (rimborso/quota di altri), quella divisione andrebbe riproposta con la stessa percentuale.

## Obiettivo

Un'azione globale in Spese ("Categorizza automaticamente") che:
1. Trova le transazioni "Da categorizzare" la cui descrizione coincide (esatta, case-insensitive) con descrizioni già categorizzate in passato.
2. Suggerisce la categoria più usata storicamente per quella descrizione (e, se presente, la percentuale di split coerente).
3. Chiede sempre conferma utente, transazione per transazione, con possibilità di modificare categoria e split prima di confermare.

Fuori scope: matching fuzzy/per-token (solo uguaglianza esatta di `description`, stessa logica già usata in `lib/gocardless/categorize.ts`); applicazione bulk senza conferma.

## Motore di calcolo puro

Nuovo modulo `lib/calc/categorize-suggestions.ts`.

```ts
export interface CategorizeSuggestion {
  transaction: Transaction;
  suggestedCategoryId: string;
  matchCount: number; // quante transazioni storiche hanno contribuito al match
  suggestedSplitPercentage: number | null; // 0..1, null = nessuno split coerente da proporre
}

export function computeCategorizeSuggestions(
  uncategorized: Transaction[],
  historical: Transaction[] // categoria non-fallback, stesso utente
): CategorizeSuggestion[]
```

Algoritmo:
- Raggruppa `historical` per `description.toLowerCase().trim()`.
- Per ogni transazione in `uncategorized`, cerca il gruppo con la stessa chiave.
  - Nessun gruppo → esclusa dal risultato (nessun suggerimento).
  - Gruppo trovato → categoria vincente = quella con più occorrenze nel gruppo; a parità di conteggio, vince quella della transazione più recente (`date` desc) tra le candidate a pari merito.
- Percentuale split: tra le sole transazioni del gruppo che hanno la categoria vincente, calcola `excludedAmount / amount` per ciascuna (valore assoluto). Se tutte coincidono (confronto arrotondato a 4 decimali per tolleranza floating point), quella è `suggestedSplitPercentage`. Altrimenti `null`. Un singolo match con categoria vincente conta come "coerente" (percentuale propria).
- `matchCount` = numero di transazioni nel gruppo con la categoria vincente.

Testato con vitest: gruppo singolo, categoria a maggioranza, pareggio risolto per data più recente, split coerente, split incoerente (→ null), nessun match.

## API

`GET /api/transactions/categorize-suggestions`
- Auth standard (401 se non autenticato).
- Query: tutte le transazioni dell'utente con categoria `isFallback = true` (candidate) e tutte quelle con categoria non-fallback (storico) — **nessun filtro periodo**, l'intero storico dell'utente.
- Richiama `computeCategorizeSuggestions`, ritorna l'array di suggerimenti (JSON, includendo la transazione completa per il rendering nel wizard).

Nessun nuovo endpoint di scrittura. L'applicazione di un suggerimento riusa `PATCH /api/transactions/[id]` esistente (già supporta `categoryId` e `excludedAmount` anche su transazioni "auto", con validazione ownership e invariante split).

## Data layer client

`lib/queries/transactions.ts`: nuovo hook `useCategorizeSuggestionsQuery()`, `useQuery` con `enabled: false` — non parte al mount, solo su `refetch()` esplicito quando il wizard viene aperto.

## UI

**Bottone** "Categorizza automaticamente" in `ExpensesFilterBar` (o riga sopra la lista transazioni). Sempre visibile e cliccabile.

Al click:
- `refetch()` dei suggerimenti (stato di caricamento sul bottone).
- 0 risultati → messaggio inline "Nessuna transazione simile trovata da suggerire", nessun dialog.
- ≥1 risultato → apre `AutoCategorizeWizard`.

**Nuovo componente** `components/domain/expenses/auto-categorize-wizard.tsx`, dialog (`components/ui/dialog.tsx`) con stato locale `currentIndex` sull'array di suggerimenti ricevuto in prop:

- Header: "Rivedi categorizzazione (X di N)".
- Corpo, per il suggerimento corrente:
  - Descrizione, data, importo della transazione da categorizzare.
  - Nota "Basato su {matchCount} transazioni passate categorizzate così".
  - `Select` categoria pre-compilato con `suggestedCategoryId` (stesso pattern con `CategoryAvatar` di `TransactionRow`/`ExpensesFilterBar`), modificabile liberamente prima di confermare.
  - Editor split locale (stato React, non componente `SplitSlider` esistente — quello committa subito ad ogni interazione su una transazione già a schermo; qui serve stato bufferizzato finché non si preme Conferma): riusa le funzioni pure `clampExcluded`/`computeSplitExcluded` da `split-slider.utils.ts`. Pre-compilato con `suggestedSplitPercentage` (0 se null).
- Footer: bottone **Salta** (avanza `currentIndex` senza side-effect) e bottone **Conferma** (chiama `useUpdateTransactionMutation` con `{ categoryId, excludedAmount }` dallo stato locale corrente, poi avanza `currentIndex` al successo).
- `currentIndex === suggestions.length` → schermata di riepilogo ("Applicate X di Y transazioni") con bottone Chiudi.
- Chiusura anticipata (✕ o overlay click): le conferme già eseguite restano applicate (ogni conferma è già stata una PATCH andata a buon fine, non c'è transazione atomica di gruppo da annullare).

## Error handling

- Fallimento del PATCH in uno step: mostra errore inline (stesso pattern `updateMutation.isError` già in uso), non avanza automaticamente — l'utente può ritentare Conferma o Saltare comunque.
- Fallimento della query di scansione: messaggio d'errore sul bottone, nessun dialog aperto.

## Testing

- Unit test vitest su `computeCategorizeSuggestions` (casi elencati sopra).
- Route test per `GET /api/transactions/categorize-suggestions` (pattern esistente in `app/api/transactions/route.test.ts`): auth richiesta, esclude transazioni senza match, sceglie categoria a maggioranza, ownership (non deve considerare transazioni di altri utenti).
- Nessun nuovo test e2e browser (stesso vincolo sandbox già noto per le altre feature Spese/Categorie: verifica manuale utente richiesta a fine implementazione).
