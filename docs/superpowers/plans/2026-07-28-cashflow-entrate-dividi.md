# Dividi/Escludi ("Split/Exclude") for income Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the "Dividi" ("Split") mechanism (`excludedAmount`/`effectiveAmount`), today available only for outflows, also for income transactions — allowing an income entry (refunds, transfers between own accounts, reversals) to be excluded in whole or in part from counting as real income, everywhere in the Cash flow calculation engine.

**Architecture:** No change to schema/API/validation — `excludedAmount` and `effectiveAmount` are already sign-agnostic. The `!isIncome` guards that hid the "Dividi" UI for income in `TransactionRow` and `AutoCategorizeWizard` are removed, the text labels of `SplitSlider` and of the wizard's inner slider become dynamic (based on the sign), and `Number(t.amount)` is replaced with `effectiveAmount(t)` in every income sum of the `lib/calc/cashflow.ts` engine.

**Tech Stack:** Next.js App Router, TypeScript, React, vitest, TanStack Query.

## Global Constraints

- All visible strings in Italian (i18n not yet implemented).
- No hardcoded color/radius: use the existing Tailwind tokens/CSS vars.
- No change to the DB schema, Zod validation, API routes — the `excludedAmount`/`effectiveAmount`/`isValidExcludedAmount` mechanism is already sign-agnostic and needs no changes.
- Package manager: `pnpm`. Tests: `pnpm test` (= `vitest run`).
- No dedicated `typecheck` script: use `pnpm exec tsc --noEmit` for the type check of the tasks that touch only React components (no automated test convention for `.tsx` in this repo — only `lib/calc/*.test.ts` exists for this plan).
- The "Dividi" button keeps the same text for both directions — only the inner content of `SplitSlider`/of the wizard slider changes based on the sign, no new separate "Escludi" string.

---

## File Structure

**Modify:**
- `lib/calc/cashflow.ts` — replaces `Number(t.amount)` with `effectiveAmount(t)` in every income sum.
- `lib/calc/cashflow.test.ts` — new regression tests for the point above.
- `components/domain/expenses/transaction-row.tsx` — removes the guard that hides "Dividi" for income.
- `components/domain/expenses/split-slider.tsx` — dynamic label/text based on the sign of the amount.
- `components/domain/expenses/auto-categorize-wizard.tsx` — removes the guard that hides the split slider for income, dynamic labels, `onConfirm` no longer zeroes `excludedAmount` for income.

---

### Task 1: Calculation engine — income counts the effective amount after "Dividi"

**Files:**
- Modify: `lib/calc/cashflow.ts`
- Test: `lib/calc/cashflow.test.ts`

**Interfaces:**
- Consumes: `effectiveAmount` (already imported in `cashflow.ts` from `./expenses`, no new import needed).
- Produces: no new exported function/type — only the internal behavior of `computeCashflowKpis`, `computeMonthlySeries`, `computeIncomeSources`, `computeWhereItGoes` changes (signatures unchanged).

- [ ] **Step 1: Write the failing tests**

Add these 4 tests (one per touched function) in the respective `describe` blocks already existing in `lib/calc/cashflow.test.ts`.

In the `describe("computeCashflowKpis", ...)` block (after the test `"conta come uscita solo la spesa effettiva post-'Dividi' (amount - excludedAmount)"`, before the closing `});` of the describe):

```typescript
  it("conta come entrata solo la quota effettiva post-'Dividi' (amount - excludedAmount)", () => {
    const transactions = [
      makeTransaction({ amount: "1000.00", excludedAmount: "400.00", date: "2026-01-10" }), // effective: 600
    ];

    const kpis = computeCashflowKpis(transactions, range, todayAfterPeriod);

    expect(kpis.entrateMedie).toBe(300); // 600 of total effective income ÷ 2 months
  });
```

In the `describe("computeMonthlySeries", ...)` block (after the test `"conta come uscita solo la spesa effettiva post-'Dividi'"`, before the closing `});` of the describe):

```typescript
  it("conta come entrata solo la quota effettiva post-'Dividi'", () => {
    const range = { from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) };
    const transactions = [
      makeTransaction({ amount: "1000.00", excludedAmount: "400.00", date: "2026-01-10" }),
    ];

    const series = computeMonthlySeries(transactions, range);

    expect(series[0].entrate).toBe(600);
  });
```

