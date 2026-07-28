# Design: "Dividi/Escludi" per le entrate

**Data**: 2026-07-28
**Contesto**: dopo il completamento della schermata Cash flow (`docs/superpowers/plans/2026-07-26-cashflow-screen.md`), l'utente ha notato che alcune transazioni "entrata" (importo positivo, es. sincronizzate via GoCardless) potrebbero non essere reddito reale — rimborsi, giroconti tra propri conti, storni — e vuole poterle escludere (in tutto o in parte) dal conteggio, con lo stesso meccanismo già usato per le uscite ("Dividi").

## Problema

Il piano Cash flow (Task 6) aveva esplicitamente nascosto il bottone "Dividi" per le transazioni entrata in `TransactionRow` e in `AutoCategorizeWizard`, assumendo che dividere avesse senso solo per le spese condivise. L'utente chiede invece lo stesso meccanismo, simmetrico, per le entrate: poter escludere una quota (fino all'intero importo) di un'entrata dal conteggio come reddito reale.

## Cosa già esiste (riuso, nessuna modifica)

- Colonna `excludedAmount` su `transactions` (schema, validazione Zod) è già generica sul segno.
- `isValidExcludedAmount` (`lib/db/schema/transactions.ts`) verifica che `excludedAmount` abbia lo stesso segno di `amount` e non lo superi in valore assoluto — funziona identicamente per importi positivi o negativi, nessuna modifica necessaria.
- `effectiveAmount(transaction)` (`lib/calc/expenses.ts`) = `amount - excludedAmount` — già generico sul segno.
- `TransactionRow`: badge "Diviso", importo "Netto", visualizzazione dell'importo effettivo sono già scritti con `Math.abs(...)` e non assumono una direzione — funzionano già correttamente per le entrate, non richiedono modifiche.
- `PATCH /api/transactions/[id]`: accetta già `excludedAmount` per qualunque transazione, nessun guard specifico sulla direzione da rimuovere.

## Cosa cambia

### 1. `components/domain/expenses/transaction-row.tsx`

Rimuovere il guard `{!isIncome && (<bottone Dividi>)}` — il bottone "Dividi" diventa sempre visibile, indipendentemente dalla direzione della transazione. Nessun'altra modifica al componente.

### 2. `components/domain/expenses/split-slider.tsx`

Il componente riceve già `transaction` per intero, quindi può derivare la direzione internamente (`Number(transaction.amount) > 0`). Modifiche:
- Etichetta del campo numerico: "Spesa effettiva" (uscita) / "**Entrata effettiva**" (entrata) — stessa posizione, stesso comportamento (blur/Enter salva), cambia solo il testo.
- Testo esplicativo sopra lo slider: oggi fisso ("Sposta il cursore per escludere una parte dal conteggio: è uscita dal conto, ma non è una spesa (rimborsi, quote di altri, giroconto)."); per le entrate diventa "Sposta il cursore per escludere una parte dal conteggio: è entrata sul conto, ma non è reddito reale (rimborsi, giroconto, storni)."
- Shortcut ÷2/÷3/÷4 e input numerico restano invariati nella logica (`computeSplitExcluded`, `clampExcluded` sono già generici sul valore assoluto).

### 3. `components/domain/expenses/auto-categorize-wizard.tsx`

Stesso trattamento di `transaction-row.tsx`: rimuovere il guard `{!isIncome && (...)}` che nasconde lo slider di split interno al wizard. Etichette dinamiche identiche a quelle di `SplitSlider` ("Entrata effettiva"/"Spesa effettiva" nella riga di riepilogo sotto lo slider). La riga `onConfirm(categoryId, isIncome ? 0 : excluded)` va cambiata in `onConfirm(categoryId, excluded)` — oggi azzera sempre `excludedAmount` per le entrate, va rimosso perché altrimenti l'esclusione impostata nello slider non verrebbe mai salvata.

### 4. `lib/calc/cashflow.ts`

Ogni somma di entrate userà `effectiveAmount(t)` invece di `Number(t.amount)` — stesso pattern già in uso per le uscite in questo stesso file. Punti da modificare:
- `computeCashflowKpis`: `entrate = inRange.filter(isIncome).reduce((sum, t) => sum + effectiveAmount(t), 0)` (nota: `effectiveAmount` per un'entrata resta positivo, quindi la somma non richiede `Math.abs`).
- `computeMonthlySeries`: stesso cambio per `entrate` di ogni mese.
- `computeIncomeSources`: sia `totalEntrate` sia l'accumulo per categoria (`amountByCategoryId`) userizzano `effectiveAmount(t)` invece di `Number(t.amount)`.
- `computeWhereItGoes`: il totale `entrate` del mese (usato come denominatore per le quote % di fisse/variabili/nonClassificato/risparmio) userizza `effectiveAmount(t)`.

Nessuna modifica a `computeAccumulatedSavings` diretta: delega a `computeMonthlySeries`, eredita il fix automaticamente.

`lib/calc/expenses.ts` non richiede modifiche: le entrate sono già escluse da tutti i suoi calcoli (Spese/Transazioni restano uscite-only per i widget KPI/donut/trend, come deciso nel piano Cash flow).

## Cosa NON cambia (fuori scope, deciso esplicitamente)

- Nessuna nuova colonna/flag "non è reddito reale" — si riusa `excludedAmount` esistente, coerentemente con l'istruzione dell'utente di trattarlo "come le spese".
- Nessuna modifica alla creazione di una transazione entrata (`add-transaction-form.tsx`) — lo split resta un'azione post-creazione, come già per le uscite.
- Nessuna modifica a `add-transaction-form.tsx`, `transactions-type-toggle.tsx`, API routes, schema DB.
- Il bottone "Dividi" mantiene lo stesso testo/etichetta per entrambe le direzioni (solo il contenuto interno di `SplitSlider` cambia) — nessuna nuova stringa "Escludi" separata, per restare aderente a "stesso meccanismo delle spese".

## Test

Estendere `lib/calc/cashflow.test.ts` con casi che verificano, per ciascuna delle 4 funzioni toccate (`computeCashflowKpis`, `computeMonthlySeries`, `computeIncomeSources`, `computeWhereItGoes`), che una transazione entrata con `excludedAmount > 0` contribuisca solo con la quota netta (`effectiveAmount`), non con l'importo lordo. Nessuna modifica ai test API (nessun cambiamento lato route/validazione).

Nessun test automatico previsto per i componenti `.tsx` toccati (nessuna convenzione di test per componenti in questo repo) — verifica manuale utente prevista come per le altre feature UI di questo progetto.
