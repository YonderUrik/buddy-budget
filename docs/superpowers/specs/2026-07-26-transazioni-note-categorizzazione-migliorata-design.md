# Note transazioni + categorizzazione migliorata via campi GoCardless aggiuntivi

Data: 2026-07-26

## Problema

Le transazioni importate da GoCardless salvano oggi `description` = `remittanceInformationUnstructured`, spesso piena di codici transazione/riferimenti che non corrispondono al nome reale del negozio (es. `"PAYPAL *NETFLIX 4471"`, filiali diverse della stessa catena con testo diverso). Questo:

1. Rende difficile per l'utente ricordare a posteriori dove ha speso i soldi.
2. Peggiora l'affidabilità sia dell'auto-categorizzazione al sync (`lib/gocardless/categorize.ts`, match esatto per descrizione) sia del wizard "Categorizza automaticamente" (`lib/calc/categorize-suggestions.ts`, similarità Jaccard sui token di descrizione).

GoCardless espone, quando la banca lo fornisce, anche `creditorName`/`debtorName`: il nome pulito della controparte, non affetto dai codici che compaiono in `remittanceInformationUnstructured`. Nessuno di questi campi è oggi letto da `lib/gocardless/client.ts` (`BankTransaction`, righe 189-195).

## Obiettivo

- Usare `creditorName`/`debtorName` (quando disponibili) come `description` mostrata e usata per il matching, con fallback identico al comportamento attuale quando la banca non li fornisce.
- Aggiungere un campo nota libera per transazione, editabile dall'utente indipendentemente dal source (auto/manuale), per annotare a cosa si riferisce una spesa.
- Nessuna modifica agli algoritmi di matching esistenti (match esatto in `categorize.ts`, Jaccard in `categorize-suggestions.ts`): beneficiano automaticamente di un input più pulito.

## Fuori scope

- Backfill delle transazioni auto già sincronizzate (restano con la `description` grezza già salvata). Motivazione: rate limit GoCardless sandbox molto stretto (~4 chiamate/giorno per endpoint/conto, vedi nota in `CLAUDE.md`); solo le nuove sync beneficiano dei campi aggiuntivi.
- `remittanceInformationStructured`, `additionalInformation`, `proprietaryBankTransactionCode`: non richiesti, non aggiunti in questo piano.
- Modifiche all'algoritmo di similarità stesso (soglia Jaccard, tokenizzazione): resta invariato, cambia solo l'input che riceve.

## Data model

`lib/db/schema/transactions.ts` — due nuove colonne nullable:

- `rawDescription: text` — testo grezzo `remittanceInformationUnstructured` originale così come arrivato da GoCardless, quando disponibile. `null` per transazioni manuali e per transazioni auto dove GoCardless non fornisce nemmeno questo campo. Serve **solo** da mostrare in un tooltip/dettaglio quando `description` è stata sostituita dal nome pulito — mai usato nel matching.
- `note: text` — nota libera dell'utente. `null` di default. Editabile sia su transazioni auto sia manuali (nessun vincolo di ownership diverso da quello già esistente su `PATCH /api/transactions/[id]`).

Nessuna migrazione di backfill sulle righe esistenti: le colonne sono nullable, le righe già presenti restano con entrambe a `null`.

## GoCardless client (`lib/gocardless/client.ts`)

`BankTransaction` aggiunge due campi opzionali:

```ts
export interface BankTransaction {
  transactionId?: string;
  internalTransactionId?: string;
  transactionAmount: { amount: string; currency: string };
  remittanceInformationUnstructured?: string;
  bookingDate: string;
  creditorName?: string;
  debtorName?: string;
}
```

Nessun'altra modifica al client: sono già presenti nella risposta `/accounts/{id}/transactions/` di GoCardless quando la banca li espone, non serve nessun nuovo parametro di richiesta.

## Sync (`lib/gocardless/sync.ts`)

Sostituire il calcolo attuale di `description` (riga 79) con:

```ts
const rawDescription = bankTransaction.remittanceInformationUnstructured ?? null;
const isExpense = Number(bankTransaction.transactionAmount.amount) < 0;
const merchantName = (isExpense ? bankTransaction.creditorName : bankTransaction.debtorName)?.trim();
const description = merchantName || rawDescription || "Movimento bancario";
```

