# Spese: torta multilivello e riordino sezioni — design

Data: 2026-07-22

## Contesto

La schermata Spese (`app/(app)/spese/page.tsx`) oggi mostra, in ordine: KPI cards, blocco "Per categoria" (lista budget editabile, `CategoryBreakdown`), due grafici affiancati (`ExpenseCharts`: donut "Fisse vs variabili" + barre "Andamento ultimi 6 mesi"), lista transazioni, form "+ Aggiungi".

Feedback dell'utente dopo il test manuale:
1. La lista transazioni come ultimo elemento non funziona bene visivamente.
2. Il donut "Fisse vs variabili" e il blocco budget per categoria sono scollegati: si vede il tipo di spesa ma non subito quanto si è speso per categoria rispetto al budget, senza scorrere la pagina.

Obiettivo: un impatto visivo più immediato su "dove sono andati i soldi", con budget/percentuali sempre visibili nello stesso blocco del grafico, e una lista transazioni non relegata in fondo.

## Architettura componenti

- **Eliminati**: `components/domain/expenses/category-breakdown.tsx` (l'intero file), e la porzione "Fisse vs variabili" di `components/domain/expenses/expense-charts.tsx`.
- **Nuovo**: `components/domain/expenses/category-breakdown-donut.tsx` — unifica torta multilivello (tipo → categoria) e legenda con budget editabile inline + percentuali. Sostituisce sia `CategoryBreakdown` che il donut di `ExpenseCharts`.
- **Rinominato**: `expense-charts.tsx` → `expense-trend-chart.tsx`, contiene solo il bar chart "Andamento ultimi 6 mesi" (il nome plurale "charts" non ha più senso con un solo grafico dentro).
- Aggiornare `components/domain/expenses/index.ts` (barrel) con i nuovi export, rimuovere quelli obsoleti.
- **Nessuna nuova funzione di calcolo**: `computeCategoryBreakdown` (già espone `categoryId`, `name`, `type`, `amount`, `color`, `icon`) e `computeFixedVsVariable` (somme per tipo) in `lib/calc/expenses.ts` bastano. Il totale speso nel periodo per il calcolo "% sul totale" si ottiene sommando `amount` su tutte le `CategoryAmount` restituite (stesso valore aggregato del KPI "speso").

## Grafico a torta multilivello

Due `<Pie>` recharts annidate nello stesso `<PieChart>` (pattern nested-donut standard, coerente con `ChartContainer`/`ChartTooltip` di shadcn già in uso):

- **Layer interno**: 2 spicchi, fissa/variabile, da `FixedVsVariable`. Colori fissi neutri (`--chart-1` fissa, `--chart-2` variabile — stessi token già usati oggi nel donut esistente).
- **Layer esterno**: uno spicchio per ogni categoria con `amount > 0` nel periodo selezionato. Colore = colore proprio della categoria (`entry.color`, stesso usato da `CategoryAvatar` altrove nell'app). `innerRadius` del layer esterno = `outerRadius` del layer interno (donut concentrico, nessuno spazio tra i due anelli).
- Categorie con `amount === 0` **non generano spicchio** nel layer esterno (spicchio invisibile inutile) ma **compaiono comunque in legenda** (vedi sotto).
- **Ordinamento**: l'array dati del layer esterno va ordinato per `type` (tutte le "fissa" contigue, poi tutte le "variabile") e, dentro ogni gruppo, per `amount` decrescente. Necessario perché recharts non riordina i dati di un `Pie` — l'allineamento angolare tra layer esterno e layer interno dipende dall'ordine dell'array. Stesso ordinamento va applicato alle righe della legenda, per leggibilità (torta e legenda si corrispondono visivamente).
- Tooltip: riusa il pattern `tooltipValueFormatter` già presente in `expense-charts.tsx` (nome + importo formattato in valuta), esteso per mostrare anche il tipo quando si passa sul layer interno.

Alternativa scartata: disegnare gli anelli a mano con SVG per maggior controllo — scartata perché non aggiunge nulla rispetto al pattern nested-Pie di recharts e romperebbe la coerenza con `ChartContainer`/`ChartTooltip` già usati in tutta la sezione Spese.

## Legenda e layout della card

Card unica (sostituisce sia la vecchia card `CategoryBreakdown` sia la card del donut in `ExpenseCharts`):

- **Desktop**: grafico a sinistra (colonna a larghezza fissa, `aspect-square max-h-56` come oggi), legenda a destra che occupa lo spazio restante.
- **Mobile**: grafico sopra, legenda sotto, impilati.
- **Ogni riga legenda** (una per categoria, stesso ordinamento del layer esterno della torta):
  - `CategoryAvatar` (colore/icona categoria) + nome — riuso diretto del markup esistente in `CategoryBreakdownRow`.
  - Importo speso nel periodo (testo, come oggi).
  - Input budget mensile editabile inline: **riuso as-is** della logica esistente in `CategoryBreakdownRow` (commit on-blur, stato saving/error via `useUpsertBudgetMutation`, validazione: vuoto/non numerico/negativo rifiutato, ripristino valore precedente).
  - **Badge % saturazione budget** = `amount / budgetAmount × 100`, arrotondata. Se `budgetAmount === 0` → testo `—` (nessuna divisione per zero). Stile badge: `text-neg`/`bg-neg-soft` se ≥ 100% (sopra budget, coerente con i token neg/pos già usati per importi negativi altrove nell'app), altrimenti stile neutro (`text-muted-foreground`).
  - **Badge % sul totale speso** = `amount / totaleSpesoPeriodo × 100`, arrotondata. Se il totale speso nel periodo è 0 → `—`.
- Categorie con `amount === 0` mostrano comunque la riga (utile per vedere il budget assegnato anche se non ancora speso in questo periodo), con "€0 speso" e percentuali a `—` dove non calcolabili (0/budget = 0% è comunque calcolabile e mostrato normalmente, cambia solo il caso 0/0 sul totale se non ci fosse proprio nessuna spesa nel periodo).

## Riordino pagina

Nuovo ordine in `app/(app)/spese/page.tsx`:

1. Header (titolo, intervallo periodo, link "Gestisci categorie", chip "Da categorizzare", selettore periodo) — invariato.
2. `ExpensesKpiCards` — invariato.
3. **Nuovo**: `CategoryBreakdownDonut` (torta multilivello + legenda budget/percentuali) — sostituisce sia la vecchia `CategoryBreakdown` sia la card donut di `ExpenseCharts`.
4. **Spostata**: Card lista transazioni (con riepilogo uscite/escluse/spese effettive in testa) + `AddTransactionForm` in coda — stessa struttura interna di oggi, solo posizione nella pagina cambiata (da ultima a qui).
5. **Rinominata**: Card `ExpenseTrendChart` (ex `ExpenseCharts`, solo bar chart "Andamento ultimi 6 mesi") — resta da sola, non più affiancata al donut.

## Testing

- Nessun nuovo modulo di calcolo puro da testare (nessuna modifica a `lib/calc/expenses.ts`).
- Aggiungere test per l'ordinamento/aggregazione dati del nuovo componente se la logica di ordinamento/percentuali viene estratta in una funzione pura separata dal componente React (da valutare in fase di piano — se resta inline nel componente, coprire con verifica manuale/build invece che unit test, secondo la stessa convenzione già usata per `CategoryBreakdown` esistente, che non ha test dedicati).
- Verifica manuale in browser richiesta per: allineamento angolare torta interno/esterno, leggibilità legenda su mobile, editing budget invariato, badge percentuali con casi limite (budget 0, spesa 0, saturazione >100%).

## Fuori scope

- Nessuna modifica a `lib/calc/expenses.ts` o alle route API.
- Nessuna modifica al meccanismo "Dividi" (`SplitSlider`) o a `TransactionRow`.
- Nessuna modifica alla sezione Budget separata (rimandata, vedi `CLAUDE.md` — "In corso ora").

## Addendum 2026-07-22 — legenda scrollabile e icone nelle fette

Feedback dell'utente dopo la prima implementazione (5/5 task, review finale approvata, non ancora mergiata): con molte categorie la legenda occupa molto più spazio verticale del grafico, sbilanciando la card; inoltre l'icona categoria (già visibile in legenda tramite `CategoryAvatar`) sarebbe utile leggerla direttamente nelle fette dell'anello esterno per un riconoscimento più immediato.

Due modifiche, entrambe circoscritte a `category-breakdown-donut.tsx`:

1. **Legenda con altezza massima e scroll interno**: il contenitore della legenda (`div.divide-y` in `CategoryBreakdownDonut`) riceve `max-h-56 overflow-y-auto` (224px, stessa altezza del grafico `aspect-square max-h-56`), così il grafico resta sempre alla stessa proporzione visiva rispetto alla legenda indipendentemente dal numero di categorie. Scrollbar nativa del browser, nessun nuovo stile custom (non serve replicare il trattamento scrollbar dedicato di `.sidebar-nav` per questo caso).
2. **Icona categoria nelle fette dell'anello esterno**: tramite il prop `label` di recharts sul `<Pie>` esterno (funzione custom, non il default), che riceve `cx`, `cy`, `midAngle`, `innerRadius`, `outerRadius`, `percent`, `payload` per ciascuna fetta. La funzione:
   - Calcola la posizione al centro radiale della fetta: `radius = innerRadius + (outerRadius - innerRadius) / 2`, poi `x`/`y` da `cx`/`cy` + `radius * cos/sin(-midAngle in radianti)`.
   - Nasconde l'icona (ritorna `null`) se `percent < 0.05` (soglia 5% sul totale — `percent` di recharts per il layer esterno è già `amount / sommaLayerEsterno`, e la somma del layer esterno coincide col totale speso nel periodo essendo filtrato a `amount > 0`, quindi stessa base di calcolo della "% sul totale" già mostrata in legenda).
   - Renderizza l'icona Lucide della categoria (stessa mappa `ICON_MAP` già esportata da `components/domain/categories/category-avatar.tsx`, riusata qui — non duplicata) dentro un `<g transform="translate(...)">`, colore fisso `className="text-white"` (contrasto garantito su qualunque colore fetta, dato che i fill di `SWATCH_CHART_COLOR` sono tutti toni medi 400-500; nessuna variazione light/dark necessaria perché il fill della fetta stessa non varia per tema).
   - `labelLine={false}` sul `<Pie>` esterno per disattivare la linea di connessione automatica di recharts (non serve, l'icona è già dentro la fetta).
   - Il layer interno (`fissa`/`variabile`) **non** riceve questo trattamento — resta senza icone, invariato.

Nessuna nuova funzione di calcolo pura necessaria (il filtro 5% usa direttamente il `percent` fornito da recharts, non richiede una funzione testabile separata — è puro passthrough di un dato già calcolato dalla libreria). Nessun impatto sulla legenda, sull'editing budget, o sull'ordinamento già implementati.