In the `describe("computeIncomeSources", ...)` block (after the test `"include un'entrata sulla categoria fallback..."`, before the closing `});` of the describe):

```typescript
  it("conta come entrata solo la quota effettiva post-'Dividi', sia nel totale sia per categoria", () => {
    const range = { from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) };
    const stipendio = makeCategory({ id: "cat-stipendio", name: "Stipendio", type: "entrata" });
    const transactions = [
      makeTransaction({
        categoryId: "cat-stipendio",
        amount: "1000.00",
        excludedAmount: "400.00",
        date: "2026-01-05",
      }), // effective: 600
    ];

    const sources = computeIncomeSources(transactions, [stipendio], range);

    expect(sources[0].amount).toBe(600);
    expect(sources[0].quotaPct).toBeCloseTo(100);
  });
```

In the `describe("computeWhereItGoes", ...)` block (after the test `"conta come spesa solo l'importo effettivo post-'Dividi'"`, before the closing `});` of the describe):

```typescript
  it("conta come entrata solo la quota effettiva post-'Dividi' nel totale usato come denominatore", () => {
    const fissa = makeCategory({ id: "cat-fissa", type: "fissa" });
    const transactions = [
      makeTransaction({ categoryId: "cat-fissa", amount: "-400.00", date: "2026-02-05" }),
      makeTransaction({
        categoryId: "category-1",
        amount: "1000.00",
        excludedAmount: "400.00",
        date: "2026-02-01",
      }), // effective: 600
    ];

    const entries = computeWhereItGoes(transactions, [fissa], new Date(2026, 1, 15));

    expect(entries.find((e) => e.key === "fisse")?.quotaPct).toBeCloseTo((400 / 600) * 100);
    expect(entries.find((e) => e.key === "risparmio")?.amount).toBe(200); // 600 - 400
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run lib/calc/cashflow.test.ts`
Expected: FAIL on the 4 new tests (the expected values do not match, because the current code sums the raw `Number(t.amount)` instead of `effectiveAmount(t)`).

- [ ] **Step 3: Implement the minimal change**

In `lib/calc/cashflow.ts`, replace each of the following 4 lines (identify them by exact content, not by line number — the file may differ slightly from this description):

Line in `computeCashflowKpis`:
```typescript
  const entrate = inRange.filter(isIncome).reduce((sum, t) => sum + Number(t.amount), 0);
```
becomes:
```typescript
  const entrate = inRange.filter(isIncome).reduce((sum, t) => sum + effectiveAmount(t), 0);
```

Line in `computeMonthlySeries` (inside the object returned by the `.map`):
```typescript
      entrate: inMonth.filter(isIncome).reduce((sum, t) => sum + Number(t.amount), 0),
```
becomes:
```typescript
      entrate: inMonth.filter(isIncome).reduce((sum, t) => sum + effectiveAmount(t), 0),
```

Two lines in `computeIncomeSources`:
```typescript
  const totalEntrate = inRange.reduce((sum, t) => sum + Number(t.amount), 0);
```
becomes:
```typescript
  const totalEntrate = inRange.reduce((sum, t) => sum + effectiveAmount(t), 0);
```
and:
```typescript
    amountByCategoryId.set(t.categoryId, (amountByCategoryId.get(t.categoryId) ?? 0) + Number(t.amount));
```
becomes:
```typescript
    amountByCategoryId.set(t.categoryId, (amountByCategoryId.get(t.categoryId) ?? 0) + effectiveAmount(t));
```

Line in `computeWhereItGoes`:
```typescript
  const entrate = inMonth.filter(isIncome).reduce((sum, t) => sum + Number(t.amount), 0);
```
becomes:
```typescript
  const entrate = inMonth.filter(isIncome).reduce((sum, t) => sum + effectiveAmount(t), 0);
```

No change to the function signatures, no `Math.abs` needed: `effectiveAmount` for an income entry (positive amount, excludedAmount with the same sign by construction — see `isValidExcludedAmount`) stays positive.

