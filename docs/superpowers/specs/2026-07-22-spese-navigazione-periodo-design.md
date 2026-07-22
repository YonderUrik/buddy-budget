# Navigazione periodo in Spese

Data: 2026-07-22

## Contesto

La schermata Spese (`app/(app)/spese/page.tsx`) ha un selettore Settimana/Mese/3 mesi/Anno (`ExpensesPeriodSelector`), ma `referenceDate` è sempre `new Date()` fisso — non esiste modo di vedere mesi/periodi passati o futuri (entro il limite "non oltre oggi"). L'utente vuole poter cambiare mese (es. passare da Luglio a Giugno) e, generalizzando, farlo per qualunque tipo di periodo selezionato.

## Problema architetturale da risolvere

`referenceDate` oggi serve due scopi diversi dentro `computeKpis` e `computeCategoryBreakdown` (`lib/calc/expenses.ts`):

1. **Quale periodo mostrare** — input di `getPeriodRange(period, referenceDate)`.
2. **"Oggi", per il taglio giorni-trascorsi** — dentro `computeKpis`, `elapsedRange.to = min(range.to, referenceDate-come-oggi)`.

Se `referenceDate` diventa navigabile e resta l'unico parametro, un mese passato calcolerebbe "giorni trascorsi"/"media giornaliera" come se quel mese fosse ancora in corso fino al giorno-del-mese corrente, invece di considerarlo interamente concluso. Dato sbagliato in un'app finanziaria.

**Fix**: separare i due ruoli in due parametri distinti passati alle funzioni di calcolo:
- `referenceDate` — il periodo che l'utente sta guardando (naviga avanti/indietro)
- `today` — `new Date()` reale, sempre, usato solo per il taglio giorni-trascorsi

Le funzioni `computeKpis` e `computeCategoryBreakdown` in `lib/calc/expenses.ts` cambiano firma per accettare `today` come parametro esplicito separato (non più dedotto da `referenceDate`). `compute6MonthTrend` resta con un solo parametro: l'andamento 6 mesi segue la vista corrente (se navighi a Marzo, mostra gli ultimi 6 mesi fino a Marzo), non serve distinguerlo da "oggi".

## Nuove funzioni pure (`lib/calc/expenses.ts`)

### `shiftReferenceDate(period: ExpensePeriod, referenceDate: Date, direction: 1 | -1): Date`

Sposta `referenceDate` di un'unità di periodo:
- `settimana`: ±7 giorni
- `mese`: ±1 mese
- `3mesi`: ±3 mesi
- `anno`: ±1 anno

Riusa gli helper interni già esistenti (`addDays`, `addMonths`) con lo stesso pattern di `getPreviousPeriodRange`.

### Blocco navigazione futura

Nessuna nuova funzione dedicata: il componente calcola `getPeriodRange(period, referenceDate).to >= startOfDay(today reale)` per disabilitare il pulsante "next" (periodo corrente o oltre = non si va oltre). `startOfDay` va esportata da `lib/calc/expenses.ts` (oggi è locale al modulo) oppure replicata nel componente — si esporta per evitare duplicazione.

### Etichetta periodo

