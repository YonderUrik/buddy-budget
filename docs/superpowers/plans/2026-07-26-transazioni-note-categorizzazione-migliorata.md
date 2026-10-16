# Transaction notes + improved categorization via GoCardless fields — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GoCardless `creditorName`/`debtorName` as the source of a clean name for `description` (with the same fallback as today) and a free, editable `note` field on every transaction, without touching the existing categorization algorithms.

**Architecture:** Two new nullable columns on `transactions` (`rawDescription`, `note`). `lib/gocardless/sync.ts` computes `description` from `creditorName`/`debtorName` when available (fallback to `remittanceInformationUnstructured`, then to the literal "Movimento bancario"), saving the original raw text in `rawDescription`. `note` is editable via the existing PATCH endpoint (already generic, no route change needed) and included in the Spese (Expenses) text filter. No change to `lib/gocardless/categorize.ts` or `lib/calc/categorize-suggestions.ts`: they automatically benefit from a cleaner `description`.

**Tech Stack:** Next.js/TypeScript, Drizzle ORM (Postgres), Zod, TanStack Query, Vitest, shadcn/ui (`@base-ui/react` Popover, new Textarea component).

## Global Constraints

- Reference spec: `docs/superpowers/specs/2026-07-26-transazioni-note-categorizzazione-migliorata-design.md`.
- No backfill of the already synced auto transactions (they keep the existing raw `description`, `rawDescription`/`note` at `null`).
- No change to `lib/gocardless/categorize.ts` or `lib/calc/categorize-suggestions.ts` — the matching algorithm stays identical, only the input changes.
- `note` at most 500 characters, empty string (after trim) normalized to `null`.
- `note` editable on both `auto` and `manuale` transactions (the only field that breaks the general rule "auto is read-only" — an explicit choice of the spec).
- All visible UI strings in Italian, no hardcoded colors/values outside the theme tokens (see `CLAUDE.md`).

---

### Task 1: DB schema — `rawDescription`/`note` columns

**Files:**
- Modify: `lib/db/schema/transactions.ts`
- Modify: `lib/calc/expenses.test.ts` (`makeTransaction` helper)
- Modify: `lib/calc/categorize-suggestions.test.ts` (`makeTransaction` helper)

**Interfaces:**
- Produces: `Transaction` (drizzle `$inferSelect`) with two new keys `rawDescription: string | null` and `note: string | null`, used by all the following tasks.

- [ ] **Step 1: Add the columns to the schema**

In `lib/db/schema/transactions.ts`, add two nullable columns right after `description`:

```ts
    description: text("description").notNull(),
    // Original raw remittanceInformationUnstructured text (auto transactions only, when
    // GoCardless provides it): used for the tooltip when `description` has been replaced by the
    // clean creditorName/debtorName name, never for categorization matching.
    rawDescription: text("raw_description"),
    // Free user note, editable on auto and manual transactions.
    note: text("note"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
```

- [ ] **Step 2: Apply the schema to the DB**

Run, from the directory in which you are working on this plan (worktree or main repo depending on where this checkout was opened — **never** from a directory other than the one with this schema, otherwise Drizzle reads the wrong schema):

```bash
pnpm db:push
```

Adding two nullable columns is a non-destructive operation (no data loss expected). If `drizzle-kit push` shows a confirmation prompt that looks destructive (rename/drop of something), **stop and ask the user for confirmation** instead of confirming blindly.

- [ ] **Step 3: Update the existing test helpers to compile with the new columns**

In `lib/calc/expenses.test.ts`, in the `makeTransaction` function, add the two keys (the `Transaction` type now requires them, even if nullable):

```ts
function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    accountId: "account-1",
    categoryId: "category-1",
    description: "Transazione",
    rawDescription: null,
    note: null,
    amount: "-10.00",
    excludedAmount: "0.00",
    date: "2026-02-10",
    source: "manuale",
    externalId: null,
    createdAt: new Date(),
    // ...rest unchanged
```

Same change in `lib/calc/categorize-suggestions.test.ts`:

```ts
function makeTransaction(overrides: Partial<Transaction>): Transaction {
  counter += 1;
  return {
    id: overrides.id ?? `tx-${counter}`,
    userId: "user-1",
    accountId: "account-1",
    categoryId: "category-1",
    description: "Esselunga",
    rawDescription: null,
    note: null,
    amount: "-20.00",
    excludedAmount: "0.00",
    date: "2026-01-01",
    source: "manuale",
    externalId: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}
```

