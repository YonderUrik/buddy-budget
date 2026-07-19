# Design: indicatore visivo "Diviso" in TransactionRow

**Data**: 2026-07-19
**Stato**: approvato in brainstorming, in attesa di piano di implementazione

## Contesto

`components/domain/expenses/transaction-row.tsx` mostra la riga di ogni transazione nella lista Spese. Il meccanismo "Dividi" (`SplitSlider`, aggiunto in [2026-07-19-split-slider-shortcuts-design.md](2026-07-19-split-slider-shortcuts-design.md)) permette di escludere una parte dell'importo dal conteggio spesa (`excludedAmount`), ma questo valore non è visibile da nessuna parte nella riga stessa: l'importo mostrato è sempre `Math.abs(transaction.amount)` (l'importo pieno), sia per transazioni "Auto" (`transaction-row.tsx:129-131`, sola lettura) sia come valore iniziale del campo editabile per transazioni "Manuale" (`transaction-row.tsx:133-140`). L'unico punto in cui si vede la ripartizione è aprendo il pannello "Dividi" stesso. Feedback utente: dopo aver diviso una spesa, non si vede bene che è stata divisa, perché la riga resta invariata.

## Design

### Badge "Diviso"

Nuovo badge accanto a quello esistente Auto/Manuale (`transaction-row.tsx:124-126`), `variant="ghost"`, testo "Diviso". Visibile quando `Number(transaction.excludedAmount) > 0`. Nessuna modifica al badge Auto/Manuale esistente.

### Riga "Auto" (sola lettura)

Sostituisce `transaction-row.tsx:128-131`. Quando `excludedAmount > 0`:
- Cifra principale = importo netto (`Math.abs(amount) - Math.abs(excludedAmount)`), stesso stile attuale (`text-sm font-medium tabular-nums`).
- Sotto, in piccolo e barrato, l'importo pieno originale: `formatCurrency(Math.abs(amount), currency)` con classi `text-xs text-muted-foreground line-through`.

Quando `excludedAmount === 0`, il rendering resta identico a oggi (solo la cifra piena, nessuna riga aggiuntiva).

### Riga "Manuale" (editabile)

`CurrencyInput` (`transaction-row.tsx:133-140`) **resta invariato**: continua a editare `Math.abs(transaction.amount)`, l'importo pieno — cambiare il valore mostrato/editato al netto romperebbe la semantica dell'editing (l'utente deve poter correggere l'importo bancario reale, non un derivato). Quando `excludedAmount > 0`, viene aggiunta sotto il campo una riga informativa, sola lettura: "Netto: {formatCurrency(importo netto, currency)}", classi `text-xs text-muted-foreground`, allineata a destra come il campo sopra.

### Cosa NON cambia

- Nessuna modifica a `SplitSlider`, a nessuna route API, allo schema DB, al motore di calcolo (`lib/calc/expenses.ts`). Il calcolo del netto (`amount - excludedAmount`) è già usato ovunque nell'app; qui si legge lo stesso dato già presente su `transaction`, nessun nuovo fetch.
- Nessuna modifica alla logica di `commitAmount`/`commitDescription`/`commitDate`/`commitCategory`.
- Il pannello "Dividi" stesso (`SplitSlider`) resta invariato: continua a mostrare "Spesa effettiva" / "Esclusa dal conteggio" al suo interno.

## Testing

Nessuna infrastruttura di test a componenti in questo progetto (vedi decisione precedente in [2026-07-19-split-slider-shortcuts-design.md](2026-07-19-split-slider-shortcuts-design.md)) — nessun test automatico previsto per questa modifica, puramente di rendering condizionale. Verifica manuale in browser richiesta: transazione Auto e Manuale, entrambe con e senza split, dark mode, che il badge/importo netto/barrato appaiano solo quando `excludedAmount > 0` e scompaiano se lo split viene riportato a 0 dal pannello Dividi.