Nuova funzione `formatPeriodLabel(period: ExpensePeriod, range: DateRange): string`, formattazione in italiano:
- `mese`: `"Luglio 2026"` (nome mese esteso + anno)
- `settimana`: `"21–27 lug"` (stesso anno) o `"28 dic – 3 gen"` (a cavallo d'anno, mostra entrambi gli anni se diversi: `"28 dic 2026 – 3 gen 2027"`)
- `3mesi`: `"Mag – Lug 2026"` (mese abbreviato inizio – mese abbreviato fine + anno fine; se a cavallo d'anno mostra entrambi gli anni)
- `anno`: `"2026"`

Usa `Intl.DateTimeFormat("it-IT", ...)` per i nomi mese, coerente col resto del codice (`app/(app)/spese/page.tsx` già usa `Intl.DateTimeFormat("it-IT", ...)`).

Questa label sostituisce l'attuale sottotitolo range-date sotto il titolo "Spese" in `page.tsx` (righe 76-79) — non coesistono due rappresentazioni testuali dello stesso range.

## Nuovo componente: `ExpensesReferenceNav`

`components/domain/expenses/expenses-reference-nav.tsx`. Props:

```ts
export interface ExpensesReferenceNavProps {
  period: ExpensePeriod;
  referenceDate: Date;
  onChange: (newReferenceDate: Date) => void;
}
```

Rende: `‹ [label cliccabile] ›`. Le frecce chiamano `onChange(shiftReferenceDate(period, referenceDate, ±1))`. La freccia "next" è disabilitata secondo la regola di blocco futuro sopra.

Click sulla label apre un popover (nuovo primitive shadcn `components/ui/popover.tsx`, da aggiungere con `pnpm dlx shadcn@latest add popover`) con:
- frecce `‹ 2026 ›` per cambiare anno (anno futuro disabilitato)
- griglia 3×4 dei 12 mesi abbreviati (stessi label di `MONTH_LABELS`, che va esportata da `lib/calc/expenses.ts`), mese futuro (rispetto a oggi reale) disabilitato

Selezionare un mese chiama `onChange(new Date(year, month, 1))` — il periodo attivo (Settimana/Mese/3 mesi/Anno) si ricalcola sopra quella nuova data tramite `getPeriodRange`, invariato.

Il componente vive in `components/domain/expenses/index.ts` (barrel) accanto agli altri.

## Modifiche a `page.tsx`

- `referenceDate` da `useMemo` costante a `useState<Date>(() => new Date())`.
- Aggiunto `const today = React.useMemo(() => new Date(), [])` per il parametro "oggi reale" passato a `computeKpis`/`computeCategoryBreakdown` (via `ExpensesKpiCards` e il calcolo category breakdown inline).
- Sottotitolo sotto "Spese" sostituito da `formatPeriodLabel(period, range)` dentro `ExpensesReferenceNav`, che si posiziona nell'header accanto a `ExpensesPeriodSelector`.
- `fetchWindow(referenceDate)` resta identica nella firma — si sposta automaticamente seguendo `referenceDate` navigato, nessuna modifica necessaria.

## Modifiche a `ExpensesKpiCards`

Aggiunge prop `today: Date` (nuovo, richiesto, non opzionale — obbliga il chiamante a passarlo esplicitamente invece di un default silenzioso che potrebbe nascondere l'errore concettuale corretto in questo design). `computeKpis(transactions, budgets, period, referenceDate, today)`.

## Cosa NON cambia

- `ExpensesPeriodSelector` (pillole Settimana/Mese/3 mesi/Anno): invariato.
- `CategoryBreakdownDonut`, `ExpenseTrendChart`, `TransactionRow`, `AddTransactionForm`: invariati (ricevono già dati calcolati, non conoscono `referenceDate` direttamente se non tramite le funzioni di calcolo già navigate).
- Nessuna modifica al modello dati/API — tutto lato client, la finestra di fetch già copre l'intervallo necessario seguendo `referenceDate`.

## Testing

- `lib/calc/expenses.test.ts`: nuovi test per `shiftReferenceDate` (tutti e 4 i tipi periodo, incluso cambio anno per `mese`/`anno` a cavallo confine) e `formatPeriodLabel` (tutti e 4 i tipi, incluso caso a cavallo d'anno per `settimana`/`3mesi`).
- `computeKpis`/`computeCategoryBreakdown`: aggiornare i test esistenti alla nuova firma con `today` esplicito; aggiungere un caso con `referenceDate` nel passato (mese concluso) che verifica `giorniRimasti = 0` e `mediaGiornaliera` calcolata sull'intero mese, non troncata a "oggi".
- Nessun test browser automatizzato disponibile in questo ambiente (nessun Postgres/Redis) — verifica manuale utente richiesta dopo l'implementazione, come per le feature precedenti di Spese.
