# Andamento ultimi 6 mesi: stacked bar per categoria

Data: 2026-07-23

## Contesto

Il grafico "Andamento ultimi 6 mesi" in Spese (`components/domain/expenses/expense-trend-chart.tsx`) mostra oggi una barra singola per mese con il totale speso (`compute6MonthTrend` in `lib/calc/expenses.ts`). Richiesta utente: aggiungere il breakdown per categoria, come uno stacked bar (barre impilate per categoria invece di un unico colore).

## Decisioni

- Lo stacked bar **sostituisce** il bar chart a barra singola attuale (non convive con esso).
- Con utenti che possono avere 15-20+ categorie, mostrare tutte le categorie come segmenti separati renderebbe grafico e legenda illeggibili. Si mostrano le **top 6** categorie (per spesa totale nel semestre) come segmenti propri, il resto aggregato in un segmento **"Altro"**.
- Il ranking top 6 è calcolato una volta sull'intero semestre (non per singolo mese), cosà che ogni categoria occupi sempre la stessa "fetta" visiva mese per mese — evita che le categorie cambino posizione/colore da una barra all'altra.

## Livello dati (`lib/calc/expenses.ts`)

Nuova funzione pura, accanto a `compute6MonthTrend` (che resta invariata, usata altrove/in futuro se serve il solo totale):

```ts
export interface MonthlyCategoryTotal {
  year: number;
  month: number;
  label: string;
  amounts: Record<string, number>; // chiave = CategoryTrendSeries.key, valore = spesa effettiva positiva
}

export interface CategoryTrendSeries {
  key: string;       // categoryId, o "altro"
  name: string;      // nome categoria, o "Altro"
  color: string;      // CategoryColor (token palette condivisa), o "altro" gestito a parte nel componente
}

export interface CategoryMonthlyTrend {
  months: MonthlyCategoryTotal[];
  series: CategoryTrendSeries[]; // ordine di stacking: rank discendente per spesa totale semestre, "altro" sempre ultimo
}

export function computeCategoryMonthlyTrend(
  transactions: Transaction[],
  categories: Category[],
  referenceDate: Date,
  topCount = 6
): CategoryMonthlyTrend
```

Logica:
1. Per ciascuno dei 6 mesi calendariali (stesso schema di `compute6MonthTrend`: `i` da 5 a 0, `addMonths(referenceDate, -i)`, range pieno `startOfMonth`..`endOfMonth`, **nessun clamp su `today`** — coerente con `compute6MonthTrend`, dato che transazioni future non esistono nella pratica), calcola la spesa effettiva per ciascuna categoria dell'utente con `computeSummary` filtrando le transazioni per `categoryId`.
2. Somma il totale per categoria sull'intero semestre (across dei 6 mesi).
3. Ordina le categorie per totale semestrale discendente, prende le prime `topCount` come serie proprie.
4. Se esistono categorie oltre le prime `topCount` con totale semestrale > 0, aggrega la loro spesa mensile in una serie aggiuntiva `{ key: "altro", name: "Altro", color: "altro" }`, aggiunta in coda a `series`. Se non ce ne sono, `altro` non compare affatto (né in `series` né nelle chiavi di `amounts`).
5. `amounts` di ogni mese ha una chiave per ogni `series.key` risultante (comprese quelle a 0, per rendering uniforme).

Nessuna modifica a `compute6MonthTrend` esistente: resta disponibile se in futuro serve solo il totale.

## Componente UI (`components/domain/expenses/expense-trend-chart.tsx`)

- Props: `monthlyCategoryTrend: CategoryMonthlyTrend` (sostituisce `monthlyTrend: MonthlyTotal[]`), `currency: string` (invariato).
- Dati chart: un oggetto per mese con `label` + le chiavi di `amounts` spread (`{ label, ...month.amounts }`).
- Un `<Bar>` recharts per ogni `series`, tutti con `stackId="trend"`, nell'ordine di `series` (quindi "Altro", se presente, è il segmento più in alto).
  - Colore: `SWATCH_CHART_COLOR[entry.color as CategoryColor]` per le categorie reali (stesso helper già usato da `CategoryBreakdownDonut`).
  - Colore fisso `var(--muted-foreground)` per la serie `altro` (non uno swatch, per non essere confuso con una categoria reale che abbia quel colore).
- Tooltip: riusa il pattern esistente `tooltipValueFormatter` (nome + importo in valuta); `ChartTooltipContent` di shadcn mostra già una riga per ogni serie attiva nel punto hover, nessuna modifica necessaria a quel meccanismo.
- Legenda propria sotto al grafico: una riga per serie con pallino colorato (stesso colore della serie) + nome. Nessuna interattività (click-to-filter, toggle visibilità) — fuori scope, non richiesto.
- `ChartConfig` costruito dinamicamente da `series` (necessario perché le chiavi sono dinamiche, a differenza di `TREND_CONFIG` statico attuale).

## Integrazione (`app/(app)/spese/page.tsx`)

Sostituire la chiamata a `compute6MonthTrend(filteredTransactions, referenceDate)` (riga 200) con `computeCategoryMonthlyTrend(filteredTransactions, categories, referenceDate)`, passando il risultato come `monthlyCategoryTrend` a `ExpenseTrendChart`.

## Edge case

- Nessuna spesa nel semestre (per l'utente o dopo un filtro categoria): `series` vuoto, chart vuoto, nessuna legenda — stesso comportamento attuale con dati vuoti.
- Filtro categoria attivo in pagina (`filterTransactions`, già applicato a monte): le transazioni arrivano già ristrette a quella categoria, quindi lo stacked bar mostra naturalmente solo quella singola serie (mai un segmento "Altro" in quel caso, dato che non esistono altre categorie nelle transazioni filtrate).
- Categorie con nome/colore duplicato tra loro: non è un caso nuovo introdotto da questa feature (già possibile oggi in Categorie), nessuna gestione speciale necessaria.

## Test

Nuovo test in `lib/calc/expenses.test.ts` per `computeCategoryMonthlyTrend`: ranking top N corretto, aggregazione "Altro" corretta (presente/assente), coerenza chiavi tra mesi, nessuna regressione su `compute6MonthTrend` esistente (invariata).

## Fuori scope (esplicitamente escluso)

- Click sulla legenda per filtrare/evidenziare una serie.
- Rimozione di `compute6MonthTrend` (resta per eventuali usi futuri del solo totale).
- Modifica del meccanismo di filtro categoria/testo esistente.