`description` resta l'unico campo passato a `resolveCategoryId` (match esatto) — nessuna terza colonna "nome pulito" separata da `description` stessa. Il nuovo insert aggiunge `rawDescription` (il valore calcolato sopra, non il fallback letterale "Movimento bancario" — se non c'è testo grezzo, `rawDescription` resta `null`).

Segno importo: `transactionAmount.amount` negativo = uscita → controparte è il creditore (`creditorName`, chi riceve i soldi); positivo = entrata → controparte è il debitore (`debtorName`, chi ha inviato i soldi). Coerente con la semantica GoCardless standard.

## Categorizzazione (nessuna modifica di codice)

- `lib/gocardless/categorize.ts` (`matchCategoryId`, match esatto case-insensitive su `description`): riceve descrizioni più pulite quando il nome merchant è disponibile, quindi più transazioni dello stesso negozio matchano esattamente invece di differire per codici/suffissi.
- `lib/calc/categorize-suggestions.ts` (Jaccard su token di `description`): stesso beneficio, punteggi di similarità più alti e più affidabili tra transazioni dello stesso merchant.

Entrambi i moduli restano byte-per-byte invariati.

## Validazione (`lib/validation/transactions.ts`)

`updateTransactionSchema` aggiunge:

```ts
note: z.string().trim().max(500).nullable().optional(),
```

Stringa vuota (dopo trim) va normalizzata a `null` prima dello UPDATE (nel route handler o con `.transform()` nello schema) — "cancella nota" e "nota mai impostata" sono lo stesso stato. `createTransactionSchema` non include `note` (si aggiunge dopo la creazione via PATCH, se serve — coerente con transazioni manuali che nascono senza nota).

## UI (`components/domain/expenses/transaction-row.tsx`)

- Quando `rawDescription` è presente e diverso da `description`, il testo descrizione principale mostra un tooltip (`title` o componente tooltip esistente nel progetto) col testo grezzo originale — stesso pattern già usato per il troncamento (`title={transaction.description}` esistente, riga 94).
- Nuova icona nota (lucide `notebook-pen` o simile, coerente con le icone già in uso) accanto ai badge Auto/Manuale/Diviso, visibile solo se `note` non è vuota. Click apre un popover con una `Textarea` per leggere/editare, salvataggio su blur (stesso pattern di `commitDescription`/`commitAmount` già presente nel componente). Editabile per **entrambi** i source (auto e manuale) — unico campo che rompe la regola "auto è sola lettura", già chiarito come scelta esplicita.
- Se `note` è vuota, nessuna icona mostrata; un modo per aggiungerne una la prima volta (es. bottone icona ghost sempre presente ma solo sui hover/focus, o icona sempre visibile in stato "vuoto") — dettaglio implementativo lasciato al piano, non bloccante per la spec.

## Ricerca (`lib/calc/expenses.ts`, `filterTransactions`)

Il filtro testo esistente aggiunge il match anche su `note` (oltre a `description`), stessa logica case-insensitive già usata.

## Test

- `lib/gocardless/sync.test.ts`: nuovi casi per il calcolo di `description`/`rawDescription` — creditorName presente su uscita, debtorName presente su entrata, nessuno dei due presente (fallback a remittanceInformationUnstructured), nessun campo testuale disponibile (fallback a "Movimento bancario"), verifica che `rawDescription` sia `null` quando non c'è testo grezzo.
- `lib/validation/transactions.test.ts`: `note` valida fino a 500 caratteri, oltre soglia rifiutata, stringa vuota/whitespace normalizzata a `null`.
- `lib/calc/expenses.test.ts`: `filterTransactions` matcha per testo anche dentro `note`.
- Nessun nuovo test per `categorize.ts`/`categorize-suggestions.ts` (algoritmo invariato).

## Rischi/limiti noti

- `creditorName`/`debtorName` non sono garantiti da tutte le banche (dipende da cosa espone il PSD2 AISP della banca specifica) — fallback già gestito, nessun crash atteso, solo minor beneficio su banche che non li forniscono.
- Le transazioni già sincronizzate restano con la `description` grezza fino alla prossima modifica manuale o a un eventuale backfill futuro (esplicitamente fuori scope qui).
