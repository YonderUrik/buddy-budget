# Shortcut e input preciso per "Dividi" (SplitSlider) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere a `SplitSlider` (meccanismo "Dividi" nella schermata Spese) bottoni rapidi ÷2/÷3/÷4 e un campo numerico "Spesa effettiva" per impostare un valore preciso, perché lo slider da solo è troppo impreciso per un importo esatto.

**Architecture:** Logica di calcolo pura estratta in `components/domain/expenses/split-slider.utils.ts` (testabile con vitest, nessun DOM richiesto). Il componente `SplitSlider` resta l'unico consumer, aggiunge due nuovi controlli sopra allo slider esistente, tutti sincronizzati sullo stesso state `excluded`. `commit()` viene rifattorizzato per accettare il valore esplicitamente da salvare, invece di leggere lo state `excluded` per closure — necessario perché i nuovi handler chiamano `setExcluded(value)` e `commit(value)` nello stesso gestore sincrono, e lo state di React non è aggiornato immediatamente (leggere `excluded` subito dopo `setExcluded` darebbe il valore vecchio).

**Tech Stack:** Next.js (App Router) + TypeScript, React state locale, `@base-ui/react` (Slider/Button/Input via `components/ui/*`), TanStack Query (`useUpdateTransactionMutation` già esistente), vitest per i test di logica pura.

## Global Constraints

- Stringhe utente in italiano (vedi `CLAUDE.md` → Convenzioni componenti).
- Nessun colore/raggio hardcoded: solo classi token Tailwind esistenti (già rispettato dal file, non introdurre nuovi valori).
- Nessuna modifica a API, schema DB, `isValidExcludedAmount()` lato server: resta invariato, il client continua a inviare solo `excludedAmount` numerico.
- JSDoc minimo (una riga `/**`) su ogni funzione pubblica esportata.
- Il file `split-slider.tsx` non deve superare ~150 righe di JSX (vedi principio "Un componente, una responsabilità" in `CLAUDE.md`); la logica di calcolo va nel file `.utils.ts` separato, non inline nel componente.

---

## Stato di partenza (verificato nel codice)

`components/domain/expenses/split-slider.tsx` esiste già con: slider singolo su `excludedAmount`, `commit()` che legge `excluded` da closure e chiama `useUpdateTransactionMutation` on `onValueCommitted`, testo esplicativo, riepilogo "Spesa effettiva / Esclusa dal conteggio" sotto lo slider. Nessun test automatico esiste per questo componente né per altri componenti UI in `components/domain/expenses/` (progetto non ha `jsdom`/Testing Library configurati in `vitest.config.ts` — solo test di logica pura, ambiente Node). `components/ui/button.tsx` espone `variant: "outline"` e `size: "sm"`; `components/ui/input.tsx` espone un `Input` standard basato su `@base-ui/react/input`.

---

### Task 1: Modulo di calcolo puro `split-slider.utils.ts`

**Files:**
- Create: `components/domain/expenses/split-slider.utils.ts`
- Test: `components/domain/expenses/split-slider.utils.test.ts`

**Interfaces:**
- Consumes: nessuna dipendenza da altri task.
- Produces:
  - `clampExcluded(rawExcluded: number, totalAmount: number): number` — riporta un valore nel range `[0, totalAmount]`, converte `NaN` in `0`.
  - `computeSplitExcluded(totalAmount: number, n: number): number` — importo escluso per dividere `totalAmount` in `n` quote uguali, tenendone una come spesa effettiva (`totalAmount - totalAmount/n`), passato per `clampExcluded`.
  - Usati dal Task 2.

- [ ] **Step 1: Scrivi i test (falliranno: il modulo non esiste ancora)**

Crea `components/domain/expenses/split-slider.utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clampExcluded, computeSplitExcluded } from "./split-slider.utils";

describe("clampExcluded", () => {
  it("passa invariato un valore già nel range", () => {
    expect(clampExcluded(5, 10)).toBe(5);
  });

  it("clampa un valore negativo a 0", () => {
    expect(clampExcluded(-3, 10)).toBe(0);
  });

  it("clampa un valore superiore al totale al totale", () => {
    expect(clampExcluded(15, 10)).toBe(10);
  });

  it("converte NaN in 0", () => {
    expect(clampExcluded(NaN, 10)).toBe(0);
  });
});

describe("computeSplitExcluded", () => {
  it("diviso 2: la quota esclusa è metà del totale", () => {
    expect(computeSplitExcluded(10, 2)).toBe(5);
  });

  it("diviso 3 con importo con centesimi (es. 1.44)", () => {
    expect(computeSplitExcluded(1.44, 3)).toBeCloseTo(0.96, 10);
  });

  it("diviso 4: la quota esclusa è 3/4 del totale", () => {
    expect(computeSplitExcluded(100, 4)).toBe(75);
  });

  it("clampa il risultato anche per n non intero o estremo (n=1: nessuna quota esclusa)", () => {
    expect(computeSplitExcluded(50, 1)).toBe(0);
  });
});
```