Also update the JSDoc comments that explicitly mention "outflows count the effective spending after 'Dividi'" to reflect that it now applies to income too — search for the strings `"Le uscite contano solo la spesa effettiva post-\"Dividi\""` (JSDoc of `computeCashflowKpis`) and `"Serie mensile entrate/uscite per ciascun mese calendariale nel range (inclusi i mesi senza transazioni, a 0). Le uscite contano la spesa effettiva post-\"Dividi\"."` (JSDoc of `computeMonthlySeries`) and rephrase them to mention both directions, e.g. "Entrate e uscite contano solo l'importo effettivo post-'Dividi' (`effectiveAmount`)."

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run lib/calc/cashflow.test.ts`
Expected: PASS (all tests, including the 4 new ones and all the pre-existing ones).

- [ ] **Step 5: Verify types and the full suite**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

Run: `pnpm test`
Expected: only possible pre-existing and unrelated failures (e.g. `lib/gocardless/scheduler.test.ts`), no new failures.

- [ ] **Step 6: Commit**

```bash
git add lib/calc/cashflow.ts lib/calc/cashflow.test.ts
git commit -m "feat: entrate contano l'importo effettivo post-Dividi nel motore Cash flow"
```

---

### Task 2: `TransactionRow` — "Dividi" button visible for income too

**Files:**
- Modify: `components/domain/expenses/transaction-row.tsx`

**Interfaces:**
- Consumes: no new dependency — `SplitSlider` (Task 3) stays imported as today, receives the whole `transaction` and determines the direction by itself.
- Produces: no new public prop — `TransactionRowProps` unchanged.

- [ ] **Step 1: Remove the guard that hides "Dividi" for income**

In `components/domain/expenses/transaction-row.tsx`, replace:

```typescript
          {!isIncome && (
            <button
              type="button"
              onClick={() => setSplitOpen((open) => !open)}
              className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
              aria-pressed={splitOpen}
            >
              Dividi
            </button>
          )}
```

with:

```typescript
          <button
            type="button"
            onClick={() => setSplitOpen((open) => !open)}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
            aria-pressed={splitOpen}
          >
            Dividi
          </button>
```

The rest of the component (badge "Diviso", amount "Netto", `netAmount`/`isSplit`) needs no changes: they are already written with `Math.abs(...)` and work correctly for positive amounts.

- [ ] **Step 2: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/domain/expenses/transaction-row.tsx
git commit -m "feat: mostra bottone Dividi anche sulle transazioni entrata"
```

---

### Task 3: `SplitSlider` — dynamic label and explanatory text based on the sign

**Files:**
- Modify: `components/domain/expenses/split-slider.tsx`

**Interfaces:**
- Consumes: `transaction.amount` (already available via the `transaction` prop, no new prop needed).
- Produces: `SplitSliderProps` unchanged.

- [ ] **Step 1: Derive the direction and replace the static explanatory text**

In `components/domain/expenses/split-slider.tsx`, inside `SplitSlider`, right after the line `const totalAmount = Math.abs(Number(transaction.amount));`, add:

```typescript
  const isIncome = Number(transaction.amount) > 0;
```

Replace:

```typescript
      <p className="text-xs text-muted-foreground">
        Sposta il cursore per escludere una parte dal conteggio: è uscita dal conto, ma non è una spesa
        (rimborsi, quote di altri, giroconto).
      </p>
```

with:

```typescript
      <p className="text-xs text-muted-foreground">
        {isIncome
          ? "Sposta il cursore per escludere una parte dal conteggio: è entrata sul conto, ma non è reddito reale (rimborsi, giroconto, storni)."
          : "Sposta il cursore per escludere una parte dal conteggio: è uscita dal conto, ma non è una spesa (rimborsi, quote di altri, giroconto)."}
      </p>
```

- [ ] **Step 2: Dynamic label of the numeric field**

Replace:

```typescript
        <label htmlFor={`spesa-effettiva-${transaction.id}`} className="text-xs text-muted-foreground">
          Spesa effettiva
        </label>
```

with:

```typescript
        <label htmlFor={`spesa-effettiva-${transaction.id}`} className="text-xs text-muted-foreground">
          {isIncome ? "Entrata effettiva" : "Spesa effettiva"}
        </label>
```

(the `id`/`htmlFor` attribute stays `spesa-effettiva-${transaction.id}` for both directions — it is an internal identifier, not visible text, no need to differentiate it).

- [ ] **Step 3: Dynamic label in the summary below the slider**

Replace:

