# Design: palette colori/icone estesa per categorie + distribuzione automatica colori

Data: 2026-07-23

## Contesto

Oggi le categorie hanno una palette di 8 colori (condivisa con i Conti, `lib/validation/shared-colors.ts`) e 28 icone (`lib/validation/categories.ts`). Con molte categorie personalizzate, colori duplicati tra categorie diverse diventano probabili e la palette/icone disponibili sono percepite come limitate. Richiesta utente: più colori, più icone, e un pulsante che distribuisca automaticamente i colori tra le categorie evitando duplicati.

Nessuna migrazione DB necessaria: `categories.color` e `categories.icon` (e gli equivalenti su `accounts`) sono colonne `text`, non enum Postgres — l'espansione è solo a livello di enum Zod/TypeScript applicativo.

## 1. Palette colori estesa (8 → 48)

Decisione: ampliare la palette **condivisa** `shared-colors.ts` (impatta anche Conti, non solo Categorie) — coerenza visiva tra le due entità mantenuta.

### 16 colori base

8 esistenti: `slate`, `blue`, `green`, `yellow`, `purple`, `orange`, `red`, `teal`.
8 nuovi: `pink`, `indigo`, `cyan`, `lime`, `amber`, `rose`, `violet`, `emerald`.

Tutti e 16 sono famiglie di colore standard Tailwind — stesso schema di classi già in uso oggi:
- Avatar (`COLOR_SWATCH_MAP`): `bg-{c}-100 dark:bg-{c}-900/40` / `text-{c}-600 dark:text-{c}-400`
- Dot picker (`COLOR_DOT`): `bg-{c}-500`
- Torta multilivello (`SWATCH_CHART_COLOR`): CSS var `--swatch-{c}` (hex letterale, shade 500), aggiunta in `app/globals.css` sia in `:root` che in `.dark` (oggi i due blocchi hanno valori identici per i colori esistenti — stesso pattern per i nuovi).

### 32 varianti (per la distribuzione automatica)

Ogni colore base ha 2 varianti derivate dalla stessa famiglia Tailwind, usando shade-step diversi invece di hex arbitrari:
- `{base}-light`: shade 300 (dot), 50/800 (avatar bg light/dark), 500/300 (avatar fg light/dark)
- `{base}-dark`: shade 700 (dot), 200/950 (avatar bg light/dark), 700/300 (avatar fg light/dark)

Esempio per `blue`: base usa blue-500 (dot) / blue-100·blue-900 (bg) / blue-600·blue-400 (fg); `blue-light` usa blue-300 (dot) / blue-50·blue-800 (bg) / blue-500·blue-300 (fg); `blue-dark` usa blue-700 (dot) / blue-200·blue-950 (bg) / blue-700·blue-300 (fg). Gli hex esatti per `--swatch-{base}-light` / `--swatch-{base}-dark` vanno presi dalla palette default Tailwind (shade 300/700 della famiglia corrispondente) in fase di implementazione.

Totale pool: 16 + 32 = 48 valori enum in `SwatchColor`.

### Picker manuale

