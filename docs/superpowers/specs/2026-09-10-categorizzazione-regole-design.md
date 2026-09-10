# Categorizzazione automatica basata su regole — design

Data: 2026-09-10
Stato: approvato in brainstorming, da tradurre in piano di implementazione

## Problema

Il sistema attuale di categorizzazione automatica è composto da due meccanismi scollegati, nessuno dei quali conserva memoria delle decisioni dell'utente:

1. **All'import GoCardless** (`lib/gocardless/categorize.ts`): `resolveCategoryId` cerca l'ultima transazione con descrizione **identica** (`ilike`) già categorizzata. Qualunque variazione — un codice di transazione in coda, una filiale diversa, `SPA` invece di `S.p.A.` — manda la transazione in "Da categorizzare".
2. **Bottone "Categorizza automaticamente"** (`lib/calc/categorize-suggestions.ts` + `AutoCategorizeWizard`): similarità di Jaccard sui token della descrizione grezza, soglia 0.5, presentata in un wizard modale che chiede conferma **una transazione alla volta**.

Difetti riscontrati nell'uso reale, confermati dall'utente in brainstorming:

- **Non impara**: una conferma nel wizard vale solo per quella transazione. Lo stesso merchant torna "Da categorizzare" al sync successivo.
- **Proposte sbagliate o assenti**: il Jaccard lavora sul testo grezzo, quindi il rumore bancario condiviso (`pagamento`, `pos`, `carta`) conta come somiglianza reale fra merchant diversi — limite già annotato nel log del 2026-07-24 e mai risolto. Viceversa, un merchant noto con un suffisso variabile può non raggiungere la soglia.
- Il motore dei suggerimenti **ignora la direzione** della transazione (entrata/uscita): è la causa a monte del bug trovato dalla review whole-branch del 2026-07-28, in cui il wizard proponeva una categoria di spesa per un'entrata e il PATCH rispondeva 400 senza via d'uscita se non "Salta".

## Decisioni di prodotto (dal brainstorming)

| Domanda | Decisione |
|---|---|
| LLM o logica deterministica? | **Ibrido**: regole prima, LLM solo come rete di sicurezza sui casi mai visti. |
| Autonomia | **Il sistema non applica mai ciò che deduce.** Le deduzioni (similarità, LLM) sono solo proposte. |
| Eccezione all'autonomia | **Una regola già approvata dall'utente si applica da sola** al sync successivo: non si riconferma ESSELUNGA ogni mese. |
| Come nasce la memoria | **Appresa dalle conferme, ma materializzata in regole visibili e modificabili** dall'utente. |
| Dove gira il modello | **Ollama locale nel cluster.** Se nessun modello è collegato, il livello si spegne e il resto funziona identico. |

Approccio scelto fra tre alternative discusse:

- **A (scelto)** — regole su chiave merchant normalizzata, apprese dalle conferme, ispezionabili.
- **B (scartato)** — memoria implicita ricalcolata dalle transazioni, senza entità regola: non ispezionabile né correggibile, una deduzione sbagliata si autoalimenta.
- **C (scartato)** — regole con regex libera e priorità manuale: strumento da sviluppatore; regex generate automaticamente sarebbero imprevedibili e difficili da spiegare. Il tipo di match `contains` copre il bisogno reale (generalizzare su una catena) senza il costo.

## Modello dati

Nuova tabella `categorization_rules` (`lib/db/schema/categorization-rules.ts`):

| campo | tipo | note |
|---|---|---|
| `id` | uuid pk | |
| `userId` | text → `auth_user.id` on delete cascade | |
| `matchType` | enum `merchant` \| `contains` | nuovo `rule_match_type` enum |
| `pattern` | text | già normalizzato con la stessa funzione della chiave merchant |
| `categoryId` | uuid → `categories.id` | |
| `splitPercentage` | numeric(5,4) nullable | quota "Dividi" da riproporre; `null` = nessuna |
| `source` | enum `appresa` \| `manuale` | nuovo `rule_source` enum |
| `hitCount` | integer default 0 | quante volte la regola ha agito |
| `lastAppliedAt` | timestamptz nullable | |
| `createdAt` / `updatedAt` | timestamptz | |

Vincoli: `unique(userId, matchType, pattern)` — riconfermare lo stesso merchant aggiorna la regola invece di duplicarla; indice su `userId`.