```typescript
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Spesa effettiva: {formatCurrency(totalAmount - excluded, currency)}</span>
        <span>Esclusa dal conteggio: {formatCurrency(excluded, currency)}</span>
      </div>
```

with:

```typescript
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {isIncome ? "Entrata effettiva" : "Spesa effettiva"}: {formatCurrency(totalAmount - excluded, currency)}
        </span>
        <span>Esclusa dal conteggio: {formatCurrency(excluded, currency)}</span>
      </div>
```

- [ ] **Step 4: Update the file's JSDoc**

Replace the first line of the file:

```typescript
/** "Dividi" UI: splits a transaction's amount between effective spending and the share excluded from the count. */
```

with:

```typescript
/** "Dividi" UI: splits a transaction's amount (expense or income) between the effective share and the share excluded from the count. */
```

- [ ] **Step 5: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/domain/expenses/split-slider.tsx
git commit -m "feat: SplitSlider mostra etichette dedicate per le entrate"
```

---

### Task 4: `AutoCategorizeWizard` — split visible for income too

**Files:**
- Modify: `components/domain/expenses/auto-categorize-wizard.tsx`

**Interfaces:**
- Consumes: no new dependency.
- Produces: no new public prop — `AutoCategorizeWizardProps`/`AutoCategorizeStepProps` unchanged. The behavior of `onConfirm`/`handleConfirm` changes (it no longer zeroes `excludedAmount` for income).

- [ ] **Step 1: Remove the guard that hides the split slider for income, make the labels dynamic**

In `components/domain/expenses/auto-categorize-wizard.tsx`, inside `AutoCategorizeStep`, replace:

```typescript
        {!isIncome && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">Dividi (quota esclusa dal conteggio)</p>
            <Slider
              value={[excluded]}
              min={0}
              max={totalAmount}
              step={0.01}
              onValueChange={(value) =>
                setExcluded(clampExcluded(Array.isArray(value) ? value[0] : value, totalAmount))
              }
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Spesa effettiva: {formatCurrency(totalAmount - excluded, currency)}</span>
              <span>Esclusa: {formatCurrency(excluded, currency)}</span>
            </div>
          </div>
        )}
```

with:

```typescript
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">Dividi (quota esclusa dal conteggio)</p>
          <Slider
            value={[excluded]}
            min={0}
            max={totalAmount}
            step={0.01}
            onValueChange={(value) =>
              setExcluded(clampExcluded(Array.isArray(value) ? value[0] : value, totalAmount))
            }
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {isIncome ? "Entrata effettiva" : "Spesa effettiva"}: {formatCurrency(totalAmount - excluded, currency)}
            </span>
            <span>Esclusa: {formatCurrency(excluded, currency)}</span>
          </div>
        </div>
```

- [ ] **Step 2: Always pass `excluded` to `onConfirm`, no longer zeroed for income**

Replace:

```typescript
        <Button
          type="button"
          onClick={() => onConfirm(categoryId, isIncome ? 0 : excluded)}
          disabled={isPending}
        >
          {isPending ? "Salvataggio..." : "Conferma"}
        </Button>
```

with:

```typescript
        <Button type="button" onClick={() => onConfirm(categoryId, excluded)} disabled={isPending}>
          {isPending ? "Salvataggio..." : "Conferma"}
        </Button>
```

- [ ] **Step 3: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. Note: the `isIncome` variable stays in use (for the category filter and for the dynamic label), so it does not become an unused import/variable.

- [ ] **Step 4: Commit**

```bash
git add components/domain/expenses/auto-categorize-wizard.tsx
git commit -m "feat: abilita Dividi anche per le entrate nel wizard Categorizza automaticamente"
```

---

## Final verification

After Task 4, run in sequence:

```bash
pnpm exec tsc --noEmit
pnpm test
```

No new type errors, no new failing tests compared to the known baseline (only possible pre-existing and unrelated failures in `lib/gocardless/scheduler.test.ts`).

Manual user verification (no Postgres/Redis guaranteed in the agentic sandbox): open an income transaction in Transazioni (Transactions), click "Dividi", verify that the slider shows "Entrata effettiva" and the correct explanatory text, exclude a share and verify that the KPI/lists in Cash flow reflect only the net share; repeat the same check from the "Categorizza automaticamente" wizard on a proposed income transaction.