- [ ] **Step 4: Verify that everything compiles and the existing tests pass**

Run: `pnpm tsc --noEmit`
Expected: no errors.

Run: `pnpm vitest run lib/calc/expenses.test.ts lib/calc/categorize-suggestions.test.ts`
Expected: PASS (no new assertions yet, only a check that the updated helper does not break anything).

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema/transactions.ts lib/calc/expenses.test.ts lib/calc/categorize-suggestions.test.ts
git commit -m "feat: aggiungi colonne rawDescription/note a transactions"
```

---

### Task 2: GoCardless client + sync — creditorName/debtorName mapping

**Files:**
- Modify: `lib/gocardless/client.ts`
- Modify: `lib/gocardless/sync.ts`
- Modify: `lib/gocardless/sync.test.ts`

**Interfaces:**
- Consumes: `Transaction.rawDescription`/`Transaction.note` (Task 1).
- Produces: no new exported function — only the value computed internally in `syncAccountLink` for `description`/`rawDescription` before the insert changes.

- [ ] **Step 1: Add the two optional fields to `BankTransaction`**

In `lib/gocardless/client.ts`:

```ts
export interface BankTransaction {
  transactionId?: string;
  internalTransactionId?: string;
  transactionAmount: { amount: string; currency: string };
  remittanceInformationUnstructured?: string;
  bookingDate: string;
  creditorName?: string;
  debtorName?: string;
}
```

- [ ] **Step 2: Write the new tests (they will fail until you touch `sync.ts`)**

Add in `lib/gocardless/sync.test.ts`, inside `describe("syncAccountLink", ...)`, three new cases (after the first existing test, before `"distingue le transazioni categorizzate..."`):

```ts
  it("usa creditorName come description su una spesa (importo negativo), salvando il testo grezzo in rawDescription", async () => {
    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "100.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({
      transactions: [
        {
          internalTransactionId: "tx-creditor",
          transactionAmount: { amount: "-20.00", currency: "EUR" },
          remittanceInformationUnstructured: "PAGAMENTO POS ESSELUNGA VIA ROMA COD.4471",
          creditorName: "ESSELUNGA SPA",
          bookingDate: "2026-07-01",
        },
      ],
      rateLimit: null,
    });

    await syncAccountLink(link, createMemoryStore());

    const [stored] = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(stored.description).toBe("ESSELUNGA SPA");
    expect(stored.rawDescription).toBe("PAGAMENTO POS ESSELUNGA VIA ROMA COD.4471");
  });

  it("usa debtorName come description su un'entrata (importo positivo)", async () => {
    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "100.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({
      transactions: [
        {
          internalTransactionId: "tx-debtor",
          transactionAmount: { amount: "500.00", currency: "EUR" },
          remittanceInformationUnstructured: "BONIFICO RIF.998877",
          debtorName: "MARIO ROSSI SRL",
          bookingDate: "2026-07-01",
        },
      ],
      rateLimit: null,
    });

    await syncAccountLink(link, createMemoryStore());

    const [stored] = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(stored.description).toBe("MARIO ROSSI SRL");
    expect(stored.rawDescription).toBe("BONIFICO RIF.998877");
  });

  it("senza creditorName/debtorName ricade sulla descrizione grezza, con rawDescription uguale a description", async () => {
    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "100.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({
      transactions: [
        {
          internalTransactionId: "tx-no-merchant",
          transactionAmount: { amount: "-8.00", currency: "EUR" },
          remittanceInformationUnstructured: "Supermercato",
          bookingDate: "2026-07-01",
        },
      ],
      rateLimit: null,
    });

    await syncAccountLink(link, createMemoryStore());

    const [stored] = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(stored.description).toBe("Supermercato");
    expect(stored.rawDescription).toBe("Supermercato");
  });

  it("senza nessun campo testuale ricade su 'Movimento bancario', con rawDescription null", async () => {
    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "100.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({
      transactions: [
        {
          internalTransactionId: "tx-empty",
          transactionAmount: { amount: "-3.00", currency: "EUR" },
          bookingDate: "2026-07-01",
        },
      ],
      rateLimit: null,
    });

    await syncAccountLink(link, createMemoryStore());

    const [stored] = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(stored.description).toBe("Movimento bancario");
    expect(stored.rawDescription).toBeNull();
  });
