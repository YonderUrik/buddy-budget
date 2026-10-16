# "Diviso" visual indicator in TransactionRow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make it visible in the transaction row (without opening the "Dividi" ("Split") panel) that a transaction has been split, showing the net amount as the main figure, a "Diviso" ("Split") badge and the original full amount in small print.

**Architecture:** A purely conditional-rendering change in `components/domain/expenses/transaction-row.tsx`, based on `excludedAmount` already present on `transaction` (no new data, no new calls). No other file involved.

**Tech Stack:** Next.js (App Router) + TypeScript, existing `Badge`/`CurrencyInput` components.

## Global Constraints

- User-facing strings in Italian.
- No hardcoded colors/radii: only existing Tailwind token classes.
- No changes to `SplitSlider`, API, DB schema, calculation engine (`lib/calc/expenses.ts`).
- The amount field of "Manuale" ("Manual") transactions must keep editing the full amount (`transaction.amount`), never the net — the net indication is informational only, in a separate non-editable element.
- Minimal JSDoc (one `/**` line) already present at the top of the file; no need to add more for these internal changes.

---

## Starting state (verified in the code)

`components/domain/expenses/transaction-row.tsx` already exists. Auto row (read-only, roughly lines 128-131): a single `<p>` with the full amount. Manual row (roughly lines 132-141): `CurrencyInput` editing `amountValue` (initialized to `Math.abs(Number(transaction.amount))`). Auto/Manuale badge at lines 124-126. `transaction.excludedAmount` is already a field of the `Transaction` row (used in `SplitSlider`), always available here without extra fetches. No component test infrastructure in this project (no jsdom/Testing Library) — this change has no automated tests, only manual browser verification.

---

### Task 1: "Diviso" badge + net/full amount in TransactionRow

**Files:**
- Modify: `components/domain/expenses/transaction-row.tsx`

**Interfaces:**
- Consumes: no dependency on other tasks (single-task plan).
- Produces: no new exports — `TransactionRowProps` unchanged.

- [ ] **Step 1: Add the derived constants right after the existing state**

In `components/domain/expenses/transaction-row.tsx`, right after the line `const [splitOpen, setSplitOpen] = React.useState(false);` (around line 42), add:

```tsx
  const excludedAmount = Math.abs(Number(transaction.excludedAmount));
  const fullAmount = Math.abs(Number(transaction.amount));
  const netAmount = fullAmount - excludedAmount;
  const isSplit = excludedAmount > 0;
```

- [ ] **Step 2: Add the "Diviso" badge next to the existing Auto/Manuale badge**

Replace:

```tsx
          <Badge variant={isAuto ? "secondary" : "outline"} className="shrink-0">
            {isAuto ? "Auto" : "Manuale"}
          </Badge>
```

with:

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

- [ ] **Step 3: Replace the amount block (both the Auto and Manuale branches)**

Replace the whole block:

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

with:

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

- [ ] **Step 4: Check types**

Run: `pnpm exec tsc --noEmit` (or, if the environment has the known pnpm exec `ERR_PNPM_IGNORED_BUILDS` issue, `node node_modules/typescript/bin/tsc --noEmit`)
Expected: no errors in `transaction-row.tsx`.

- [ ] **Step 5: Lint**

Run: `pnpm exec eslint components/domain/expenses/transaction-row.tsx` (or `node node_modules/eslint/bin/eslint.js components/domain/expenses/transaction-row.tsx`)
Expected: no errors/warnings.

- [ ] **Step 6: Manual browser verification (no component test infrastructure in this project)**

Start `pnpm dev`, open the Spese ("Expenses") screen:
- **Unsplit** Auto transaction: rendering identical to before (full amount only, no "Diviso" badge, no struck-through line).
- **Split** Auto transaction (open "Dividi" and move the slider/use ÷2): the "Diviso" badge appears next to "Auto"; the main figure shows the net; below it, the full amount appears struck through in small print.
- **Unsplit** Manual transaction: rendering identical to before (editable input, no "Netto" ("Net") line below).
- **Split** Manual transaction: the "Diviso" badge appears next to "Manuale"; the input keeps showing/editing the full amount (check that editing and saving it still works); below the input, "Netto: €X" appears in small print.
- Bring the split back to 0 from the Dividi panel (÷1 does not exist as a shortcut: use the slider or the "Spesa effettiva" ("Actual expense") input to reset the exclusion): the badge and the net/struck-through line disappear, back to the original rendering.
- Check in dark mode that the badge and the struck-through/small text have readable contrast.
- Check that the layout does not break on a narrow screen (mobile): the amount column grows vertically (two lines) but must not push the rest of the layout out of place.

- [ ] **Step 7: Commit**

```bash
git add components/domain/expenses/transaction-row.tsx
git commit -m "feat: mostra indicatore Diviso e importo netto in TransactionRow"
```

---

## Self-Review (done while writing the plan)

1. **Spec coverage**: "Diviso" badge → Step 2; Auto row with net + struck-through → Step 3; Manual row with unchanged input + net note → Step 3; no changes to SplitSlider/API/schema/calculation engine → stated in Global Constraints, no other file touched. All spec sections are covered.
2. **Placeholder scan**: no TBD/TODO, every step has complete code, explicit before/after.
3. **Type consistency**: `excludedAmount`/`fullAmount`/`netAmount`/`isSplit` defined only once (Step 1) and reused identically in Steps 2-3, no double definition or diverging name.
