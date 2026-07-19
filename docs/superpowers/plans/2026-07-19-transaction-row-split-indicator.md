# Indicatore visivo "Diviso" in TransactionRow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere visibile nella riga transazione (senza aprire il pannello "Dividi") che una transazione è stata divisa, mostrando l'importo netto come cifra principale, un badge "Diviso" e l'importo pieno originale in piccolo.

**Architecture:** Modifica puramente di rendering condizionale in `components/domain/expenses/transaction-row.tsx`, basata su `excludedAmount` già presente su `transaction` (nessun nuovo dato, nessuna nuova chiamata). Nessun altro file coinvolto.

**Tech Stack:** Next.js (App Router) + TypeScript, componenti `Badge`/`CurrencyInput` esistenti.

## Global Constraints

- Stringhe utente in italiano.
- Nessun colore/raggio hardcoded: solo classi token Tailwind esistenti.
- Nessuna modifica a `SplitSlider`, API, schema DB, motore di calcolo (`lib/calc/expenses.ts`).
- Il campo importo delle transazioni "Manuale" deve continuare a editare l'importo pieno (`transaction.amount`), mai il netto — l'indicazione del netto è solo informativa, in un elemento separato non editabile.
- JSDoc minimo (una riga `/**`) già presente in cima al file, non serve aggiungerne di nuovo per queste modifiche interne.

---

## Stato di partenza (verificato nel codice)

`components/domain/expenses/transaction-row.tsx` esiste già. Riga Auto (sola lettura, righe 128-131 circa): un solo `<p>` con l'importo pieno. Riga Manuale (righe 132-141 circa): `CurrencyInput` che edita `amountValue` (inizializzato a `Math.abs(Number(transaction.amount))`). Badge Auto/Manuale a riga 124-126. `transaction.excludedAmount` è già un campo della riga `Transaction` (usato in `SplitSlider`), sempre disponibile qui senza fetch aggiuntivi. Nessuna infrastruttura di test a componenti in questo progetto (nessun jsdom/Testing Library) — questa modifica non ha test automatici, solo verifica manuale in browser.

---

### Task 1: Badge "Diviso" + importo netto/pieno in TransactionRow

**Files:**
- Modify: `components/domain/expenses/transaction-row.tsx`

**Interfaces:**
- Consumes: nessuna dipendenza da altri task (piano a task singolo).
- Produces: nessuna nuova esportazione — `TransactionRowProps` invariata.

- [ ] **Step 1: Aggiungi le costanti derivate subito dopo gli state esistenti**

Nel file `components/domain/expenses/transaction-row.tsx`, subito dopo la riga `const [splitOpen, setSplitOpen] = React.useState(false);` (circa riga 42), aggiungi:

```tsx
  const excludedAmount = Math.abs(Number(transaction.excludedAmount));
  const fullAmount = Math.abs(Number(transaction.amount));
  const netAmount = fullAmount - excludedAmount;
  const isSplit = excludedAmount > 0;
```

- [ ] **Step 2: Aggiungi il badge "Diviso" accanto al badge Auto/Manuale esistente**

Sostituisci:

```tsx
          <Badge variant={isAuto ? "secondary" : "outline"} className="shrink-0">
            {isAuto ? "Auto" : "Manuale"}
          </Badge>
```

con:

```tsx
          <Badge variant={isAuto ? "secondary" : "outline"} className="shrink-0">
            {isAuto ? "Auto" : "Manuale"}
          </Badge>

          {isSplit && (
            <Badge variant="ghost" className="shrink-0">
              Diviso
            </Badge>
          )}
```

- [ ] **Step 3: Sostituisci il blocco importo (sia ramo Auto sia ramo Manuale)**

Sostituisci l'intero blocco:

```tsx
          {isAuto ? (
            <p className="w-24 shrink-0 text-right text-sm font-medium tabular-nums sm:w-28">
              {formatCurrency(Math.abs(Number(transaction.amount)), currency)}
            </p>
          ) : (
            <CurrencyInput
              value={amountValue}
              onChange={setAmountValue}
              onBlur={commitAmount}
              currency={currency}
              className="w-24 text-right sm:w-28"
              aria-label="Importo"
            />
          )}
```