- [ ] **Step 2: Esegui i test, verifica che falliscano**

Run: `pnpm exec vitest run components/domain/expenses/split-slider.utils.test.ts`
Expected: FAIL — `Cannot find module './split-slider.utils'` (o equivalente "failed to resolve import").

- [ ] **Step 3: Implementa il modulo**

Crea `components/domain/expenses/split-slider.utils.ts`:

```ts
/** Riporta un importo escluso nel range valido [0, totalAmount], sostituendo NaN con 0. */
export function clampExcluded(rawExcluded: number, totalAmount: number): number {
  if (Number.isNaN(rawExcluded)) return 0;
  return Math.min(Math.max(rawExcluded, 0), totalAmount);
}

/** Calcola l'importo escluso per dividere un totale in n quote uguali, tenendone una come spesa effettiva. */
export function computeSplitExcluded(totalAmount: number, n: number): number {
  return clampExcluded(totalAmount - totalAmount / n, totalAmount);
}
```

- [ ] **Step 4: Esegui i test, verifica che passino**

Run: `pnpm exec vitest run components/domain/expenses/split-slider.utils.test.ts`
Expected: PASS — 8 test, 0 fallimenti.

- [ ] **Step 5: Commit**

```bash
git add components/domain/expenses/split-slider.utils.ts components/domain/expenses/split-slider.utils.test.ts
git commit -m "feat: aggiunge calcolo puro per shortcut divisione spesa"
```

---

### Task 2: Bottoni ÷2/÷3/÷4 e input "Spesa effettiva" in `SplitSlider`

**Files:**
- Modify: `components/domain/expenses/split-slider.tsx` (intero file, sostituito come sotto)

**Interfaces:**
- Consumes: `clampExcluded`, `computeSplitExcluded` da `./split-slider.utils` (Task 1).
- Produces: nessuna nuova esportazione — `SplitSliderProps` invariata, nessun altro file dipende dagli interni di questo componente.

- [ ] **Step 1: Sostituisci il contenuto di `components/domain/expenses/split-slider.tsx`**

