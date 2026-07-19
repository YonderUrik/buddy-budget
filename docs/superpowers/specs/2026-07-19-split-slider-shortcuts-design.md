# Design: shortcut e input preciso per "Dividi" (SplitSlider)

**Data**: 2026-07-19
**Stato**: approvato in brainstorming, in attesa di piano di implementazione

## Contesto

`components/domain/expenses/split-slider.tsx` (schermata Spese, meccanismo "Dividi") permette di escludere una parte dell'importo di una transazione dal conteggio spesa (rimborsi, quote condivise, giroconti), tramite uno slider su `excludedAmount`. Bug di imprecisione trascinamento mouse già corretto in questa sessione (libreria `@base-ui/react/slider`: `Control` interno usa `range = values.length > 1`, diverso dal `range` di `Root`, per cui un thumb singolo su value array riceve talvolta un numero scalare invece di un array in `onValueChange`).

Feedback utente dopo test manuale: lo slider da solo è poco preciso per impostare un valore esatto. Richiesta: shortcut rapide per il caso d'uso più comune (conto diviso equamente tra n persone) più un campo numerico per il valore esatto.

## Caso d'uso confermato con l'utente

"Diviso n" = conto condiviso equamente tra n persone incluso l'utente. La **quota dell'utente** (ciò che deve restare come spesa effettiva) è `totalAmount / n`; il resto è escluso dal conteggio:

```
excluded = totalAmount - totalAmount / n
```

n supportati: 2, 3, 4 (bottoni fissi, nessuna UI per n arbitrario).

## Design

### Componenti UI aggiunti a `SplitSlider`

1. **Riga bottoni ÷2 ÷3 ÷4** (sopra allo slider esistente): `Button` variant `outline` size `sm` da `components/ui/button`. Al click: calcola `excluded` con la formula sopra, `setExcluded(value)` e **salva subito** (`commit()` esistente, stessa mutation `useUpdateTransactionMutation`).
2. **Input numerico "Spesa effettiva"**: `Input type="number"` da `components/ui/input`, step `0.01`, min `0`, max `totalAmount`. Mostra `totalAmount - excluded` (non `excluded` direttamente: l'utente ragiona in termini di "quanto conta come spesa", non di quota esclusa). Aggiorna solo lo state locale ad ogni digitazione (nessuna mutation); salva su `onBlur` o `Enter` (`onKeyDown` su tasto `Enter`), con lo stesso `commit()`.
3. **Slider esistente**: resta sotto, invariato nella logica, sincronizzato con lo stesso state `excluded` (bottoni/input/slider sono tre modi di scrivere allo stesso `excluded`).
4. **Riga riepilogo testuale esistente** ("Spesa effettiva: ... / Esclusa dal conteggio: ...") resta invariata sotto lo slider.

Ordine verticale finale: testo esplicativo → bottoni ÷2÷3÷4 → input "Spesa effettiva" → slider → riepilogo testuale.

### Validazione condivisa

Nuovo helper locale al file (non serve un modulo condiviso, unico punto d'uso oggi):

```ts
function clampExcluded(rawExcluded: number, totalAmount: number): number {
  if (Number.isNaN(rawExcluded)) return 0;
  return Math.min(Math.max(rawExcluded, 0), totalAmount);
}
```

Usato da: bottoni ÷n (per sicurezza, anche se la formula è già in range), input numerico su blur/Enter (converte il valore digitato di "spesa effettiva" in `excluded = totalAmount - value`, poi clamp), e resta disponibile per lo slider se in futuro servisse. Nessuna richiesta di arrotondamento oltre ai 2 decimali già gestiti da `step=0.01`/`formatCurrency`.

### Cosa NON cambia

- Nessuna modifica a API, schema DB, `isValidExcludedAmount()` lato server: il valore finale inviato è sempre un `excludedAmount` numerico dentro il range valido già validato server-side.
- Nessuna modifica al motore di calcolo `lib/calc/expenses.ts`.
- Bottoni ÷n e slider salvano subito (comportamento "commit on interaction end/click" già esistente); solo l'input numerico ha una politica diversa (blur/Enter) per non generare una mutation ad ogni carattere digitato.

## Testing

Nessun test automatico esistente su questo componente (verificare durante il piano se ce ne sono in `components/domain/expenses/*.test.*`). Se sì, aggiungere casi per: click ÷2/÷3/÷4 con vari `totalAmount` (inclusi importi con centesimi, es. €1.44), input numerico con valore fuori range (negativo, superiore al totale) che deve clampare, input numerico con valore non numerico che non deve rompere lo state. Verifica manuale in browser richiesta per UX (allineamento bottoni/input/slider, dark mode, focus/tab order).
