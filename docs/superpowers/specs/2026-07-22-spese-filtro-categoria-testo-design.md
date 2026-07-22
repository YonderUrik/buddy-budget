# Spese — filtro per categoria e per testo

Data: 2026-07-22

## Obiettivo

Nella schermata Spese, permettere di filtrare le transazioni per categoria e/o per testo libero (descrizione). Il filtro è **globale**: ricalcola non solo la lista transazioni ma anche KPI, torta multilivello "Per categoria" e grafico "Andamento 6 mesi", per una vista coerente end-to-end sui dati filtrati.

## Architettura / data flow

Nuovo stato locale in `app/(app)/spese/page.tsx`:

```ts
const [categoryFilter, setCategoryFilter] = React.useState<string | null>(null); // null = tutte le categorie
const [searchText, setSearchText] = React.useState("");
```

Nuova funzione pura in `lib/calc/expenses.ts`:

```ts
export interface TransactionFilter {
  categoryId: string | null;
  searchText: string;
}

export function filterTransactions(
  transactions: Transaction[],
  filter: TransactionFilter
): Transaction[]
```

Comportamento:
- `categoryId` non null → mantiene solo transazioni con `categoryId` esattamente uguale.
- `searchText` non vuoto (dopo trim) → mantiene solo transazioni la cui `description` contiene la stringa, confronto case-insensitive (`.toLocaleLowerCase()`).
- Entrambi i filtri si applicano in AND.
- Nessun filtro impostato → passthrough (stesso array, comportamento attuale).

`page.tsx` calcola `filteredTransactions = filterTransactions(safeTransactions, { categoryId: categoryFilter, searchText })` e lo passa **al posto di** `safeTransactions` a:
- `ExpensesKpiCards` (prop `transactions`)
- `computeCategoryBreakdown` / `computeFixedVsVariable` (per `CategoryBreakdownDonut`)
- `compute6MonthTrend` (per `ExpenseTrendChart`)
- `computeSummary` (riepilogo uscite/escluse/spese effettive sopra la lista)
- base per `transactionsInPeriodAll` → lista transazioni (invariato il resto della pipeline: filtro periodo, poi eventuale `showUncategorizedOnly`)

**Budget scoping**: quando `categoryFilter` è impostato, `ExpensesKpiCards` riceve `budgets: safeBudgets.filter(b => b.categoryId === categoryFilter)` invece di `safeBudgets` — così "Budget rimanente" confronta lo speso filtrato col budget della sola categoria selezionata. Nessuna modifica di firma alle funzioni in `lib/calc/expenses.ts`, solo cosa gli passa `page.tsx`.

Il toggle esistente `showUncategorizedOnly` (chip "Da categorizzare") **resta indipendente**, applicato in AND dopo `filterTransactions`, esattamente come oggi si applica dopo il filtro periodo. Nessuna unificazione dei due meccanismi (scelta esplicita: combinare categoria specifica + "Da categorizzare" può dare lista vuota, accettato come edge case noto).

## Componente UI

Nuovo `components/domain/expenses/expenses-filter-bar.tsx`:

```ts
export interface ExpensesFilterBarProps {
  categories: Category[];
  categoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  searchText: string;
  onSearchTextChange: (text: string) => void;
}
```

- `Select` categoria: opzione "Tutte le categorie" (sentinel value interno, mappata a `null` verso l'esterno) + una `SelectItem` per categoria con `CategoryAvatar` + nome, stesso pattern visivo già usato in `TransactionRow` per il select categoria della riga.
- `Input` testo: placeholder "Cerca per descrizione...", `onChange` diretto (nessun debounce — filtro client-side su dataset già in memoria, nessuna chiamata di rete).
- Nessuna dipendenza hardcoded: tutto arriva da props, componente riusabile.
- Esportato dal barrel `components/domain/expenses/index.ts`.

Posizionamento in `page.tsx`: nuova riga sotto l'header esistente (titolo/periodo/link categorie/chip uncategorized), sopra le KPI cards.

## Edge case

- Filtri attivi con zero risultati nel periodo → messaggio lista aggiornato: se `categoryFilter !== null || searchText.trim() !== ""`, mostra "Nessuna transazione corrisponde ai filtri applicati in questo periodo" invece del messaggio attuale "Nessuna transazione in questo periodo...".
- Categoria filtrata senza budget impostato → `budgetTotale` KPI = 0, `budgetRimanente` = `-speso` se c'è spesa: comportamento già esistente della formula, nessun caso speciale da aggiungere.
- Reset filtri: nessun bottone dedicato — si torna a "Tutte le categorie" dal select e si svuota l'input testo manualmente.

## Test

Unit test in `lib/calc/expenses.test.ts` per `filterTransactions`:
- nessun filtro → passthrough
- solo categoria
- solo testo (case-insensitive, substring)
- categoria + testo combinati (AND)
- nessun match → array vuoto

## Fuori scope

- Filtro per intervallo di importo o per source (auto/manuale) — non richiesto.
- Multi-selezione categorie — deciso esplicitamente singola selezione.
- Persistenza dei filtri tra sessioni/URL — non richiesta, stato locale del componente pagina.