Nessuna modifica alla tabella `transactions`.

### Chiave merchant

Nuovo modulo puro `lib/categorization/merchant-key.ts`, funzione `merchantKey(description: string): string`:

1. lowercase e rimozione diacritici (normalizzazione NFD)
2. split su non-alfanumerici, scarto dei token puramente numerici
3. rimozione dei token di rumore bancario (`MERCHANT_NOISE_TOKENS`: `pos`, `pagamento`, `pagam`, `carta`, `acquisto`, `addebito`, `bonifico`, `sepa`, `sdd`, `rif`, `cod`, `operazione`, `ricarica`, …)
4. rimozione dei suffissi societari (`spa`, `srl`, `snc`, `sas`, `ltd`, `inc`, `bv`, `gmbh`)
5. join dei token superstiti con spazio singolo

Esempio: `"PAGAMENTO POS ESSELUNGA SPA VIA ROMA COD.4471"` → `esselunga via roma`.

Se dopo la normalizzazione non resta nessun token (descrizione interamente numerica o di solo rumore), la chiave è la descrizione normalizzata a lowercase/trim — stesso fallback già adottato oggi da `descriptionSimilarity`, per non collassare descrizioni diverse su una chiave vuota condivisa.

## Pipeline di risoluzione

Nuovo modulo `lib/categorization/resolve.ts`. Sostituisce `resolveCategoryId` come chiamato da `lib/gocardless/sync.ts`.

```
resolveCategorization(userId, { description, amount }) 
  → { categoryId, excludedAmount, ruleId } | null
```

Ordine stretto, il primo che vince chiude:

1. regola `merchant` con `pattern === merchantKey(description)` → applica
2. regola `contains` con `merchantKey(description).includes(pattern)` → applica; a più match vince il `pattern` più lungo (più specifico), a pari lunghezza il più recente
3. nessun match → ritorna `null`, il chiamante assegna la categoria fallback

**Guard di direzione, obbligatorio in entrambi i rami**: una regola la cui categoria è incompatibile con la direzione della transazione (categoria `entrata` su un importo negativo, o categoria non-`entrata` su un importo positivo) viene ignorata e la valutazione prosegue. È lo stesso invariante che il server già impone su `PATCH /api/transactions/[id]`; la sua assenza nel motore attuale è la causa del bug del 2026-07-28.

Quando una regola vince: `hitCount` incrementato e `lastAppliedAt` aggiornato, nella stessa transazione DB dell'inserimento della transazione.

`splitPercentage` della regola, se presente, produce `excludedAmount = round(splitPercentage * |amount|)` con il segno di `amount`, coerente con `isValidExcludedAmount`.

### Debito tecnico chiuso contestualmente

`getFallbackCategoryId` risolve oggi la categoria fallback **per nome letterale** (`"Da categorizzare"`) invece che per il flag `isFallback` — debito aperto nel log dal 2026-07-21. Dato che questo lavoro riscrive il chiamante, la risoluzione passa al flag `isFallback` (con creazione al volo invariata nel comportamento). Il guard 409 sul rename della fallback resta dov'è.

## Proposte (non applicano mai)

Nuovo modulo `lib/categorization/suggest.ts`. Opera solo sulle transazioni rimaste sulla categoria fallback, in cascata; ogni transazione riceve al massimo una proposta, dalla prima sorgente che la produce:

1. **Regola simile** — Jaccard fra i token di `merchantKey(description)` e quelli dei `pattern` esistenti, soglia 0.5. Motivo mostrato: «simile alla regola `<pattern>`».
2. **Storico** — il motore attuale (`computeCategorizeSuggestions`), riscritto per confrontare **chiavi normalizzate** invece di descrizioni grezze. Motivo: «come N transazioni passate».
3. **Assistente** — Ollama, solo su ciò che resta dopo 1 e 2.

Ogni proposta porta `source` (`regola` | `storico` | `assistente`), `confidence` (0–1) e i dati per mostrare il motivo. Il guard di direzione vale anche qui: una proposta incompatibile con la direzione della transazione non viene emessa.

`confidence` non è una scala inventata, è il valore già disponibile per ciascuna sorgente: la similarità di Jaccard con il pattern per `regola`, la `averageSimilarity` dei match della categoria vincente per `storico` (il campo che il motore attuale già calcola), il valore dichiarato dal modello per `assistente`. Sono grandezze non confrontabili fra loro: la UI le mostra sempre accompagnate dal badge di origine, mai come un ranking unico.

