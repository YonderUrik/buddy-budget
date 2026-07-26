# Categorizza automaticamente — match per similarità (addendum)

> Estende `docs/superpowers/specs/2026-07-23-spese-categorizza-automatico-design.md` e il piano `docs/superpowers/plans/2026-07-23-spese-categorizza-automatico.md` (Task 1-4 già implementati e mergiati con match esatto). Questo documento sostituisce il criterio di match del motore di calcolo con similarità a token, mantenendo invariati endpoint, hook e struttura del wizard.

## Contesto

Il wizard "Categorizza automaticamente" in Spese (Task 1-4, già in `main`) suggerisce categoria e split per le transazioni "Da categorizzare" basandosi su un match **esatto** (case-insensitive, trim) sulla descrizione. Nell'uso reale questo esclude coppie di transazioni chiaramente dello stesso merchant ma con descrizione leggermente diversa:

- **Suffissi/codici variabili**: `"PAYPAL *NETFLIX 4471"` vs `"PAYPAL *NETFLIX 8832"`.
- **Filiali/sedi diverse della stessa catena**: `"ESSELUNGA VIA ROMA 12"` vs `"ESSELUNGA VIA MILANO 45"`.

**Fuori scope esplicito** (deciso in brainstorming): l'auto-categorizzazione al momento dell'import GoCardless (`lib/gocardless/categorize.ts`) resta invariata, match esatto — questo cambio riguarda solo il motore del wizard manuale (`lib/calc/categorize-suggestions.ts`). Refusi/errori di battitura non sono un caso d'uso richiesto (non guidano la scelta dell'algoritmo).

## Algoritmo di similarità

**Tokenizzazione** (`tokenize(description)`):
1. Minuscolo, trim (stesso `normalizeDescription` già esistente come base).
2. Split su spazi e punteggiatura (whitespace + caratteri non alfanumerici come separatori).
3. Scarta i token puramente numerici (regex `^\d+$`) — coprono codici transazione, numeri civici, riferimenti.
4. Risultato: un `Set<string>` di parole "significative".

**Caso degenere**: se il set risultante è vuoto (descrizione composta solo da numeri, es. un riferimento bonifico tipo `"RIF 00123456"` → dopo aver scartato i numeri resta `{"rif"}`, non vuoto; ma un caso come `"123456789"` puro produce set vuoto), il confronto per quella transazione ricade sull'uguaglianza esatta della stringa normalizzata originale (comportamento identico a oggi) — niente Jaccard su insiemi vuoti.

**Similarità** (`similarity(a, b)`): indice di Jaccard tra i due set di token — `|intersezione| / |unione|`. Range `[0, 1]`. Due descrizioni identiche dopo tokenizzazione → `1`.

**Soglia**: `SIMILARITY_THRESHOLD = 0.5` (costante nominata nel modulo). Una coppia (transazione da categorizzare, transazione storica) è un match se `similarity ≥ 0.5`.

Esempio verificato: `"ESSELUNGA VIA ROMA 12"` → `{esselunga, via, roma}`, `"ESSELUNGA VIA MILANO 45"` → `{esselunga, via, milano}` → intersezione 2, unione 4 → `0.5` → incluso (soglia inclusiva, `≥`).

## Modifiche al motore di calcolo

File: `lib/calc/categorize-suggestions.ts` (esistente, da modificare).

**Prima** (oggi): raggruppamento delle transazioni storiche in una `Map<normalizedDescription, Transaction[]>`, poi lookup esatto per ogni transazione da categorizzare.

**Dopo**: per ogni transazione da categorizzare, confronto contro **ogni** transazione storica (niente pre-raggruppamento per chiave esatta, la similarità non è una relazione di equivalenza transitiva). Le transazioni storiche con `similarity ≥ 0.5` rispetto alla transazione corrente formano il gruppo di match.