con:

```tsx
          {isAuto ? (
            <div className="w-24 shrink-0 text-right sm:w-28">
              <p className="text-sm font-medium tabular-nums">
                {formatCurrency(isSplit ? netAmount : fullAmount, currency)}
              </p>
              {isSplit && (
                <p className="text-xs text-muted-foreground line-through">
                  {formatCurrency(fullAmount, currency)}
                </p>
              )}
            </div>
          ) : (
            <div className="w-24 shrink-0 sm:w-28">
              <CurrencyInput
                value={amountValue}
                onChange={setAmountValue}
                onBlur={commitAmount}
                currency={currency}
                className="w-full text-right"
                aria-label="Importo"
              />
              {isSplit && (
                <p className="mt-0.5 text-right text-xs text-muted-foreground">
                  Netto: {formatCurrency(netAmount, currency)}
                </p>
              )}
            </div>
          )}
```

- [ ] **Step 4: Verifica i tipi**

Run: `pnpm exec tsc --noEmit` (o, se l'ambiente ha il problema noto `ERR_PNPM_IGNORED_BUILDS` di pnpm exec, `node node_modules/typescript/bin/tsc --noEmit`)
Expected: nessun errore in `transaction-row.tsx`.

- [ ] **Step 5: Lint**

Run: `pnpm exec eslint components/domain/expenses/transaction-row.tsx` (o `node node_modules/eslint/bin/eslint.js components/domain/expenses/transaction-row.tsx`)
Expected: nessun errore/warning.

- [ ] **Step 6: Verifica manuale in browser (nessuna infrastruttura di test a componenti in questo progetto)**

Avvia `pnpm dev`, apri la schermata Spese:
- Transazione Auto **non divisa**: rendering identico a prima (solo importo pieno, nessun badge "Diviso", nessuna riga barrata).
- Transazione Auto **divisa** (apri "Dividi" e sposta lo slider/usa ÷2): badge "Diviso" appare accanto ad "Auto"; la cifra principale mostra il netto; sotto appare l'importo pieno barrato in piccolo.
- Transazione Manuale **non divisa**: rendering identico a prima (input editabile, nessuna riga "Netto" sotto).
- Transazione Manuale **divisa**: badge "Diviso" appare accanto a "Manuale"; l'input continua a mostrare/editare l'importo pieno (verifica che editarlo e salvare funzioni ancora); sotto l'input appare "Netto: €X" in piccolo.
- Riporta lo split a 0 dal pannello Dividi (÷1 non esiste come shortcut: usa lo slider o l'input "Spesa effettiva" per azzerare l'esclusione): badge e riga netta/barrata scompaiono, torna al rendering originale.
- Verifica in dark mode che badge e testo barrato/piccolo abbiano contrasto leggibile.
- Verifica che il layout non si rompa su schermo stretto (mobile): la colonna importo si allarga verticalmente (due righe) ma non deve spingere il resto del layout fuori posto.

- [ ] **Step 7: Commit**

```bash
git add components/domain/expenses/transaction-row.tsx
git commit -m "feat: mostra indicatore Diviso e importo netto in TransactionRow"
```

---

## Self-Review (svolto durante la scrittura del piano)

1. **Copertura spec**: badge "Diviso" → Step 2; riga Auto con netto+barrato → Step 3; riga Manuale con input invariato + nota netto → Step 3; nessuna modifica a SplitSlider/API/schema/motore di calcolo → dichiarato nei Global Constraints, nessun altro file toccato. Tutte le sezioni della spec sono coperte.
2. **Placeholder scan**: nessun TBD/TODO, ogni step ha codice completo, before/after espliciti.
3. **Coerenza tipi**: `excludedAmount`/`fullAmount`/`netAmount`/`isSplit` definiti una sola volta (Step 1) e riusati identici negli Step 2-3, nessuna doppia definizione o nome divergente.