Le proposte sono calcolate **per transazione** e raggruppate a valle per chiave merchant. Un gruppo prende la proposta della sorgente più alta in cascata fra quelle delle sue transazioni; se all'interno dello stesso gruppo emergono categorie proposte diverse (possibile solo fra `storico` e `assistente`), il gruppo mostra la più frequente e segnala che le singole transazioni divergono, restando espandibile per deciderle una per una.

`splitPercentage` proposto solo quando tutte le transazioni di riferimento della categoria vincente hanno la stessa quota — regola già presente oggi, conservata.

## Livello assistente (Ollama)

`lib/categorization/llm/index.ts` espone un'interfaccia stretta:

```ts
interface CategorySuggester {
  suggest(input: SuggestInput[], categories: Category[]): Promise<LlmSuggestion[]>;
}
getSuggester(): CategorySuggester | null
```

Unica implementazione: `OllamaSuggester`, configurata da `OLLAMA_BASE_URL` e `OLLAMA_MODEL`.

**Requisito esplicito — nessun modello collegato è uno stato normale, non un guasto.** Se `OLLAMA_BASE_URL` non è impostata, `getSuggester()` ritorna `null` e il livello viene saltato: nessun errore, nessun log di allarme, nessun avviso in UI. Lo stesso vale a runtime per connessione rifiutata, timeout (10s) o risposta che non supera la validazione Zod: zero proposte da questo livello, le proposte da regole e storico restano invariate. **L'app non deve mai degradare sotto il comportamento puramente deterministico.**

Chiamata in **un solo batch** per tutte le transazioni non risolte, mai una per transazione. Il prompt contiene: elenco delle categorie dell'utente (nome + tipo) e, per ogni transazione, descrizione normalizzata, importo e direzione. Non contiene IBAN, saldi, identificativi di conto o dati dell'utente.

L'output è validato con Zod (`[{ index, categoryName, confidence }]`); un nome di categoria che non corrisponde a una categoria esistente dell'utente viene **scartato**, mai creato.

## API

- `GET /api/transactions/categorize-suggestions` — esistente, riscritto: risponde con le proposte da **regole + storico**, raggruppate per chiave merchant. Non chiama mai l'assistente, quindi resta veloce e non dipende da Ollama.
- `POST /api/transactions/categorize-suggestions/ai` — nuovo: riceve le transazioni rimaste senza proposta, interroga l'assistente se configurato, risponde con le proposte aggiuntive (array vuoto se il livello è spento).
- `POST /api/transactions/categorize-apply` — nuovo, batch: riceve un array di gruppi `{ transactionIds[], categoryId, excludedAmount, createRule }` e scrive **tutto in un'unica transazione DB** (aggiornamento transazioni + creazione/aggiornamento regole). O passa tutto, o non passa niente. Ownership verificata su ogni `transactionId` e su `categoryId`, guard di direzione applicato per transazione.
- Regole: `GET`/`POST /api/categorization-rules`, `PATCH`/`DELETE /api/categorization-rules/[id]`, con lo stesso pattern di ownership IDOR-safe già usato da `/api/categories/[id]`.

## Interfaccia

### Pagina di revisione `/categorizza`

Sostituisce `AutoCategorizeWizard`. Raggiunta dal bottone "Categorizza automaticamente" già presente in Transazioni.

Il cambiamento che pesa: **raggruppamento per chiave merchant**. Le transazioni con la stessa chiave sono una riga sola («ESSELUNGA — 7 transazioni, 243,10 €»), espandibile per vedere le singole. Una scelta categorizza l'intero gruppo.

Per gruppo: select categoria precompilato con la proposta, badge dell'origine (`Regola simile` / `Storico` / `Assistente`) con la confidenza, controllo split opzionale collassato, checkbox di selezione. In testa: "Seleziona tutto" e **"Applica selezionate (N)"**.

`createRule` è attivo di default: applicare significa insegnare. La regola creata è sempre `merchant` sulla chiave normalizzata — non generalizza mai oltre ciò che l'utente ha effettivamente visto.

Le proposte dell'assistente arrivano in un secondo momento (chiamata in background dopo il primo render) e si innestano nei gruppi ancora senza proposta. Se non arrivano, la pagina resta esattamente quella che era: nessuno spinner infinito, nessun messaggio di errore.