`CategoryIconColorPicker` (e l'equivalente per Conti) mostra **solo i 16 colori base** — griglia compatta invariata nella forma. Le 32 varianti non sono selezionabili manualmente: esistono solo come output dell'algoritmo di distribuzione automatica (sezione 3).

## 2. Icone estese (28 → 60)

+32 icone nuove (lucide-react), a copertura di ambiti non ancora rappresentati (finanza, casa, tecnologia, viaggi, cibo, salute, tempo libero):

`wallet`, `credit-card`, `piggy-bank`, `banknote`, `landmark`, `receipt`, `trending-up`, `coins`, `flame`, `sofa`, `hammer`, `paintbrush`, `laptop`, `headphones`, `camera`, `printer`, `train-front`, `ship`, `map-pin`, `luggage`, `coffee`, `pizza`, `wine`, `cake`, `pill`, `activity`, `glasses`, `book-open`, `palette`, `bike`, `calculator`, `watch`.

Aggiunte a `CATEGORY_ICONS` (`lib/validation/categories.ts`) e a `ICON_MAP` (`components/domain/categories/category-avatar.tsx`), stesso pattern kebab-case → componente Lucide PascalCase già in uso. Il picker icone (`CategoryIconColorPicker`) resta una griglia scrollabile: nessun cambio di layout richiesto, solo più righe.

## 3. Pulsante "Distribuisci colori"

### UI

Pulsante nell'header della pagina `/categorie` (`app/(app)/categorie/page.tsx`), accanto al titolo. Al click apre un `AlertDialog` (`components/ui/alert-dialog.tsx`, già presente) di conferma: testo esplicito che l'azione sovrascrive i colori attualmente assegnati a tutte le categorie non-fallback. Conferma → chiamata mutation → invalidation della query categorie (aggiornamento ottimistico non necessario, la lista è corta).

### Endpoint

Nuova route `POST /api/categories/distribute-colors`, dedicata e atomica (non riusa il PATCH singolo):
1. Legge tutte le categorie dell'utente di sessione con `isFallback = false`, ordinate per `createdAt asc` (stesso ordine della lista in UI).
2. Calcola la nuova assegnazione colore (algoritmo sotto).
3. Applica tutti gli update in una singola transazione Drizzle (`db.transaction`) — se qualcosa fallisce, nessuna categoria viene toccata.
4. Ownership implicita: la query è filtrata per `userId` di sessione, stesso pattern degli altri endpoint categorie (nessun id fornito dal client, quindi nessuna superficie IDOR).

La categoria fallback ("Da categorizzare") non è mai inclusa: resta sempre rossa, segnale visivo fisso indipendente dall'algoritmo.

### Algoritmo di assegnazione

Dato l'elenco ordinato di N categorie non-fallback:
1. Se N ≤ 16: assegna i 16 colori base in ordine, uno per categoria, nessuna ripetizione possibile.
2. Se 16 < N ≤ 48: usa il pool completo di 48 (16 base + 32 varianti) in un ordine che massimizza la distanza tra ripetizioni della stessa famiglia di colore (interleaving: prima un giro su tutti i 16 base, poi un giro sulle varianti "light", poi sulle "dark" — non raggruppare le 3 shade della stessa famiglia una dopo l'altra).
3. Se N > 48: il pool si ripete ciclicamente, ma non due categorie adiacenti nella lista ricevono mai lo stesso colore (garantito dal semplice fatto che il ciclo ha lunghezza 48 ≫ 1; nessuna logica ulteriore necessaria a meno che N superi 48 di poco e l'ultimo elemento del ciclo confini col primo del giro successivo — in tal caso l'algoritmo scarta l'ultimo colore del pool se coincide col primo e usa il successivo).

Implementazione come funzione pura testabile (`lib/calc/distribute-colors.ts` o simile), separata dalla route handler, per permettere test unitari senza DB.

## Data flow

```
click "Distribuisci colori"
  → AlertDialog conferma
  → mutation POST /api/categories/distribute-colors
  → route: legge categorie utente (no fallback) → calcola assegnazione (funzione pura) → transazione update
  → risposta 200 con categorie aggiornate
  → invalidation query categorie → CategoryRow/CategoryAvatar ri-renderizzano coi nuovi colori
```

## Error handling

- Nessuna categoria non-fallback presente: endpoint risponde 200 no-op (nessun errore, nulla da distribuire).
- Fallimento query/transazione: 500, nessuna categoria modificata (atomicità transazionale), toast di errore in UI, dialog si chiude senza modifiche visibili.
- Utente senza sessione: 401, stesso pattern middleware esistente.

## Testing

- Unit test della funzione pura di assegnazione colori: N=0, N=1, N=16 (nessuna ripetizione), N=17 (prima ripetizione, verifica non-adiacenza), N=48, N=49 (verifica wrap-around senza colore identico tra ultimo e primo).
- Unit test che la categoria fallback non compare mai nell'input della funzione di assegnazione.
- Test manuale in browser (utente, come per le feature precedenti — nessun Postgres/Redis nel sandbox agentico): creare >16 categorie, cliccare "Distribuisci colori", verificare assenza di colori identici adiacenti; verificare che "Da categorizzare" resti rossa; verificare picker manuale mostri solo i 16 colori base.

## Fuori scope

- Colori hex arbitrari/generazione dinamica illimitata (scartata in brainstorming a favore della palette fissa a 48 valori — cambio architetturale più ampio, non necessario per i volumi di categorie realistici di questa app).
- Redistribuzione automatica delle icone (richiesta esplicitamente solo per i colori).
- Selezione manuale delle 32 varianti chiare/scure nel picker (riservate all'algoritmo).