```tsx
"use client";

/** UI "Dividi": ripartisce l'importo di una transazione tra spesa effettiva e quota esclusa dal conteggio. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/format";
import { useUpdateTransactionMutation } from "@/lib/queries/transactions";
import type { Transaction } from "@/lib/db/schema/transactions";
import { clampExcluded, computeSplitExcluded } from "./split-slider.utils";

const SPLIT_SHORTCUTS = [2, 3, 4] as const;

export interface SplitSliderProps {
  transaction: Transaction;
  currency: string;
  onClose: () => void;
}

export function SplitSlider({ transaction, currency, onClose }: SplitSliderProps) {
  const updateMutation = useUpdateTransactionMutation();
  const totalAmount = Math.abs(Number(transaction.amount));
  const [excluded, setExcluded] = React.useState(Math.abs(Number(transaction.excludedAmount)));
  const [spentInput, setSpentInput] = React.useState(() => (totalAmount - excluded).toFixed(2));

  function commit(value: number) {
    updateMutation.mutate({ id: transaction.id, input: { excludedAmount: value } }, { onSuccess: onClose });
  }

  function applySplit(n: number) {
    const value = computeSplitExcluded(totalAmount, n);
    setExcluded(value);
    setSpentInput((totalAmount - value).toFixed(2));
    commit(value);
  }

  function commitSpentInput() {
    const spent = clampExcluded(Number(spentInput), totalAmount);
    const value = clampExcluded(totalAmount - spent, totalAmount);
    setSpentInput((totalAmount - value).toFixed(2));
    if (value === excluded) return;
    setExcluded(value);
    commit(value);
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-muted/50 px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Sposta il cursore per escludere una parte dal conteggio: è uscita dal conto, ma non è una spesa
        (rimborsi, quote di altri, giroconto).
      </p>
      <div className="flex gap-1.5">
        {SPLIT_SHORTCUTS.map((n) => (
          <Button
            key={n}
            type="button"
            variant="outline"
            size="sm"
            disabled={updateMutation.isPending}
            onClick={() => applySplit(n)}
          >
            ÷{n}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={`spesa-effettiva-${transaction.id}`} className="text-xs text-muted-foreground">
          Spesa effettiva
        </label>
        <Input
          id={`spesa-effettiva-${transaction.id}`}
          type="number"
          min={0}
          max={totalAmount}
          step={0.01}
          disabled={updateMutation.isPending}
          value={spentInput}
          onChange={(event) => setSpentInput(event.target.value)}
          onBlur={commitSpentInput}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          className="w-24"
        />
      </div>
      <Slider
        value={[excluded]}
        min={0}
        max={totalAmount}
        step={0.01}
        disabled={updateMutation.isPending}
        onValueChange={(value) => {
          const next = Array.isArray(value) ? value[0] : value;
          setExcluded(next);
          setSpentInput((totalAmount - next).toFixed(2));
        }}
        onValueCommitted={() => commit(excluded)}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Spesa effettiva: {formatCurrency(totalAmount - excluded, currency)}</span>
        <span>Esclusa dal conteggio: {formatCurrency(excluded, currency)}</span>
      </div>
      {updateMutation.isPending && <p className="text-xs text-muted-foreground">Salvataggio in corso...</p>}
      {updateMutation.isError && <p className="text-xs text-destructive">Salvataggio non riuscito, riprova.</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verifica i tipi**

Run: `pnpm exec tsc --noEmit`
Expected: nessun errore in `split-slider.tsx` (verifica anche che non ci siano errori preesistenti scorrelati che confondano il risultato — se ce ne sono, isola quelli relativi a questo file).

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: nessun errore/warning su `split-slider.tsx`.

- [ ] **Step 4: Verifica manuale in browser (nessuna infrastruttura di test a componenti in questo progetto)**

Avvia `pnpm dev`, apri la schermata Spese, apri "Dividi" su una transazione con importo con centesimi (es. €1.44):
- Click ÷2: "Spesa effettiva" diventa €0.72, salvataggio parte subito (messaggio "Salvataggio in corso..." appare brevemente).
- Click ÷3 poi ÷4: il valore si aggiorna coerentemente ogni volta, slider e testo riepilogo restano sincronizzati con l'input.
- Digita un valore nel campo "Spesa effettiva" (es. "1.00") e premi Tab: il salvataggio parte on blur, slider e riepilogo si aggiornano.
- Digita un valore fuori range (es. "999" con totale €1.44) e premi Invio: il valore viene clampato a €1.44 (spesa effettiva = totale, esclusa = 0).
- Digita un valore vuoto/non numerico e fai blur: non deve rompere la UI (deve clampare a 0 o al valore precedente, nessun crash).
- Trascina lo slider col mouse: nessun errore in console (regressione del fix precedente su `[value]` non iterabile).
- Verifica in dark mode (toggle tema) che bottoni/input abbiano contrasto leggibile.

- [ ] **Step 5: Commit**

```bash
git add components/domain/expenses/split-slider.tsx
git commit -m "feat: aggiunge shortcut divisione e input spesa effettiva a SplitSlider"
```

---

## Self-Review (svolto durante la scrittura del piano)

1. **Copertura spec**: bottoni ÷2÷3÷4 → Task 2 Step 1; input numerico "Spesa effettiva" con commit su blur/Enter → Task 2 Step 1; slider invariato sotto → Task 2 Step 1; validazione condivisa `clampExcluded` → Task 1; nessuna modifica API/DB → dichiarato nei Global Constraints, nessun task tocca `app/api/`. Tutte le sezioni della spec sono coperte.
2. **Placeholder scan**: nessun TBD/TODO, ogni step ha codice completo.
3. **Coerenza tipi**: `clampExcluded`/`computeSplitExcluded` stessa firma tra Task 1 (definizione) e Task 2 (uso); `commit(value: number)` sostituisce coerentemente ogni vecchia chiamata `commit` senza argomenti (bottoni, input, slider aggiornati insieme nello stesso task per evitare firme miste in file diversi).
