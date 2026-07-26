# Andamento ultimi 6 mesi: ricalcolo top/ordine mese per mese

Data: 2026-07-24

## Contesto

Segue `docs/superpowers/specs/2026-07-23-spese-trend-stacked-categorie-design.md` (stacked bar per categoria in Andamento 6 mesi), il cui codice è già stato implementato e revisionato (worktree `spese-trend-stacked-categorie`, commit `d71c89b`/`6627165`/fix successivi). Quella spec sceglieva esplicitamente un ranking calcolato **una sola volta sull'intero semestre**, così che ogni categoria occupasse sempre lo stesso segmento/colore/posizione tra un mese e l'altro.

Richiesta esplicita dell'utente in questa sessione: "ordina i valori sempre in maniera decrescente". Chiarito con domande mirate che si intende:
- l'ordine di impilamento dentro ogni singola barra segue il valore di **quel mese specifico**, non il totale semestrale;
- anche **quali categorie ottengono un segmento proprio** (non solo l'ordine) va ricalcolato mese per mese, non fissato una volta sul totale semestre;
- il segmento con la spesa più alta del mese va in **fondo** alla barra (vicino all'asse);
- **nessuna legenda fissa** sotto al grafico (l'identificazione avviene solo via tooltip, dato che composizione e ordine cambiano ogni mese).

Questa spec **sostituisce** la sezione "Livello dati" e "Componente UI" della spec del 2026-07-23 (il resto — contesto generale, motivazione dello stacked bar, aggregazione "Altro" per leggibilità — resta valido).

## Livello dati (`lib/calc/expenses.ts`)

Sostituisce `computeCategoryMonthlyTrend`/`MonthlyCategoryTotal`/`CategoryTrendSeries`/`CategoryMonthlyTrend` (introdotte il 2026-07-23) con una nuova funzione a semantica diversa. Nessun altro file oltre a `expense-trend-chart.tsx`/`page.tsx` consuma questi tipi: rimozione pulita, non serve deprecare.

```ts
export interface MonthlyStackSegment {
  key: string;    // categoryId, o "altro"
  name: string;   // nome categoria, o "Altro"
  color: string;  // CategoryColor (palette condivisa), o sentinel "altro" gestito a parte nel componente
  amount: number; // spesa effettiva positiva di quel mese
}

export interface MonthlyCategoryStack {
  year: number;
  month: number;
  label: string;
  segments: MonthlyStackSegment[]; // ordine decrescente per amount; index 0 = importo più alto = base della barra
}

export function computeCategoryMonthlyStacks(
  transactions: Transaction[],
  categories: Category[],
  referenceDate: Date,
  topCount = 6
): MonthlyCategoryStack[]
```

Logica, per ciascuno dei 6 mesi calendariali **indipendentemente dagli altri** (stesso schema di iterazione di `compute6MonthTrend`/la funzione precedente: `i` da 5 a 0, `addMonths(referenceDate, -i)`, range pieno `startOfMonth`..`endOfMonth`):

1. Calcola la spesa effettiva di quel mese per ciascuna categoria dell'utente (`computeSummary` filtrando per `categoryId`, stesso helper riusato).
2. Scarta le categorie con spesa 0 quel mese.
3. Ordina le rimanenti per importo discendente; le prime `topCount` diventano segmenti individuali.
4. Se esistono categorie oltre le prime `topCount` (con spesa > 0 quel mese), somma la loro spesa in un segmento aggregato `{ key: "altro", name: "Altro", color: "altro", amount: somma }`. Se non ce ne sono, nessun segmento "Altro" quel mese.
5. **Riordina insieme** i segmenti individuali + l'eventuale "Altro" per importo discendente (l'aggregato "Altro" non è fissato in coda: se quel mese la sua somma supera una o più categorie individuali, si posiziona di conseguenza più in alto in classifica). Questo è l'array finale `segments` del mese.

Non esiste più un ranking unico condiviso tra mesi: la stessa categoria può avere colore sempre coerente (`category.color` è una proprietà fissa della categoria) ma posizione nello stack diversa da un mese all'altro, e può comparire come segmento proprio in un mese e finire dentro "Altro" in un altro mese (o non comparire affatto se quel mese ha spesa 0).

`compute6MonthTrend` resta invariata (non toccata da questo cambiamento, come già garantito dalla spec precedente).

## Componente UI (`components/domain/expenses/expense-trend-chart.tsx`)

- Props: `monthlyStacks: MonthlyCategoryStack[]` (sostituisce `monthlyCategoryTrend: CategoryMonthlyTrend`), `currency: string` (invariato).
- **Nessuna legenda** sotto al grafico (rimossa rispetto all'implementazione attuale): con composizione/ordine che cambiano ogni mese, una legenda fissa non avrebbe un mapping stabile posizione→categoria da mostrare.
- Dati chart, per rendering "a slot posizionali" (necessario perché recharts determina l'ordine di stacking dall'ordine di dichiarazione dei componenti `<Bar>`, condiviso da **tutte** le barre del grafico — non esiste un modo nativo di avere un ordine diverso per ogni mese con un `<Bar>` per categoria):
  - `maxSlots = Math.max(...months.map(m => m.segments.length))` (0 se nessun mese ha segmenti).
  - Ogni riga dati mensile porta, oltre a `label`: `pos{i}Amount`, `pos{i}Name`, `pos{i}Color`, `pos{i}Key` per `i` da 0 a `maxSlots - 1` (assenti/`undefined` se quel mese ha meno segmenti di `maxSlots` — niente segmento renderizzato per quello slot quel mese), più il riferimento diretto `segments` (l'array originale di quel mese, per il tooltip custom sotto).
  - Un `<Bar dataKey={`pos${i}Amount`} stackId="trend">` per ogni slot `i` da 0 a `maxSlots - 1` (slot 0 dichiarato per primo → base della barra, coerente con "il più alto in fondo"). Colore per singolo mese via `<Cell fill={...} />` per riga (stesso pattern già usato in `CategoryBreakdownDonut`): `SWATCH_CHART_COLOR[posColor as CategoryColor]` per categorie reali, `var(--muted-foreground)` per "altro", `"transparent"` se lo slot non esiste quel mese.
- **Tooltip custom** (non il `formatter` di `ChartTooltipContent`, pensato per serie con nome fisso — qui il nome per slot cambia ogni mese): componente locale che riceve `active`/`payload`/`label` da recharts, legge `payload[0]?.payload.segments` (la riga dati completa del mese sotto hover) e renderizza una riga per ogni segmento reale — stesso stile visivo already in uso altrove nel file (nome mutato + importo in valuta, mono, nessun pallino colore), senza righe vuote per slot non usati quel mese.
- `ChartContainer` riceve un `config: ChartConfig` minimale/vuoto (`{}`): colori e nomi sono interamente data-driven via `Cell`/tooltip custom, non serve più la mappa statica `chartConfig` costruita da `series`.

## Integrazione (`app/(app)/spese/page.tsx`)

Sostituire `computeCategoryMonthlyTrend(filteredTransactions, safeCategories, referenceDate)` con `computeCategoryMonthlyStacks(filteredTransactions, safeCategories, referenceDate)`, passato come `monthlyStacks` a `ExpenseTrendChart`.

## Edge case

- Nessuna spesa nel semestre (utente nuovo, o dopo un filtro categoria): tutti i mesi con `segments: []`, `maxSlots = 0`, nessun `<Bar>` renderizzato, barre vuote — stesso comportamento a vuoto già presente prima.
- Filtro categoria attivo in pagina (`filterTransactions`, applicato a monte): le transazioni arrivano già ristrette a quella categoria, quindi ogni mese ha al massimo un segmento (quella categoria), mai "Altro" (non esistono altre categorie nelle transazioni filtrate).
- Mese con meno categorie attive del massimo del semestre: barra visivamente più bassa quel mese (riflette la spesa reale minore), non segmenti vuoti/fantasma.
- "Altro" che supera una categoria "top" quel mese: si posiziona più in basso nello stack di quella categoria (vedi punto 5 della logica dati) — comportamento intenzionale, non un bug.

## Test

Sostituiscono i test di `computeCategoryMonthlyTrend` (2026-07-23) in `lib/calc/expenses.test.ts`, per `computeCategoryMonthlyStacks`:
- ranking indipendente per mese: due mesi con categorie/importi diversi producono `segments` diversi (composizione e/o ordine), non un ranking fisso sul totale semestre;
- "Altro" che supera una categoria top in un mese specifico si posiziona di conseguenza nell'array `segments` (non fissato in coda);
- mese con meno categorie del `topCount`: `segments` più corto, nessuna chiave fantasma;
- nessuna categoria/transazione: 6 mesi con `segments: []`;
- nessuna regressione su `compute6MonthTrend` (invariata).

## Fuori scope (esplicitamente escluso)

- Animazione di transizione tra un ordine mensile e il successivo (recharts anima già i cambi di altezza/posizione di default tra render; nessuna richiesta di comportamento custom).
- Indicazione visiva nel grafico di "questa categoria è cambiata posizione rispetto al mese scorso" — fuori scope, non richiesto.
- Rimozione di `compute6MonthTrend` (resta per eventuali usi futuri del solo totale).