```

- [ ] **Step 3: Run the new tests to verify they fail**

Run: `pnpm vitest run lib/gocardless/sync.test.ts`
Expected: FAIL on the 4 new tests (the `creditorName`/`debtorName` fields do not exist yet in the type/logic, `rawDescription` is not written yet).

- [ ] **Step 4: Implement the computation in `sync.ts`**

In `lib/gocardless/sync.ts`, replace line 79 (`const description = ...`) with:

```ts
      const rawDescription = bankTransaction.remittanceInformationUnstructured ?? null;
      const isExpense = Number(bankTransaction.transactionAmount.amount) < 0;
      const merchantName = (isExpense ? bankTransaction.creditorName : bankTransaction.debtorName)?.trim();
      const description = merchantName || rawDescription || "Movimento bancario";
```

and add `rawDescription` to the insert values (next to `description:`):

```ts
        .values({
          userId: link.userId,
          accountId: link.accountId,
          categoryId,
          description,
          rawDescription,
          amount: bankTransaction.transactionAmount.amount,
          date: bankTransaction.bookingDate,
          source: "auto",
          externalId,
        })
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run lib/gocardless/sync.test.ts`
Expected: PASS on all tests (the 4 new ones + all the pre-existing ones, unchanged in behavior).

- [ ] **Step 6: Commit**

```bash
git add lib/gocardless/client.ts lib/gocardless/sync.ts lib/gocardless/sync.test.ts
git commit -m "feat: usa creditorName/debtorName GoCardless per description pulita, salva testo grezzo in rawDescription"
```

---

### Task 3: Validation + PATCH `note`

**Files:**
- Modify: `lib/validation/transactions.ts`
- Modify: `lib/validation/transactions.test.ts`
- Modify: `app/api/transactions/[id]/route.test.ts`

**Interfaces:**
- Consumes: `Transaction.note` (Task 1).
- Produces: `UpdateTransactionInput` now includes `note?: string | null`, consumed by `useUpdateTransactionMutation` (Task 5) and by `PATCH /api/transactions/[id]` (no change to the route code: `note` is not in `MANUAL_ONLY_FIELDS` and already passes through `...rest` in the `.set({...})`).

- [ ] **Step 1: Write the validation tests (they will fail until you touch the schema)**

Add in `lib/validation/transactions.test.ts`, inside `describe("updateTransactionSchema", ...)`:

```ts
  it("accetta una nota valida", () => {
    const result = updateTransactionSchema.safeParse({ note: "Regalo compleanno di Marco" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBe("Regalo compleanno di Marco");
    }
  });

  it("normalizza una nota vuota (dopo trim) a null", () => {
    const result = updateTransactionSchema.safeParse({ note: "   " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBeNull();
    }
  });

  it("accetta esplicitamente null per cancellare la nota", () => {
    const result = updateTransactionSchema.safeParse({ note: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBeNull();
    }
  });

  it("rifiuta una nota oltre 500 caratteri", () => {
    const result = updateTransactionSchema.safeParse({ note: "a".repeat(501) });
    expect(result.success).toBe(false);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run lib/validation/transactions.test.ts`
Expected: FAIL (`note` is not yet a field of the schema).

- [ ] **Step 3: Add `note` to `updateTransactionSchema`**

In `lib/validation/transactions.ts`:

```ts
export const updateTransactionSchema = z
  .object({
    description: z.string().trim().min(1).optional(),
    categoryId: z.string().uuid().optional(),
    amount: z.number().positive().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida").optional(),
    excludedAmount: z.number().min(0).optional(),
    note: z
      .string()
      .trim()
      .max(500, "La nota non può superare 500 caratteri")
      .nullable()
      .optional()
      .transform((val) => (val === "" ? null : val)),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nessun campo da aggiornare",
  });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run lib/validation/transactions.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the API tests for `note` on auto and manual transactions**

Add in `app/api/transactions/[id]/route.test.ts`, inside `describe("PATCH/DELETE /api/transactions/[id]", ...)` (after the test `"permette di cambiare categoria e 'dividi' su una transazione auto"`):

```ts
  it("permette di impostare una nota su una transazione manuale", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Spesa",
        amount: "-50.00",
        date: "2026-02-10",
        source: "manuale",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ note: "Regalo per Marco" }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.note).toBe("Regalo per Marco");
  });

  it("permette di impostare una nota su una transazione auto (unico campo libero anche per auto)", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Movimento sincronizzato",
        amount: "-50.00",
        date: "2026-02-10",
        source: "auto",
        externalId: "ext-note-auto",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ note: "Da controllare" }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.note).toBe("Da controllare");
  });

  it("cancella una nota esistente inviando null", async () => {
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId,
        description: "Spesa",
        note: "Nota precedente",
        amount: "-50.00",
        date: "2026-02-10",
        source: "manuale",
      })
      .returning();

    const response = await PATCH(
      new NextRequest(`http://localhost/api/transactions/${transaction.id}`, {
        method: "PATCH",
        body: JSON.stringify({ note: null }),
      }),
      { params: Promise.resolve({ id: transaction.id }) }
    );

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.note).toBeNull();
  });
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm vitest run app/api/transactions/[id]/route.test.ts`
Expected: PASS on all tests (no change to `route.ts` needed: `note` is not in `MANUAL_ONLY_FIELDS` and already passes through the `...rest` spread).

- [ ] **Step 7: Commit**

```bash
git add lib/validation/transactions.ts lib/validation/transactions.test.ts "app/api/transactions/[id]/route.test.ts"
git commit -m "feat: aggiungi campo note a updateTransactionSchema, editabile su auto e manuali"
```

---

### Task 4: Text search — include `note`

**Files:**
- Modify: `lib/calc/expenses.ts`
- Modify: `lib/calc/expenses.test.ts`

**Interfaces:**
- Consumes: `Transaction.note` (Task 1), `TransactionFilter` (existing, unchanged in shape).
- Produces: no new exported function — `filterTransactions` also matches on `note`.

- [ ] **Step 1: Write the test (it will fail until you touch `filterTransactions`)**

Add in `lib/calc/expenses.test.ts`, inside `describe("filterTransactions", ...)`:

```ts
  it("filtra per testo anche dentro la nota, oltre alla descrizione", () => {
    const transactions = [
      makeTransaction({ id: "t1", description: "Esselunga", note: null }),
      makeTransaction({ id: "t2", description: "PAYPAL *XYZ", note: "Regalo compleanno di Marco" }),
    ];
    const result = filterTransactions(transactions, { categoryId: null, searchText: "marco" });
    expect(result.map((t) => t.id)).toEqual(["t2"]);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run lib/calc/expenses.test.ts`
Expected: FAIL on the new test (`note` not yet included in the match).

- [ ] **Step 3: Update `filterTransactions`**

In `lib/calc/expenses.ts`:

```ts
/** Filters transactions by exact category and/or case-insensitive substring on description or note, in AND. */
export function filterTransactions(
  transactions: Transaction[],
  filter: TransactionFilter
): Transaction[] {
  const normalizedSearch = filter.searchText.trim().toLocaleLowerCase();
  return transactions.filter((t) => {
    if (filter.categoryId !== null && t.categoryId !== filter.categoryId) return false;
    if (normalizedSearch === "") return true;
    const descriptionMatch = t.description.toLocaleLowerCase().includes(normalizedSearch);
    const noteMatch = (t.note ?? "").toLocaleLowerCase().includes(normalizedSearch);
    return descriptionMatch || noteMatch;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run lib/calc/expenses.test.ts`
Expected: PASS on all the tests of the file.

- [ ] **Step 5: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/expenses.test.ts
git commit -m "feat: includi la nota nel filtro testo di Spese"
```

---

### Task 5: UI — note icon/popover + raw description tooltip

**Files:**
- Create: `components/domain/expenses/transaction-note-popover.tsx`
- Modify: `components/domain/expenses/transaction-row.tsx`
- Create (via CLI): `components/ui/textarea.tsx`

**Interfaces:**
- Consumes: `Transaction` (Task 1, fields `note`/`rawDescription`), `useUpdateTransactionMutation` (`lib/queries/transactions.ts`, existing), `UpdateTransactionInput` (Task 3, field `note`).
- Produces: `TransactionNotePopover` (component internal to `transaction-row.tsx`, not exported from the barrel — used only there, consistent with `SplitSlider` which instead is exported because it is reused elsewhere; here there is no second consumer).

- [ ] **Step 1: Install shadcn's Textarea component**

```bash
pnpm dlx shadcn@latest add textarea
```

Verify that `components/ui/textarea.tsx` has been created.

- [ ] **Step 2: Create `TransactionNotePopover`**

Create `components/domain/expenses/transaction-note-popover.tsx`:

```tsx
"use client";

/** Icon + popover to read/edit the free note of a transaction (auto or manual). */

import * as React from "react";
import { NotebookPen } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateTransactionMutation } from "@/lib/queries/transactions";
import type { Transaction } from "@/lib/db/schema/transactions";

const NOTE_MAX_LENGTH = 500;

export interface TransactionNotePopoverProps {
  transaction: Transaction;
}

export function TransactionNotePopover({ transaction }: TransactionNotePopoverProps) {
  const updateMutation = useUpdateTransactionMutation();
  const [note, setNote] = React.useState(transaction.note ?? "");
  const [open, setOpen] = React.useState(false);
  const hasNote = (transaction.note ?? "").trim() !== "";

  function commit() {
    if (note.trim() === (transaction.note ?? "")) return;
    updateMutation.mutate({ id: transaction.id, input: { note } });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) commit();
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className={
          hasNote
            ? "flex size-6 shrink-0 items-center justify-center rounded-md text-primary hover:bg-muted"
            : "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-muted focus-visible:opacity-100 group-hover:opacity-100"
        }
        aria-label={hasNote ? "Modifica nota" : "Aggiungi nota"}
        title={hasNote ? (transaction.note ?? undefined) : "Aggiungi nota"}
      >
        <NotebookPen className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={NOTE_MAX_LENGTH}
          placeholder="Aggiungi una nota (es. a cosa si riferisce questa spesa)"
          className="min-h-20 text-sm"
          aria-label="Nota transazione"
        />
        {updateMutation.isError && (
          <p className="mt-1 text-xs text-destructive">Salvataggio non riuscito, riprova.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 3: Integrate into `TransactionRow`**

In `components/domain/expenses/transaction-row.tsx`:

1. Import the new component next to the other local imports:

```ts
import { CategoryAvatar } from "@/components/domain/categories";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { TransactionNotePopover } from "./transaction-note-popover";
```

2. Add the `group` class to the row container (needed so that the empty note icon can use `group-hover:opacity-100`), on the row with `className="flex flex-wrap items-center gap-3 px-4 py-3"`:

```tsx
      <div className="group flex flex-wrap items-center gap-3 px-4 py-3">
```

3. Update the `title` of the auto description to show the raw text when present and different, replacing:

```tsx
            <p className="truncate text-sm font-medium text-foreground" title={transaction.description}>
              {transaction.description}
            </p>
```

with:

```tsx
            <p
              className="truncate text-sm font-medium text-foreground"
              title={
                transaction.rawDescription && transaction.rawDescription !== transaction.description
                  ? transaction.rawDescription
                  : transaction.description
              }
            >
              {transaction.description}
            </p>
```

4. Add `<TransactionNotePopover transaction={transaction} />` in the badge/actions group on the right, right before the "Dividi" ("Split") button:

```tsx
          <TransactionNotePopover transaction={transaction} />

          <button
            type="button"
            onClick={() => setSplitOpen((open) => !open)}
```

- [ ] **Step 4: Verify build and lint**

Run: `pnpm tsc --noEmit`
Expected: no errors.

Run: `pnpm lint`
Expected: no new errors introduced by these files.

- [ ] **Step 5: Commit**

```bash
git add components/ui/textarea.tsx components/domain/expenses/transaction-note-popover.tsx components/domain/expenses/transaction-row.tsx
git commit -m "feat: icona/popover nota libera su TransactionRow, tooltip descrizione grezza"
```

---

## Note for manual verification (cannot be automated in this sandbox)

No Postgres/Redis available for a real browser in this agentic environment (the usual constraint, see `CLAUDE.md`). To be verified manually by the user after the merge:

- An auto expense with `creditorName` shows the clean name as the main text; hover shows the original raw text in a tooltip.
- The note icon appears (filled) only when there is a note; on a row without a note, the icon still appears on hover/focus of the row so one can be added.
- The note is saved on both auto and manual transactions, and persists after refresh.
- Searching for a term present only in the note (not in the description) correctly filters the list in Spese.
- A real GoCardless sync (sandbox) with a bank that exposes `creditorName`/`debtorName` produces a clean `description` — it depends on the sandbox bank used, it may not be verifiable if the test bank does not provide these fields.
