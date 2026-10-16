# Shortcuts and precise input for "Dividi" (SplitSlider) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add to `SplitSlider` (the "Dividi" ("Split") mechanism in the Spese ("Expenses") screen) quick ÷2/÷3/÷4 buttons and a "Spesa effettiva" ("Actual expense") numeric field to set a precise value, because the slider alone is too imprecise for an exact amount.

**Architecture:** Pure calculation logic extracted into `components/domain/expenses/split-slider.utils.ts` (testable with vitest, no DOM required). The `SplitSlider` component remains the only consumer; it adds two new controls above the existing slider, all synchronized on the same `excluded` state. `commit()` is refactored to accept the value to save explicitly, instead of reading the `excluded` state via closure — needed because the new handlers call `setExcluded(value)` and `commit(value)` in the same synchronous handler, and React state is not updated immediately (reading `excluded` right after `setExcluded` would give the old value).

**Tech Stack:** Next.js (App Router) + TypeScript, local React state, `@base-ui/react` (Slider/Button/Input via `components/ui/*`), TanStack Query (existing `useUpdateTransactionMutation`), vitest for pure-logic tests.

## Global Constraints

- User-facing strings in Italian (see `CLAUDE.md` → Component conventions).
- No hardcoded colors/radii: only existing Tailwind token classes (already respected by the file, do not introduce new values).
- No changes to the API, DB schema, or server-side `isValidExcludedAmount()`: it stays unchanged, the client keeps sending only a numeric `excludedAmount`.
- Minimal JSDoc (one `/**` line) on every exported public function.
- The `split-slider.tsx` file must not exceed ~150 lines of JSX (see the "One component, one responsibility" principle in `CLAUDE.md`); the calculation logic goes in the separate `.utils.ts` file, not inline in the component.

---

## Starting state (verified in the code)

`components/domain/expenses/split-slider.tsx` already exists with: a single slider on `excludedAmount`, `commit()` that reads `excluded` from closure and calls `useUpdateTransactionMutation` on `onValueCommitted`, explanatory text, a "Spesa effettiva / Esclusa dal conteggio" ("Actual expense / Excluded from the count") summary below the slider. No automated test exists for this component or for other UI components in `components/domain/expenses/` (the project does not have `jsdom`/Testing Library configured in `vitest.config.ts` — only pure-logic tests, Node environment). `components/ui/button.tsx` exposes `variant: "outline"` and `size: "sm"`; `components/ui/input.tsx` exposes a standard `Input` based on `@base-ui/react/input`.

---

### Task 1: Pure calculation module `split-slider.utils.ts`

**Files:**
- Create: `components/domain/expenses/split-slider.utils.ts`
- Test: `components/domain/expenses/split-slider.utils.test.ts`

**Interfaces:**
- Consumes: no dependency on other tasks.
- Produces:
  - `clampExcluded(rawExcluded: number, totalAmount: number): number` — brings a value into the range `[0, totalAmount]`, converts `NaN` to `0`.
  - `computeSplitExcluded(totalAmount: number, n: number): number` — excluded amount to divide `totalAmount` into `n` equal shares, keeping one as the actual expense (`totalAmount - totalAmount/n`), passed through `clampExcluded`.
  - Used by Task 2.

- [ ] **Step 1: Write the tests (they will fail: the module does not exist yet)**

Create `components/domain/expenses/split-slider.utils.test.ts`:

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

- [ ] **Step 2: Run the tests, verify they fail**

Run: `pnpm exec vitest run components/domain/expenses/split-slider.utils.test.ts`
Expected: FAIL — `Cannot find module './split-slider.utils'` (or the equivalent "failed to resolve import").

- [ ] **Step 3: Implement the module**

Create `components/domain/expenses/split-slider.utils.ts`:

```ts
/** Brings an excluded amount into the valid range [0, totalAmount], replacing NaN with 0. */
export function clampExcluded(rawExcluded: number, totalAmount: number): number {
  if (Number.isNaN(rawExcluded)) return 0;
  return Math.min(Math.max(rawExcluded, 0), totalAmount);
}

/** Computes the excluded amount to divide a total into n equal shares, keeping one as the actual expense. */
export function computeSplitExcluded(totalAmount: number, n: number): number {
  return clampExcluded(totalAmount - totalAmount / n, totalAmount);
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `pnpm exec vitest run components/domain/expenses/split-slider.utils.test.ts`
Expected: PASS — 8 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add components/domain/expenses/split-slider.utils.ts components/domain/expenses/split-slider.utils.test.ts
git commit -m "feat: aggiunge calcolo puro per shortcut divisione spesa"
```

---

### Task 2: ÷2/÷3/÷4 buttons and "Spesa effettiva" input in `SplitSlider`

**Files:**
- Modify: `components/domain/expenses/split-slider.tsx` (whole file, replaced as below)

**Interfaces:**
- Consumes: `clampExcluded`, `computeSplitExcluded` from `./split-slider.utils` (Task 1).
- Produces: no new exports — `SplitSliderProps` unchanged, no other file depends on this component's internals.

- [ ] **Step 1: Replace the contents of `components/domain/expenses/split-slider.tsx`**

```tsx
"use client";

/** "Dividi" UI: splits a transaction's amount between actual expense and the share excluded from the count. */

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

- [ ] **Step 2: Check types**

Run: `pnpm exec tsc --noEmit`
Expected: no errors in `split-slider.tsx` (also check that there are no unrelated pre-existing errors muddying the result — if there are, isolate the ones related to this file).

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no errors/warnings on `split-slider.tsx`.

- [ ] **Step 4: Manual browser verification (no component test infrastructure in this project)**

Start `pnpm dev`, open the Spese screen, open "Dividi" on a transaction with a cents amount (e.g. €1.44):
- Click ÷2: "Spesa effettiva" becomes €0.72, saving starts immediately (the "Salvataggio in corso..." ("Saving...") message appears briefly).
- Click ÷3 then ÷4: the value updates consistently each time, slider and summary text stay in sync with the input.
- Type a value in the "Spesa effettiva" field (e.g. "1.00") and press Tab: saving starts on blur, slider and summary update.
- Type an out-of-range value (e.g. "999" with a €1.44 total) and press Enter: the value is clamped to €1.44 (actual expense = total, excluded = 0).
- Type an empty/non-numeric value and blur: it must not break the UI (it must clamp to 0 or to the previous value, no crash).
- Drag the slider with the mouse: no console errors (regression of the earlier fix on non-iterable `[value]`).
- Check in dark mode (theme toggle) that buttons/input have readable contrast.

- [ ] **Step 5: Commit**

```bash
git add components/domain/expenses/split-slider.tsx
git commit -m "feat: aggiunge shortcut divisione e input spesa effettiva a SplitSlider"
```

---

## Self-Review (done while writing the plan)

1. **Spec coverage**: ÷2÷3÷4 buttons → Task 2 Step 1; "Spesa effettiva" numeric input with commit on blur/Enter → Task 2 Step 1; slider unchanged below → Task 2 Step 1; shared `clampExcluded` validation → Task 1; no API/DB changes → stated in Global Constraints, no task touches `app/api/`. All spec sections are covered.
2. **Placeholder scan**: no TBD/TODO, every step has complete code.
3. **Type consistency**: `clampExcluded`/`computeSplitExcluded` have the same signature between Task 1 (definition) and Task 2 (use); `commit(value: number)` consistently replaces every old argument-less `commit` call (buttons, input, slider updated together in the same task to avoid mixed signatures across files).
