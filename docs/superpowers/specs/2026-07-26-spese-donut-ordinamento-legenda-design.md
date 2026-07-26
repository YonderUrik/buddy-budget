# Design: ordinamento configurabile legenda "Per categoria"

Data: 2026-07-26

## Contesto

`CategoryBreakdownDonut` (schermata Spese, blocco "Per categoria") mostra un donut multilivello e una legenda scrollabile sotto/accanto. Oggi la legenda usa `sortCategoryAmounts` (`components/domain/expenses/category-breakdown-donut.utils.ts`): ordina per tipo (fissa prima di variabile), poi per importo speso decrescente dentro ogni gruppo. Nessun controllo utente per cambiare l'ordinamento.

Richiesta: aggiungere un ordinamento scelto dall'utente (percentuale sul totale come default, ma anche valore assoluto, budget, nome), con direzione asc/desc.

## Scope

- Riguarda **solo la legenda** sotto il donut. Le fette dell'anello esterno del donut restano ordinate come oggi (`sortCategoryAmounts`, tipo poi valore) — nessuna modifica al donut stesso.
- Il raggruppamento per tipo (fissa/variabile) nella legenda **viene rimosso**: il nuovo ordinamento produce una lista piatta, indipendente dal tipo.

## Stato component

Due nuovi `useState` in `CategoryBreakdownDonut`:

```ts
type LegendSortCriterion = "percentuale" | "valore" | "budget" | "nome";
type LegendSortDirection = "asc" | "desc";

const [sortCriterion, setSortCriterion] = React.useState<LegendSortCriterion>("percentuale");
const [sortDirection, setSortDirection] = React.useState<LegendSortDirection>("desc");
```

Default per criterio quando cambia selezione (reset automatico della direzione, non manuale):

| Criterio | Direzione default |
|---|---|
| percentuale | desc |
| valore | desc |
| budget | desc |
| nome | asc |

Handler cambio criterio:

```ts
function handleCriterionChange(next: LegendSortCriterion) {
  setSortCriterion(next);
  setSortDirection(DEFAULT_DIRECTION[next]);
}
```

Il toggle asc/desc è un bottone separato che inverte `sortDirection` senza toccare `sortCriterion`.

## Util: `sortLegendEntries`

Nuova funzione pura in `category-breakdown-donut.utils.ts`, testata in isolamento come le esistenti.

```ts
export interface LegendEntry extends CategoryAmount {
  budgetAmount: number;
  saturazionePct: number | null;
  quotaPct: number | null;
}

export function sortLegendEntries(
  entries: LegendEntry[],
  criterion: LegendSortCriterion,
  direction: LegendSortDirection
): LegendEntry[]
```

Semantica criteri:
- `"percentuale"` → `quotaPct` (percentuale sul totale speso, badge esistente "% totale")
- `"valore"` → `amount` (importo speso assoluto)
- `"budget"` → `saturazionePct` (percentuale di saturazione budget, badge esistente "% budget" — non l'importo budget impostato)
- `"nome"` → `name` (alfabetico, `localeCompare`)

Regola valori `null` (`saturazionePct`/`quotaPct` null quando budget=0 o totale=0): vanno **sempre in fondo alla lista**, indipendentemente dalla direzione scelta. Confronto: se uno dei due valori è `null` e l'altro no, quello `null` perde sempre (va dopo); se entrambi `null`, ordine stabile tra loro (nessun criterio secondario).

Per il criterio `"nome"` non esistono valori null, comparazione diretta con `localeCompare("it")`.

## Component: enrichment pre-sort

Oggi `budgetFor`/`computeBudgetStats` sono chiamati dentro il loop di render per ogni riga. Per poter ordinare per budget/percentuale serve calcolarli **prima** di ordinare, su tutte le categorie:

```ts
const enrichedEntries: LegendEntry[] = categoryAmounts.map((entry) => {
  const budgetAmount = budgetFor(entry.categoryId);
  const { saturazionePct, quotaPct } = computeBudgetStats(entry.amount, budgetAmount, totalSpeso);
  return { ...entry, budgetAmount, saturazionePct, quotaPct };
});
const sortedLegendEntries = sortLegendEntries(enrichedEntries, sortCriterion, sortDirection);
```

Il rendering della legenda (`sortedLegendEntries.map(...)`) passa `budgetAmount`/`saturazionePct`/`quotaPct` già calcolati a `CategoryLegendRow` invece di ricalcolarli lì — nessuna doppia computazione.

La variabile `sortedEntries` esistente (usata per `outerData` del donut) resta invariata, basata su `sortCategoryAmounts(categoryAmounts)` come oggi.

## UI

Nel `CardHeader`, accanto al titolo "Per categoria":
- `Select` (componente shadcn già in uso nel progetto) con le 4 opzioni: "% sul totale", "Valore speso", "% budget", "Nome"
- Bottone icona (freccia su/giù, `lucide-react`, coerente con le altre icone del progetto) che inverte `sortDirection`, con `aria-label` che descrive lo stato corrente (es. "Ordina decrescente" / "Ordina crescente")

Layout: `CardHeader` passa da solo titolo a `flex items-center justify-between` per ospitare titolo a sinistra, controlli a destra. Su mobile i controlli restano sulla stessa riga (sono compatti: select + un'icona).

## Testing

`category-breakdown-donut.utils.test.ts`: nuovi casi per `sortLegendEntries` — 4 criteri × 2 direzioni, più il caso valori `null` sempre in fondo (sia con `sortCriterion: "percentuale"` che `"budget"`), più stabilità quando tutti null.

Nessuna modifica a schema/API/route — feature interamente client-side su dati già disponibili nel component.

## Fuori scope

- Ordinamento delle fette del donut (resta come oggi).
- Persistenza della preferenza di ordinamento (localStorage o simile) tra sessioni — non richiesto, resetta a "percentuale desc" ad ogni mount.