Il resto della pipeline resta **invariato**:
- Categoria vincente = più frequente tra i match; pareggio → categoria della transazione match più recente (`date` desc).
- `matchCount` = numero di match della categoria vincente (non più "match esatti", ora "match simili sopra soglia").
- `suggestedSplitPercentage` = calcolata solo sui match della categoria vincente, stessa logica di coerenza (tutte uguali arrotondate a 4 decimali → quel valore, altrimenti `null`).
- **Nessun peso per punteggio di similarità** nella scelta della categoria vincente o nel calcolo dello split: un match sopra soglia conta come un match, indipendentemente dal suo punteggio esatto (0.5 e 1.0 pesano uguale). Scelta deliberata per restare semplice — non richiesto, evitare di introdurre un criterio di voto ponderato non specificato.

**Nuovo campo output**:

```ts
export interface CategorizeSuggestion {
  transaction: Transaction;
  suggestedCategoryId: string;
  matchCount: number;
  suggestedSplitPercentage: number | null;
  averageSimilarity: number; // NUOVO: media dei punteggi di similarità dei soli match della categoria vincente, arrotondata a 2 decimali
}
```

`averageSimilarity` per un match esatto tradizionale (stessa descrizione) è sempre `1`.

## Endpoint e hook

`app/api/transactions/categorize-suggestions/route.ts` e `lib/queries/transactions.ts`: **nessuna modifica**. Passano già `uncategorized`/`historical` così come sono; il nuovo campo `averageSimilarity` attraversa la serializzazione JSON esistente senza bisogno di cambiare lo schema di risposta (nessuna validazione Zod sull'output).

## UI — wizard

File: `components/domain/expenses/auto-categorize-wizard.tsx` (esistente, da modificare).

La riga sotto il titolo del singolo step cambia da:
```
Basato su {suggestion.matchCount} transazioni passate categorizzate così.
```
a:
```
Basato su {suggestion.matchCount} transazioni simili ({Math.round(suggestion.averageSimilarity * 100)}% di somiglianza media).
```

Mostrata sempre, anche quando la somiglianza media è 100% (match esatto tradizionale) — nessuna condizione speciale, un solo formato di stringa per entrambi i casi. Nessun altro elemento UI cambia (categoria/split restano editabili come oggi, "Salta"/"Conferma"/chiusura anticipata invariati).

## Test

`lib/calc/categorize-suggestions.test.ts` (esistente, da estendere): i 6 test attuali restano validi (i loro match sono descrizioni identiche → similarità 1.0, sopra soglia, comportamento invariato). Nuovi casi:

- Suffisso numerico variabile: `"PAYPAL *NETFLIX 4471"` da categorizzare, storico `"PAYPAL *NETFLIX 8832"` → match trovato, `averageSimilarity` = 1 (i numeri sono scartati da entrambe le parti, i set di token restano identici).
- Filiale diversa esattamente al 50%: l'esempio Esselunga sopra → match trovato (soglia inclusiva), `averageSimilarity` = 0.5.
- Sotto soglia: due descrizioni con solo 1 parola in comune su 4 totali (0.25) → nessun match, transazione esclusa dal risultato (comportamento identico al caso "nessun match storico" di oggi).
- Descrizione interamente numerica: transazione da categorizzare con descrizione `"123456789"`, storico con la stessa stringa esatta → match per fallback su uguaglianza; storico con stringa numerica diversa → nessun match.
- `averageSimilarity` calcolata correttamente quando la categoria vincente ha più match con punteggi diversi (es. due match, uno a 1.0 e uno a 0.5 → media 0.75).

## Fuori scope (invariato dal design originale)

- Nessun filtro periodo nello scan: tutto lo storico dell'utente.
- Nessun nuovo endpoint di scrittura: l'applicazione riusa `PATCH /api/transactions/[id]`.
- Wizard sequenziale, categoria e split sempre editabili, "Salta" non applica nulla, chiusura anticipata lascia applicate le conferme già fatte.
- Stringhe utente in italiano, nessuna i18n.
- Auto-categorizzazione GoCardless all'import (`lib/gocardless/categorize.ts`) resta a match esatto — non toccata da questo documento.