### Gestione regole

Sezione dentro `/categorie`, non una nuova voce di sidebar. Lista delle regole con pattern, tipo di match, categoria, numero di utilizzi. Azioni: modificare pattern e categoria, passare una regola da `merchant` a `contains` (è così che `esselunga via roma` diventa `esselunga` e copre tutte le filiali), eliminare.

## Popolamento iniziale

Senza regole preesistenti il livello 1 sarebbe vuoto e tutto il carico cadrebbe su storico e assistente. Script one-shot `lib/db/backfill-categorization-rules.ts`: genera regole `appresa` dalle transazioni già categorizzate — una per chiave merchant, categoria più frequente, pareggio risolto sulla più recente, categorie fallback escluse.

**Lo script va eseguito in sessione e il conteggio delle regole create riportato all'utente.** Un backfill scritto e mai lanciato è esattamente l'errore del 2026-07-22 con `backfill-category-appearance.ts`, che ha lasciato dati incoerenti per settimane dietro un piano "completo".

## Testing

Funzioni pure con vitest, come da convenzione del progetto:

- `merchant-key`: rumore, suffissi societari, accenti, token numerici, fallback su descrizione di solo rumore
- `resolve`: ordine dei rami, `contains` più lungo vince, guard di direzione in entrambi i rami, nessun match
- `suggest`: cascata fra le tre sorgenti, guard di direzione, coerenza dello split proposto
- raggruppamento per chiave merchant
- `CategorySuggester` finto per il livello assistente, **inclusi i casi "non configurato" e "timeout"**, che devono provare l'assenza di degrado
- API: ownership cross-utente su apply e regole, atomicità del batch

## Sequenza di implementazione

Il lavoro è ampio ma ha un ordine naturale in cui ogni fase lascia il sistema funzionante:

1. **Fondamenta** — `merchant-key`, schema `categorization_rules`, migration. Nessun comportamento visibile cambia.
2. **Pipeline** — `resolve.ts` e sostituzione di `resolveCategoryId` nel sync, con il guard di direzione e la chiusura del debito `isFallback`. Da qui le regole agiscono all'import, anche se non c'è ancora modo di crearle dalla UI.
3. **Backfill** — script eseguito in sessione: il livello 1 smette di essere vuoto.
4. **Proposte** — `suggest.ts` e riscrittura dell'endpoint `GET`, ancora consumati dalla UI vecchia.
5. **Revisione** — pagina `/categorizza`, endpoint batch `categorize-apply`, raggruppamento per merchant. Il wizard esce di scena.
6. **Gestione regole** — sezione in `/categorie`, endpoint CRUD.
7. **Assistente** — `CategorySuggester`, `OllamaSuggester`, endpoint `ai`, innesto in background nella pagina di revisione. È l'ultima fase proprio perché tutto deve funzionare senza.

## Fuori scope (deciso, non dimenticato)

- Regex nei pattern e priorità manuale delle regole (approccio C, scartato). Il tipo `contains` copre il bisogno reale.
- Auto-applicazione delle proposte dedotte: contraddice la decisione di prodotto.
- Qualunque modifica a KPI, donut e grafici di Transazioni.
- Rimozione del vecchio `AutoCategorizeWizard` dal repository: resta finché la nuova pagina non è verificata manualmente dall'utente, poi si elimina.

## Rischi noti

- **Ollama su single-VPS**: un modello locale è il punto fragile dell'infrastruttura (RAM/CPU condivise col resto del cluster). Mitigazione strutturale: il livello è isolato dietro `CategorySuggester`, spento per default in assenza di configurazione, e sostituibile con un'altra implementazione senza toccare il resto.
- **Regole apprese sbagliate**: una conferma distratta crea una regola che poi si applica da sola. Mitigazione: le regole sono visibili, modificabili e cancellabili dalla pagina di gestione, con il contatore di utilizzi a rendere evidenti quelle che agiscono di più.
- **Migration DB**: il progetto ha un vincolo unique pre-esistente che blocca `pnpm db:push` (log del 2026-07-27), aggirato finora con `ALTER TABLE` diretti non versionati. Questa tabella nuova va aggiunta con lo stesso metodo solo come ultima risorsa; se possibile, sistemare il blocco alla radice — altrimenti il debito si allarga a una tabella intera invece che a due colonne.
